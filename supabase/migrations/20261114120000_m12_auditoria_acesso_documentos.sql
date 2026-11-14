-- M12 — Auditoria de acesso a documentos (MK-01 §5/§9: "Autoriza versão
-- específica e registra acesso"; §10: eventos de acesso são append-only).
--
-- Cada abertura/download de documento passa por log_document_access, que
-- confere no servidor se o usuário é da equipe da organização do documento e só
-- então registra o evento. A aplicação só gera o link temporário depois disso.
-- Reversão: drop da função e voltar a check constraint do audit_log da M6.

alter table public.audit_log drop constraint audit_log_action_check;
alter table public.audit_log add constraint audit_log_action_check
  check (action in ('insert', 'update', 'delete', 'download'));

create function public.log_document_access(p_doc uuid)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_doc record;
begin
  select d.id, d.org_id, d.deal_id, d.storage_path into v_doc from public.documents d where d.id = p_doc;
  -- Mesma resposta para "não existe" e "não autorizado": não revela existência.
  if v_doc.id is null or auth.uid() is null or not public.is_org_member(v_doc.org_id) then
    raise exception 'documento não encontrado' using errcode = 'P0002';
  end if;
  insert into public.audit_log (org_id, deal_id, actor_id, table_name, record_id, action)
  values (v_doc.org_id, v_doc.deal_id, auth.uid(), 'documents', v_doc.id::text, 'download');
  return v_doc.storage_path;
end;
$$;

revoke all on function public.log_document_access(uuid) from public, anon;
grant execute on function public.log_document_access(uuid) to authenticated;
