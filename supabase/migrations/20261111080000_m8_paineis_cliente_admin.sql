-- M8 — Painéis gerenciais.
--   * papel "cliente": quem pede a due diligence. Não é equipe: não lê as tabelas
--     do negócio; vê só as próprias solicitações, por funções com resumo.
--   * negócio ganha etapa (kanban), responsável da equipe e cliente.

alter type public.member_role add value if not exists 'cliente';

-- "Membro" nas políticas passa a significar EQUIPE (cliente fica de fora).
-- (role::text porque o novo valor do enum não pode ser usado nesta transação.)
create or replace function public.is_org_member(p_org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = auth.uid() and m.role::text <> 'cliente'
  );
$$;

-- Qualquer pessoa vê a própria participação (o cliente também).
create policy memberships_select_own on public.memberships for select to authenticated
  using (user_id = auth.uid());

-- Etapa, responsável e cliente do negócio ---------------------------------------
alter table public.deals
  add column stage text not null default 'qualificacao'
    check (stage in ('qualificacao', 'consulta', 'analise', 'emissao', 'concluido')),
  add column assignee_id uuid references auth.users (id) on delete set null,
  add column client_id   uuid references auth.users (id) on delete set null;

create index deals_stage_idx on public.deals (org_id, stage);
create index deals_client_idx on public.deals (client_id) where client_id is not null;

-- Responsável precisa ser da equipe; cliente precisa ter o papel cliente na organização.
create function public.deals_check_people()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.assignee_id is not null and not exists (
    select 1 from public.memberships m
    where m.org_id = new.org_id and m.user_id = new.assignee_id and m.role::text <> 'cliente'
  ) then
    raise exception 'o responsável precisa ser da equipe da organização' using errcode = '23514';
  end if;
  if new.client_id is not null and not exists (
    select 1 from public.memberships m
    where m.org_id = new.org_id and m.user_id = new.client_id and m.role::text = 'cliente'
  ) then
    raise exception 'o cliente precisa ter o papel cliente na organização' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger deals_check_people before insert or update of assignee_id, client_id on public.deals
  for each row execute function public.deals_check_people();
revoke all on function public.deals_check_people() from public, anon, authenticated;

-- Etapa inicial dos negócios que já existem.
update public.deals d set stage = case
  when exists (select 1 from public.certificate_requests r where r.deal_id = d.id and r.mode = 'emissao') then 'emissao'
  when exists (select 1 from public.documents x where x.deal_id = d.id and x.is_preview) then 'analise'
  when exists (select 1 from public.parties p where p.deal_id = d.id)
   and exists (select 1 from public.assets a where a.deal_id = d.id) then 'consulta'
  else 'qualificacao' end;

-- Quadro (kanban): um resumo por negócio, com a RLS de quem consulta.
create view public.deal_board with (security_invoker = true) as
  select d.id, d.org_id, d.title, d.kind, d.price, d.status, d.stage, d.assignee_id, d.client_id, d.created_at, d.updated_at,
    (select count(*) from public.parties p where p.deal_id = d.id)::int as parties,
    (select count(*) from public.assets a where a.deal_id = d.id)::int as assets,
    (select count(distinct x.deal_item_id) from public.documents x where x.deal_id = d.id and x.is_preview)::int as previews,
    (select count(*) from public.findings f where f.deal_id = d.id and not f.resolved)::int as open_findings,
    (select count(*) from public.findings f where f.deal_id = d.id and not f.resolved and f.severity in ('critico', 'alto'))::int as serious_findings,
    (select count(*) from public.certificate_requests r where r.deal_id = d.id and r.mode = 'emissao' and r.status::text = 'aguardando_pagamento')::int as awaiting_payment,
    (select count(*) from public.certificate_requests r where r.deal_id = d.id and r.mode = 'emissao' and r.status = 'pendente')::int as issuing,
    (select count(*) from public.certificate_requests r where r.deal_id = d.id and r.mode = 'emissao' and r.status = 'concluido')::int as issued,
    (select max(v.version) from public.report_versions v where v.deal_id = d.id and v.status = 'assinado') as signed_version
  from public.deals d;

revoke all on public.deal_board from anon;
grant select on public.deal_board to authenticated;

-- Funções do cliente ------------------------------------------------------------

-- Organizações onde o usuário atual é cliente.
create function public.my_client_orgs()
returns table (org_id uuid, org_name text)
language sql stable security definer set search_path = ''
as $$
  select o.id, o.name from public.memberships m join public.organizations o on o.id = m.org_id
  where m.user_id = auth.uid() and m.role::text = 'cliente'
  order by o.name;
$$;

-- O cliente abre uma solicitação (negócio) numa organização em que é cliente.
create function public.create_client_request(p_org uuid, p_kind public.deal_kind, p_title text, p_price numeric default null, p_notes text default null)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null or not exists (
    select 1 from public.memberships m where m.org_id = p_org and m.user_id = v_uid and m.role::text = 'cliente'
  ) then
    raise exception 'só clientes da organização abrem solicitações' using errcode = '42501';
  end if;
  insert into public.deals (org_id, kind, title, price, notes, client_id, created_by)
  values (p_org, p_kind, btrim(p_title), p_price, nullif(btrim(coalesce(p_notes, '')), ''), v_uid, v_uid)
  returning id into v_id;
  return v_id;
end;
$$;

-- Resumo das solicitações do cliente: etapa, boletos e relatório assinado.
create function public.my_client_requests()
returns table (
  id uuid, org_name text, title text, kind public.deal_kind, price numeric, stage text, created_at timestamptz,
  previews int, issued int, signed_version int, boletos jsonb
)
language sql stable security definer set search_path = ''
as $$
  select d.id, o.name, d.title, d.kind, d.price, d.stage, d.created_at,
    (select count(distinct x.deal_item_id) from public.documents x where x.deal_id = d.id and x.is_preview)::int,
    (select count(*) from public.certificate_requests r where r.deal_id = d.id and r.mode = 'emissao' and r.status = 'concluido')::int,
    (select max(v.version) from public.report_versions v where v.deal_id = d.id and v.status = 'assinado'),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'item', ti.title, 'line', r.boleto_line, 'url', r.boleto_url, 'due', r.boleto_due, 'cost_cents', r.cost_cents
      ) order by ti.sort_order)
      from public.certificate_requests r
      join public.deal_items di on di.id = r.deal_item_id
      join public.template_items ti on ti.id = di.template_item_id
      where r.deal_id = d.id and r.mode = 'emissao' and r.status::text = 'aguardando_pagamento'
    ), '[]'::jsonb)
  from public.deals d join public.organizations o on o.id = d.org_id
  where d.client_id = auth.uid()
  order by d.created_at desc;
$$;

-- Relatório da última versão ASSINADA de uma solicitação do cliente.
create function public.client_signed_report(p_deal uuid)
returns table (version int, signed_at timestamptz, snapshot jsonb)
language sql stable security definer set search_path = ''
as $$
  select v.version, v.signed_at, v.snapshot
  from public.report_versions v join public.deals d on d.id = v.deal_id
  where v.deal_id = p_deal and d.client_id = auth.uid() and v.status = 'assinado'
  order by v.version desc
  limit 1;
$$;

revoke all on function public.my_client_orgs() from public, anon;
revoke all on function public.create_client_request(uuid, public.deal_kind, text, numeric, text) from public, anon;
revoke all on function public.my_client_requests() from public, anon;
revoke all on function public.client_signed_report(uuid) from public, anon;
grant execute on function public.my_client_orgs() to authenticated;
grant execute on function public.create_client_request(uuid, public.deal_kind, text, numeric, text) to authenticated;
grant execute on function public.my_client_requests() to authenticated;
grant execute on function public.client_signed_report(uuid) to authenticated;
