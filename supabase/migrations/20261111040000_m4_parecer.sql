-- M4 — Parecer do relatório preliminar (um por negócio, editável pelo advogado).

create type public.opinion_conclusion as enum ('viavel', 'viavel_com_ressalvas', 'incompleta', 'inviavel');

create table public.deal_opinions (
  deal_id             uuid primary key references public.deals (id) on delete cascade,
  org_id              uuid not null references public.organizations (id) on delete cascade,
  conclusion          public.opinion_conclusion,          -- null = usar a conclusão sugerida
  opinion             text check (opinion is null or char_length(opinion) <= 20000),
  signer_name         text check (signer_name is null or char_length(signer_name) <= 200),
  signer_registration text check (signer_registration is null or char_length(signer_registration) <= 100),
  updated_by          uuid references auth.users (id) on delete set null default auth.uid(),
  updated_at          timestamptz not null default now()
);

create trigger deal_opinions_inherit_org before insert or update of deal_id on public.deal_opinions
  for each row execute function public.inherit_deal_org();

revoke all on public.deal_opinions from anon;
grant select, insert, update, delete on public.deal_opinions to authenticated;
alter table public.deal_opinions enable row level security;
create policy deal_opinions_all on public.deal_opinions for all to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
