-- M9 — Quando o negócio entrou na etapa atual (para prazos por etapa e alerta de pedido parado).

alter table public.deals add column stage_changed_at timestamptz not null default now();
update public.deals set stage_changed_at = updated_at;

create function public.deals_stage_changed()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.stage is distinct from old.stage then
    new.stage_changed_at := now();
  else
    new.stage_changed_at := old.stage_changed_at;
  end if;
  return new;
end;
$$;

create trigger deals_stage_changed before update on public.deals
  for each row execute function public.deals_stage_changed();
revoke all on function public.deals_stage_changed() from public, anon, authenticated;

-- O quadro passa a trazer a data de entrada na etapa.
create or replace view public.deal_board with (security_invoker = true) as
  select d.id, d.org_id, d.title, d.kind, d.price, d.status, d.stage, d.assignee_id, d.client_id, d.created_at, d.updated_at,
    (select count(*) from public.parties p where p.deal_id = d.id)::int as parties,
    (select count(*) from public.assets a where a.deal_id = d.id)::int as assets,
    (select count(distinct x.deal_item_id) from public.documents x where x.deal_id = d.id and x.is_preview)::int as previews,
    (select count(*) from public.findings f where f.deal_id = d.id and not f.resolved)::int as open_findings,
    (select count(*) from public.findings f where f.deal_id = d.id and not f.resolved and f.severity in ('critico', 'alto'))::int as serious_findings,
    (select count(*) from public.certificate_requests r where r.deal_id = d.id and r.mode = 'emissao' and r.status::text = 'aguardando_pagamento')::int as awaiting_payment,
    (select count(*) from public.certificate_requests r where r.deal_id = d.id and r.mode = 'emissao' and r.status = 'pendente')::int as issuing,
    (select count(*) from public.certificate_requests r where r.deal_id = d.id and r.mode = 'emissao' and r.status = 'concluido')::int as issued,
    (select max(v.version) from public.report_versions v where v.deal_id = d.id and v.status = 'assinado') as signed_version,
    d.stage_changed_at
  from public.deals d;
