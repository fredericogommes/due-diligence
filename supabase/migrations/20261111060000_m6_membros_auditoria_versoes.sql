-- M6 — Gestão de membros (convites), log de auditoria e versões do relatório.

-- ============================================================================
-- 1. Membros e convites
-- ============================================================================

-- E-mail do usuário atual (auth.users não é legível pelo papel authenticated).
create function public.current_user_email()
returns text
language sql stable security definer set search_path = ''
as $$
  select lower(u.email) from auth.users u where u.id = auth.uid();
$$;

-- Convite para entrar numa organização. O convidado se cadastra (ou entra) com
-- o mesmo e-mail e aceita o convite na página inicial. Ninguém é convidado
-- como dono: o dono promove depois, se quiser.
create table public.invitations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  email       text not null check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role        public.member_role not null check (role <> 'owner'),
  invited_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null
);

create unique index invitations_pending_uniq on public.invitations (org_id, email) where accepted_at is null;
create index invitations_email_idx on public.invitations (email) where accepted_at is null;

-- Aceita um convite pendente endereçado ao e-mail do usuário atual.
create function public.accept_invitation(p_id uuid)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.invitations;
begin
  if v_uid is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;

  select * into v_inv from public.invitations i
  where i.id = p_id and i.accepted_at is null and i.expires_at > now()
    and i.email = public.current_user_email()
  for update;

  if v_inv.id is null then
    raise exception 'convite inexistente, expirado ou de outro e-mail' using errcode = 'P0002';
  end if;

  insert into public.memberships (org_id, user_id, role)
  values (v_inv.org_id, v_uid, v_inv.role)
  on conflict (org_id, user_id) do nothing;

  update public.invitations set accepted_at = now(), accepted_by = v_uid where id = v_inv.id;
  return v_inv.org_id;
end;
$$;

-- Convites pendentes do usuário atual, com o nome da organização (que ele
-- ainda não pode ler, por não ser membro).
create function public.my_invitations()
returns table (id uuid, org_id uuid, org_name text, role public.member_role, invited_by_name text, expires_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select i.id, i.org_id, o.name, i.role, p.full_name, i.expires_at
  from public.invitations i
  join public.organizations o on o.id = i.org_id
  left join public.profiles p on p.id = i.invited_by
  where i.accepted_at is null and i.expires_at > now()
    and i.email = public.current_user_email()
  order by i.created_at;
$$;

-- Membros de uma organização com nome e e-mail (só para quem é membro).
create function public.org_members(p_org uuid)
returns table (user_id uuid, full_name text, email text, role public.member_role, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select m.user_id, p.full_name, lower(u.email), m.role, m.created_at
  from public.memberships m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.id = m.user_id
  where m.org_id = p_org and public.is_org_member(p_org)
  order by m.created_at;
$$;

revoke all on function public.current_user_email() from public, anon;
revoke all on function public.accept_invitation(uuid) from public, anon;
revoke all on function public.my_invitations() from public, anon;
revoke all on function public.org_members(uuid) from public, anon;
grant execute on function public.current_user_email() to authenticated;
grant execute on function public.accept_invitation(uuid) to authenticated;
grant execute on function public.my_invitations() to authenticated;
grant execute on function public.org_members(uuid) to authenticated;

revoke all on public.invitations from anon;
grant select, insert, delete on public.invitations to authenticated;
alter table public.invitations enable row level security;

-- Dono/admin veem, criam e cancelam convites da organização; o convidado vê os seus.
create policy invitations_select on public.invitations for select to authenticated
  using (
    public.has_org_role(org_id, array['owner', 'admin']::public.member_role[])
    or email = public.current_user_email()
  );
create policy invitations_insert on public.invitations for insert to authenticated
  with check (public.has_org_role(org_id, array['owner', 'admin']::public.member_role[]));
create policy invitations_delete on public.invitations for delete to authenticated
  using (public.has_org_role(org_id, array['owner', 'admin']::public.member_role[]));

-- ============================================================================
-- 2. Versões do relatório (rascunho → revisado → assinado)
-- ============================================================================

create type public.report_status as enum ('rascunho', 'revisado', 'assinado');

-- Cada versão congela o relatório inteiro (snapshot) no momento em que foi salva.
-- O conteúdo nunca muda; só o status avança.
create table public.report_versions (
  id          uuid primary key default gen_random_uuid(),
  deal_id     uuid not null references public.deals (id) on delete cascade,
  org_id      uuid not null references public.organizations (id) on delete cascade,
  version     int not null,
  status      public.report_status not null default 'rascunho',
  conclusion  public.opinion_conclusion not null,
  snapshot    jsonb not null,
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  signed_by   uuid references auth.users (id) on delete set null,
  signed_at   timestamptz,
  unique (deal_id, version)
);

create function public.report_versions_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  select d.org_id into new.org_id from public.deals d where d.id = new.deal_id for update;
  if new.org_id is null then
    raise exception 'negócio inexistente' using errcode = '23503';
  end if;
  select coalesce(max(v.version), 0) + 1 into new.version from public.report_versions v where v.deal_id = new.deal_id;
  new.status := 'rascunho';
  new.created_by := auth.uid();
  new.created_at := now();
  new.reviewed_by := null; new.reviewed_at := null;
  new.signed_by := null;   new.signed_at := null;
  return new;
end;
$$;

create trigger report_versions_before_insert before insert on public.report_versions
  for each row execute function public.report_versions_before_insert();

-- Só o status muda, sempre para a frente, e só advogado/admin/dono revisa ou assina.
create function public.report_versions_before_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_fixed text[] := array['status', 'reviewed_by', 'reviewed_at', 'signed_by', 'signed_at'];
begin
  if (to_jsonb(new) - v_fixed) is distinct from (to_jsonb(old) - v_fixed) then
    raise exception 'o conteúdo de uma versão do relatório não pode ser alterado' using errcode = '42501';
  end if;
  if new.status = old.status then
    new.reviewed_by := old.reviewed_by; new.reviewed_at := old.reviewed_at;
    new.signed_by := old.signed_by;     new.signed_at := old.signed_at;
    return new;
  end if;
  if not public.has_org_role(old.org_id, array['owner', 'admin', 'advogado']::public.member_role[]) then
    raise exception 'só advogado, administrador ou dono revisa ou assina' using errcode = '42501';
  end if;
  if old.status = 'rascunho' and new.status = 'revisado' then
    new.reviewed_by := auth.uid(); new.reviewed_at := now();
    new.signed_by := null;         new.signed_at := null;
  elsif old.status = 'revisado' and new.status = 'assinado' then
    new.reviewed_by := old.reviewed_by; new.reviewed_at := old.reviewed_at;
    new.signed_by := auth.uid();        new.signed_at := now();
  else
    raise exception 'mudança de status inválida (% → %)', old.status, new.status using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger report_versions_before_update before update on public.report_versions
  for each row execute function public.report_versions_before_update();

revoke all on function public.report_versions_before_insert() from public, anon, authenticated;
revoke all on function public.report_versions_before_update() from public, anon, authenticated;

create index report_versions_deal_idx on public.report_versions (deal_id, version desc);

revoke all on public.report_versions from anon;
grant select, insert, delete on public.report_versions to authenticated;
grant update (status) on public.report_versions to authenticated;
alter table public.report_versions enable row level security;

create policy report_versions_select on public.report_versions for select to authenticated
  using (public.is_org_member(org_id));
create policy report_versions_insert on public.report_versions for insert to authenticated
  with check (public.is_org_member(org_id));
create policy report_versions_update on public.report_versions for update to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
-- Só rascunhos podem ser apagados (versões revisadas/assinadas ficam para sempre).
create policy report_versions_delete on public.report_versions for delete to authenticated
  using (public.is_org_member(org_id) and status = 'rascunho');

-- ============================================================================
-- 3. Log de auditoria (quem fez o quê e quando)
-- ============================================================================

-- Guarda só os NOMES dos campos alterados, não os valores: os registros têm
-- CPF, estado civil etc., e o log não deve virar uma segunda cópia desses dados.
create table public.audit_log (
  id             bigint generated always as identity primary key,
  org_id         uuid not null references public.organizations (id) on delete cascade,
  deal_id        uuid,                       -- sem FK: o log sobrevive à exclusão do negócio
  actor_id       uuid references auth.users (id) on delete set null,
  table_name     text not null,
  record_id      text,
  action         text not null check (action in ('insert', 'update', 'delete')),
  changed_fields text[],
  created_at     timestamptz not null default now()
);

create index audit_log_org_idx on public.audit_log (org_id, created_at desc);
create index audit_log_deal_idx on public.audit_log (deal_id, created_at desc) where deal_id is not null;

create function public.audit_row()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
  v_org uuid;
  v_deal uuid;
  v_fields text[];
begin
  if tg_op <> 'INSERT' then v_old := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_new := to_jsonb(new); end if;
  v_row := coalesce(v_new, v_old);

  v_org := case when tg_table_name = 'organizations' then (v_row ->> 'id')::uuid else (v_row ->> 'org_id')::uuid end;
  -- Exclusão em cascata da organização: nada a registrar (o log dela some junto).
  if v_org is null or not exists (select 1 from public.organizations o where o.id = v_org) then
    return null;
  end if;

  v_deal := case when tg_table_name = 'deals' then (v_row ->> 'id')::uuid else (v_row ->> 'deal_id')::uuid end;
  -- Exclusão em cascata do negócio: basta o registro da exclusão do próprio negócio.
  if tg_op = 'DELETE' and tg_table_name <> 'deals' and v_deal is not null
     and not exists (select 1 from public.deals d where d.id = v_deal) then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    select array_agg(k order by k) into v_fields
    from jsonb_object_keys(v_new) k
    where k not in ('updated_at', 'updated_by') and (v_new -> k) is distinct from (v_old -> k);
    if v_fields is null then
      return null;
    end if;
  end if;

  insert into public.audit_log (org_id, deal_id, actor_id, table_name, record_id, action, changed_fields)
  values (
    v_org, v_deal, auth.uid(), tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'user_id', v_row ->> 'deal_id'),
    lower(tg_op), v_fields
  );
  return null;
end;
$$;

revoke all on function public.audit_row() from public, anon, authenticated;

create trigger audit_organizations after update or delete on public.organizations
  for each row execute function public.audit_row();
create trigger audit_memberships after insert or update or delete on public.memberships
  for each row execute function public.audit_row();
create trigger audit_invitations after insert or update or delete on public.invitations
  for each row execute function public.audit_row();
create trigger audit_deals after insert or update or delete on public.deals
  for each row execute function public.audit_row();
create trigger audit_parties after insert or update or delete on public.parties
  for each row execute function public.audit_row();
create trigger audit_assets after insert or update or delete on public.assets
  for each row execute function public.audit_row();
-- Itens do checklist são criados pelo sistema: registra só alterações.
create trigger audit_deal_items after update on public.deal_items
  for each row execute function public.audit_row();
create trigger audit_documents after insert or update or delete on public.documents
  for each row execute function public.audit_row();
create trigger audit_document_analyses after insert on public.document_analyses
  for each row execute function public.audit_row();
create trigger audit_findings after insert or update or delete on public.findings
  for each row execute function public.audit_row();
create trigger audit_deal_opinions after insert or update or delete on public.deal_opinions
  for each row execute function public.audit_row();
create trigger audit_certificate_requests after insert or update or delete on public.certificate_requests
  for each row execute function public.audit_row();
create trigger audit_report_versions after insert or update or delete on public.report_versions
  for each row execute function public.audit_row();

-- Somente leitura para o app: ninguém (nem o dono) altera ou apaga o log.
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;
alter table public.audit_log enable row level security;

-- Membros veem o histórico dos negócios; dono/admin veem também o da organização.
create policy audit_log_select on public.audit_log for select to authenticated
  using (
    (deal_id is not null and public.is_org_member(org_id))
    or public.has_org_role(org_id, array['owner', 'admin']::public.member_role[])
  );
