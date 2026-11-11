-- M3 — Leitura de documentos por IA e achados (riscos) do negócio.
--
-- document_analyses: cada leitura de um documento pela IA (saída estruturada + custo).
-- findings: riscos/pendências do negócio — vindos da IA ou anotados pelo usuário —
-- que alimentam o relatório preliminar (M4).

create type public.analysis_status as enum ('pendente', 'concluida', 'erro');
create type public.finding_severity as enum ('critico', 'alto', 'medio', 'baixo');
create type public.finding_source as enum ('ia', 'manual');

create table public.document_analyses (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations (id) on delete cascade,
  deal_id           uuid not null references public.deals (id) on delete cascade,
  document_id       uuid not null references public.documents (id) on delete cascade,
  status            public.analysis_status not null default 'pendente',
  model             text,
  output            jsonb,
  error             text,
  input_tokens      integer,
  output_tokens     integer,
  created_by        uuid references auth.users (id) on delete set null default auth.uid(),
  created_at        timestamptz not null default now(),
  completed_at      timestamptz
);
create index document_analyses_document_idx on public.document_analyses (document_id, created_at desc);

create table public.findings (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  deal_id       uuid not null references public.deals (id) on delete cascade,
  deal_item_id  uuid references public.deal_items (id) on delete set null,
  document_id   uuid references public.documents (id) on delete set null,
  analysis_id   uuid references public.document_analyses (id) on delete set null,
  severity      public.finding_severity not null,
  title         text not null check (char_length(btrim(title)) between 2 and 300),
  description   text check (description is null or char_length(description) <= 4000),
  evidence      text check (evidence is null or char_length(evidence) <= 2000),
  source        public.finding_source not null default 'manual',
  resolved      boolean not null default false,
  created_by    uuid references auth.users (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now()
);
create index findings_deal_idx on public.findings (deal_id);

create trigger document_analyses_inherit_org before insert or update of deal_id on public.document_analyses
  for each row execute function public.inherit_deal_org();
create trigger findings_inherit_org before insert or update of deal_id on public.findings
  for each row execute function public.inherit_deal_org();

-- Documento/item/análise referenciados precisam ser do mesmo negócio.
create function public.check_same_deal()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_table_name = 'document_analyses' then
    if not exists (select 1 from public.documents d where d.id = new.document_id and d.deal_id = new.deal_id) then
      raise exception 'documento de outro negócio' using errcode = '23514';
    end if;
  else
    if new.document_id is not null
       and not exists (select 1 from public.documents d where d.id = new.document_id and d.deal_id = new.deal_id) then
      raise exception 'documento de outro negócio' using errcode = '23514';
    end if;
    if new.deal_item_id is not null
       and not exists (select 1 from public.deal_items i where i.id = new.deal_item_id and i.deal_id = new.deal_id) then
      raise exception 'item de outro negócio' using errcode = '23514';
    end if;
    if new.analysis_id is not null
       and not exists (select 1 from public.document_analyses a where a.id = new.analysis_id and a.deal_id = new.deal_id) then
      raise exception 'análise de outro negócio' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger document_analyses_same_deal after insert or update on public.document_analyses
  for each row execute function public.check_same_deal();
create trigger findings_same_deal after insert or update on public.findings
  for each row execute function public.check_same_deal();

revoke all on function public.check_same_deal() from public, anon, authenticated;
revoke all on public.document_analyses, public.findings from anon;
grant select, insert, update on public.document_analyses to authenticated;
grant select, insert, update, delete on public.findings to authenticated;

alter table public.document_analyses enable row level security;
alter table public.findings enable row level security;

create policy document_analyses_all on public.document_analyses for all to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy findings_all on public.findings for all to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
