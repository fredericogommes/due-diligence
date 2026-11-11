-- M2 — Documentos do negócio (PDF/imagem no Storage + metadados) e validade.
--
-- Arquivo no bucket privado "documentos", caminho: <org_id>/<deal_id>/<uuid>-<nome>.
-- O documento pode estar ligado a um item do checklist ou ficar "fora do checklist".

create type public.doc_result as enum (
  'negativa', 'positiva', 'positiva_efeito_negativa', 'nao_se_aplica', 'indeterminado'
);
create type public.doc_source as enum ('upload', 'api');

create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  deal_id       uuid not null references public.deals (id) on delete cascade,
  deal_item_id  uuid references public.deal_items (id) on delete set null,
  storage_path  text not null unique,
  file_name     text not null check (char_length(file_name) between 1 and 255),
  mime_type     text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes    integer not null check (size_bytes > 0 and size_bytes <= 20971520),
  sha256        text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  doc_type      text check (doc_type is null or char_length(doc_type) <= 200),
  issuer        text check (issuer is null or char_length(issuer) <= 200),
  issued_at     date,
  expires_at    date,
  result        public.doc_result not null default 'indeterminado',
  source        public.doc_source not null default 'upload',
  notes         text,
  created_by    uuid references auth.users (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  check (expires_at is null or issued_at is null or expires_at >= issued_at)
);
create index documents_deal_id_idx on public.documents (deal_id);
create index documents_deal_item_id_idx on public.documents (deal_item_id);

create trigger documents_inherit_org before insert or update of deal_id on public.documents
  for each row execute function public.inherit_deal_org();

-- Coerência: o item precisa ser do mesmo negócio; o caminho precisa ser da org/negócio.
create function public.documents_check()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.deal_item_id is not null and not exists (
    select 1 from public.deal_items di where di.id = new.deal_item_id and di.deal_id = new.deal_id
  ) then
    raise exception 'o item do checklist não pertence a este negócio' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' and new.storage_path not like new.org_id::text || '/' || new.deal_id::text || '/%' then
    raise exception 'caminho do arquivo fora da pasta do negócio' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and (new.storage_path <> old.storage_path or new.deal_id <> old.deal_id) then
    raise exception 'arquivo e negócio do documento não podem ser alterados' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger documents_check after insert or update on public.documents
  for each row execute function public.documents_check();

revoke all on function public.documents_check() from public, anon, authenticated;
revoke all on public.documents from anon;
grant select, insert, update, delete on public.documents to authenticated;

alter table public.documents enable row level security;
create policy documents_all on public.documents for all to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

-- Storage ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 20971520, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Primeiro segmento do caminho = org_id; só membros da organização acessam.
create function public.storage_org_member(p_name text)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_org uuid;
begin
  begin
    v_org := split_part(p_name, '/', 1)::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  return public.is_org_member(v_org);
end;
$$;

revoke all on function public.storage_org_member(text) from public, anon;
grant execute on function public.storage_org_member(text) to authenticated;

create policy documentos_select on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and public.storage_org_member(name));
create policy documentos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and public.storage_org_member(name));
create policy documentos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documentos' and public.storage_org_member(name));
