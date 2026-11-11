-- M5 — Pedidos de certidão a provedores (registro de imóveis, simulado etc.).

create type public.certificate_request_status as enum ('pendente', 'concluido', 'erro');

create table public.certificate_requests (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  deal_id       uuid not null references public.deals (id) on delete cascade,
  deal_item_id  uuid not null references public.deal_items (id) on delete cascade,
  provider      text not null check (char_length(provider) between 2 and 60),
  status        public.certificate_request_status not null default 'pendente',
  protocol      text check (protocol is null or char_length(protocol) <= 200),
  cost_cents    integer check (cost_cents is null or cost_cents >= 0),
  request       jsonb not null default '{}'::jsonb,
  response      jsonb,
  document_id   uuid references public.documents (id) on delete set null,
  error         text check (error is null or char_length(error) <= 2000),
  created_by    uuid references auth.users (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index certificate_requests_deal_idx on public.certificate_requests (deal_id, created_at desc);

create trigger certificate_requests_inherit_org before insert or update of deal_id on public.certificate_requests
  for each row execute function public.inherit_deal_org();

create function public.certificate_requests_check()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.deal_items i where i.id = new.deal_item_id and i.deal_id = new.deal_id) then
    raise exception 'item de outro negócio' using errcode = '23514';
  end if;
  if new.document_id is not null
     and not exists (select 1 from public.documents d where d.id = new.document_id and d.deal_id = new.deal_id) then
    raise exception 'documento de outro negócio' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger certificate_requests_check after insert or update on public.certificate_requests
  for each row execute function public.certificate_requests_check();

revoke all on function public.certificate_requests_check() from public, anon, authenticated;
revoke all on public.certificate_requests from anon;
grant select, insert, update on public.certificate_requests to authenticated;
alter table public.certificate_requests enable row level security;
create policy certificate_requests_all on public.certificate_requests for all to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
