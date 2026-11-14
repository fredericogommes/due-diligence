-- M11 — Revisor jurídico separado do administrador (MK-01 §5: "Administrador da
-- organização ... não recebe aprovação jurídica automaticamente").
--
-- Antes: dono, administrador e advogado revisavam e assinavam versões do relatório
-- só pelo papel. Agora a revisão/assinatura exige a permissão explícita
-- memberships.legal_reviewer, concedida apenas pelo dono e auditada.
--
-- Backfill (sem suposição de tenant, só sobre vínculos existentes): quem já podia
-- assinar (owner/admin/advogado) recebe a permissão de forma explícita, para não
-- retirar capacidade de ninguém sem aviso. Novos vínculos: só "advogado" nasce
-- revisor; dono e administrador precisam de concessão.
-- Reversão: drop do trigger/funções novas, recriar report_versions_before_update
-- da M6 e drop da coluna legal_reviewer.

alter table public.memberships add column legal_reviewer boolean not null default false;

update public.memberships set legal_reviewer = true where role::text in ('owner', 'admin', 'advogado');

-- Padrão na criação do vínculo e quem pode mudar a permissão.
create function public.memberships_legal_reviewer()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- O valor enviado pelo cliente é ignorado: advogado nasce revisor; os demais não.
    new.legal_reviewer := new.role::text = 'advogado';
    return new;
  end if;
  if new.role::text = 'cliente' then
    -- Virar cliente sempre retira a permissão (retirada é segura; não exige o dono).
    new.legal_reviewer := false;
  elsif new.legal_reviewer is distinct from old.legal_reviewer then
    -- Contexto sem usuário (manutenção pelo banco) segue livre; pela aplicação, só o dono.
    if auth.uid() is not null and not public.has_org_role(old.org_id, array['owner']::public.member_role[]) then
      raise exception 'só o dono concede ou retira a permissão de revisor jurídico' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger memberships_legal_reviewer before insert or update on public.memberships
  for each row execute function public.memberships_legal_reviewer();
revoke all on function public.memberships_legal_reviewer() from public, anon, authenticated;

create function public.is_legal_reviewer(p_org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = auth.uid() and m.legal_reviewer and m.role::text <> 'cliente'
  );
$$;
revoke all on function public.is_legal_reviewer(uuid) from public, anon;
grant execute on function public.is_legal_reviewer(uuid) to authenticated;

-- Revisão e assinatura de versões: só revisor jurídico (o resto da regra da M6 é igual).
create or replace function public.report_versions_before_update()
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
  if not public.is_legal_reviewer(old.org_id) then
    raise exception 'só revisor jurídico revisa ou assina' using errcode = '42501';
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

-- org_members passa a informar quem é revisor (para a tela de membros).
drop function public.org_members(uuid);
create function public.org_members(p_org uuid)
returns table (user_id uuid, full_name text, email text, role public.member_role, created_at timestamptz, legal_reviewer boolean)
language sql stable security definer set search_path = ''
as $$
  select m.user_id, p.full_name, lower(u.email), m.role, m.created_at, m.legal_reviewer
  from public.memberships m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.id = m.user_id
  where m.org_id = p_org and public.is_org_member(p_org)
  order by m.created_at;
$$;
revoke all on function public.org_members(uuid) from public, anon;
grant execute on function public.org_members(uuid) to authenticated;
