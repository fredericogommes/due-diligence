"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DOCUMENTS_BUCKET, isPathInDeal } from "@/lib/documents";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";
import { documentMetaSchema, firstError, registerDocumentSchema } from "@/lib/validation";

export type DocActionState = { error?: string; ok?: boolean; documentId?: string };

/** Pasta do negócio para upload (o cliente envia o arquivo direto ao Storage). */
export async function getUploadFolder(dealId: string): Promise<{ error?: string; orgId?: string }> {
  if (!(await getCurrentUserId())) return { error: "Sessão expirada. Entre de novo." };
  if (!z.uuid().safeParse(dealId).success) return { error: "Negócio inválido." };
  const supabase = await createClient();
  const { data } = await supabase.from("deals").select("org_id").eq("id", dealId).maybeSingle<{ org_id: string }>();
  if (!data) return { error: "Negócio não encontrado." };
  return { orgId: data.org_id };
}

/**
 * Registra um arquivo já enviado ao Storage. Confere que o caminho é da pasta do
 * negócio e que o objeto existe; se o registro falhar, apaga o arquivo órfão.
 */
export async function registerDocument(input: unknown): Promise<DocActionState> {
  if (!(await getCurrentUserId())) return { error: "Sessão expirada. Entre de novo." };
  const parsed = registerDocumentSchema.safeParse(input);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;

  const supabase = await createClient();
  const { data: deal } = await supabase.from("deals").select("org_id").eq("id", d.dealId).maybeSingle<{ org_id: string }>();
  if (!deal) return { error: "Negócio não encontrado." };
  if (!isPathInDeal(d.path, deal.org_id, d.dealId)) return { error: "Caminho de arquivo inválido." };

  const folder = d.path.slice(0, d.path.lastIndexOf("/"));
  const name = d.path.slice(d.path.lastIndexOf("/") + 1);
  const { data: listed } = await supabase.storage.from(DOCUMENTS_BUCKET).list(folder, { search: name, limit: 1 });
  if (!listed?.some((o) => o.name === name)) return { error: "O arquivo não chegou ao armazenamento. Tente enviar de novo." };

  const { data, error } = await supabase
    .from("documents")
    .insert({
      deal_id: d.dealId,
      deal_item_id: d.dealItemId ?? null,
      storage_path: d.path,
      file_name: d.fileName,
      mime_type: d.mimeType,
      size_bytes: d.sizeBytes,
      sha256: d.sha256 ?? null,
      doc_type: d.docType ?? null,
      issuer: d.issuer ?? null,
      issued_at: d.issuedAt ?? null,
      expires_at: d.expiresAt ?? null,
      result: d.result,
      notes: d.notes ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([d.path]);
    return { error: "Não foi possível registrar o documento." };
  }
  revalidatePath(`/negocios/${d.dealId}`);
  return { ok: true, documentId: data.id };
}

export async function updateDocument(dealId: string, documentId: string, input: unknown): Promise<DocActionState> {
  if (!(await getCurrentUserId())) return { error: "Sessão expirada. Entre de novo." };
  const parsed = documentMetaSchema.safeParse(input);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("documents")
    .update(
      {
        deal_item_id: d.dealItemId ?? null,
        doc_type: d.docType ?? null,
        issuer: d.issuer ?? null,
        issued_at: d.issuedAt ?? null,
        expires_at: d.expiresAt ?? null,
        result: d.result,
        notes: d.notes ?? null,
      },
      { count: "exact" },
    )
    .eq("id", documentId)
    .eq("deal_id", dealId);
  if (error || count === 0) return { error: "Não foi possível salvar o documento." };
  revalidatePath(`/negocios/${dealId}`);
  return { ok: true };
}

export async function deleteDocument(dealId: string, documentId: string): Promise<DocActionState> {
  if (!(await getCurrentUserId())) return { error: "Sessão expirada. Entre de novo." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId)
    .eq("deal_id", dealId)
    .select("storage_path")
    .maybeSingle<{ storage_path: string }>();
  if (error || !data) return { error: "Não foi possível apagar o documento." };
  await supabase.storage.from(DOCUMENTS_BUCKET).remove([data.storage_path]);
  revalidatePath(`/negocios/${dealId}`);
  return { ok: true };
}

/** Link temporário (5 min) para abrir o arquivo. */
export async function getDocumentUrl(documentId: string): Promise<{ error?: string; url?: string }> {
  if (!(await getCurrentUserId())) return { error: "Sessão expirada. Entre de novo." };
  if (!/^[0-9a-f-]{36}$/i.test(documentId)) return { error: "Documento não encontrado." };
  const supabase = await createClient();
  // Autoriza no banco e registra o acesso (audit_log, ação "download") antes de gerar o link.
  const { data: path, error: logErr } = await supabase.rpc("log_document_access", { p_doc: documentId });
  if (logErr || typeof path !== "string") return { error: "Documento não encontrado." };
  const { data: signed, error } = await supabase.storage.from(DOCUMENTS_BUCKET).createSignedUrl(path, 300);
  if (error || !signed) return { error: "Não foi possível abrir o arquivo." };
  return { url: signed.signedUrl };
}
