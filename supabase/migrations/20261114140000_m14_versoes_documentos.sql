-- M14 — Versões de documentos (MK-01 Fase 3: "originais imutáveis", versionamento).
--
-- Uma nova versão é um novo registro em `documents` que aponta para a versão
-- anterior (supersedes_id). A anterior continua guardada, intacta (arquivo e
-- hash), e não pode ser apagada enquanto houver versão mais nova apontando para ela.
-- Cada versão tem no máximo uma sucessora (cadeia linear).
-- Reversão: drop do trigger/função, do índice e da coluna supersedes_id.

alter table public.documents add column supersedes_id uuid references public.documents (id);
-- (sem ON DELETE: "no action" é verificado no fim do comando, então apagar o negócio
-- inteiro, em cascata, continua funcionando; apagar só a versão antiga é recusado.)

create unique index documents_supersedes_uniq on public.documents (supersedes_id) where supersedes_id is not null;

create function public.documents_version_check()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_prev public.documents;
begin
  if tg_op = 'UPDATE' then
    if new.supersedes_id is distinct from old.supersedes_id then
      raise exception 'a versão anterior de um documento não pode ser trocada' using errcode = '23514';
    end if;
    return new;
  end if;
  if new.supersedes_id is not null then
    select * into v_prev from public.documents d where d.id = new.supersedes_id;
    if v_prev.id is null or v_prev.deal_id <> new.deal_id then
      raise exception 'a versão anterior precisa ser do mesmo negócio' using errcode = '23514';
    end if;
    if v_prev.is_preview <> new.is_preview then
      raise exception 'visualização e certidão oficial não são versões uma da outra' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger documents_version_check before insert or update on public.documents
  for each row execute function public.documents_version_check();
revoke all on function public.documents_version_check() from public, anon, authenticated;
