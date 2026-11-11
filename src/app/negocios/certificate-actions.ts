"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getProvider, type ProviderResult } from "@/lib/certidoes/providers";
import { loadSubject } from "@/lib/certidoes/subject";
import { todaySaoPaulo } from "@/lib/checklist/validity";
import { buildStoragePath, DOCUMENTS_BUCKET } from "@/lib/documents";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";

export type CertificateState = { error?: string; ok?: boolean; message?: string };

type Supabase = Awaited<ReturnType<typeof createClient>>;

const input = z.object({ dealId: z.uuid(), itemId: z.uuid(), providerId: z.string().min(2).max(60) });

/** Pede uma certidão ao provedor; se vier pronta, guarda o PDF e liga ao item. */
export async function requestCertificate(dealId: string, itemId: string, providerId: string): Promise<CertificateState> {
  if (!(await getCurrentUserId())) return { error: "Sessão expirada. Entre de novo." };
  if (!input.safeParse({ dealId, itemId, providerId }).success) return { error: "Pedido inválido." };
  const provider = getProvider(providerId);
  if (!provider) return { error: "Provedor desconhecido." };
  const av = provider.availability();
  if (!av.available) return { error: av.reason };

  const supabase = await createClient();
  const subject = await loadSubject(supabase, dealId, itemId);
  if (!subject) return { error: "Item não encontrado." };
  if (!provider.supports(subject.itemCode)) return { error: "Este provedor não emite este documento." };
  const missing = provider.missing(subject);
  if (missing.length) return { error: `Preencha antes: ${missing.join(", ")}.` };

  const { data: req, error } = await supabase
    .from("certificate_requests")
    .insert({ deal_id: dealId, deal_item_id: itemId, provider: provider.id, request: subject })
    .select("id")
    .single();
  if (error || !req) return { error: "Não foi possível registrar o pedido." };

  const result = await provider.request(subject, todaySaoPaulo());
  return settle(supabase, dealId, itemId, req.id, result);
}

/** Consulta de novo um pedido pendente. */
export async function pollCertificate(dealId: string, requestId: string): Promise<CertificateState> {
  if (!(await getCurrentUserId())) return { error: "Sessão expirada. Entre de novo." };
  const supabase = await createClient();
  const { data: req } = await supabase
    .from("certificate_requests")
    .select("id, deal_item_id, provider, protocol, status")
    .eq("id", requestId)
    .eq("deal_id", dealId)
    .maybeSingle<{ id: string; deal_item_id: string; provider: string; protocol: string | null; status: string }>();
  if (!req) return { error: "Pedido não encontrado." };
  if (req.status !== "pendente" || !req.protocol) return { error: "Este pedido não está pendente." };
  const provider = getProvider(req.provider);
  if (!provider?.poll) return { error: "Este provedor não permite consulta." };
  const subject = await loadSubject(supabase, dealId, req.deal_item_id);
  if (!subject) return { error: "Item não encontrado." };
  const result = await provider.poll(req.protocol, subject, todaySaoPaulo());
  return settle(supabase, dealId, req.deal_item_id, req.id, result);
}

async function settle(supabase: Supabase, dealId: string, itemId: string, requestId: string, result: ProviderResult): Promise<CertificateState> {
  const update = (patch: Record<string, unknown>) =>
    supabase.from("certificate_requests").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", requestId);

  if (result.status === "erro") {
    await update({ status: "erro", error: result.error.slice(0, 2000) });
    revalidatePath(`/negocios/${dealId}`);
    return { error: result.error };
  }
  if (result.status === "pendente") {
    await update({ protocol: result.protocol, cost_cents: result.costCents, response: { message: result.message } });
    revalidatePath(`/negocios/${dealId}`);
    return { ok: true, message: `Pedido em andamento (protocolo ${result.protocol}). ${result.message}` };
  }

  const { data: deal } = await supabase.from("deals").select("org_id").eq("id", dealId).maybeSingle<{ org_id: string }>();
  if (!deal) return { error: "Negócio não encontrado." };
  const path = buildStoragePath(deal.org_id, dealId, randomUUID(), result.file.fileName);
  const { error: upErr } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, result.file.bytes, { contentType: result.file.mimeType, upsert: false });
  if (upErr) {
    await update({ status: "erro", error: "Falha ao guardar o arquivo recebido." });
    return { error: "A certidão chegou, mas não foi possível guardar o arquivo." };
  }

  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .insert({
      deal_id: dealId,
      deal_item_id: itemId,
      storage_path: path,
      file_name: result.file.fileName,
      mime_type: result.file.mimeType,
      size_bytes: result.file.bytes.byteLength,
      sha256: createHash("sha256").update(result.file.bytes).digest("hex"),
      doc_type: result.meta.docType,
      issuer: result.meta.issuer,
      issued_at: result.meta.issuedAt,
      expires_at: result.meta.expiresAt,
      result: result.meta.result,
      source: "api",
    })
    .select("id")
    .single();
  if (docErr || !doc) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
    await update({ status: "erro", error: "Falha ao registrar o documento recebido." });
    return { error: "A certidão chegou, mas não foi possível registrá-la." };
  }

  await update({ status: "concluido", protocol: result.protocol, cost_cents: result.costCents, document_id: doc.id });
  revalidatePath(`/negocios/${dealId}`);
  return { ok: true, message: "Certidão recebida e anexada ao item." };
}
