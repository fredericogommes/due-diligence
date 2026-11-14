-- M15 — Cadastro público de clientes (página do escritório → "Solicitar due diligence").
--
-- Quem cria conta pela área do cliente vira CLIENTE do escritório que aceita
-- clientes pela internet (organizations.accepts_public_clients). A escolha do
-- escritório é do banco (flag), nunca do navegador. Equipe continua entrando
-- só por convite.
-- Reversão: drop da função e da coluna accepts_public_clients.

alter table public.organizations add column accepts_public_clients boolean not null default false;

-- Torna o usuário atual cliente do escritório público, se ainda não tiver vínculo
-- com ele. Devolve o id do escritório, ou null se não houver escritório público.
-- Quem já é da equipe desse escritório não vira cliente.
create function public.join_public_client_org()
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
begin
  if v_uid is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  select o.id into v_org from public.organizations o where o.accepts_public_clients order by o.created_at limit 1;
  if v_org is null then
    return null;
  end if;
  insert into public.memberships (org_id, user_id, role)
  values (v_org, v_uid, 'cliente')
  on conflict (org_id, user_id) do nothing;
  return v_org;
end;
$$;

revoke all on function public.join_public_client_org() from public, anon;
grant execute on function public.join_public_client_org() to authenticated;
