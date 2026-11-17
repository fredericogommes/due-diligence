"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { aiConfig, createAiClient } from "@/lib/analysis/client";
import { extractDocument, type ItemContext } from "@/lib/analysis/extract";
import { buildFindings, mergeDocumentMeta } from "@/lib/analysis/findings";
import type { Extraction } from "@/lib/analysis/schema";
import { partyLabel, assetLabel } from "@/lib/checklist/build";
import { todaySaoPaulo } from "@/lib/checklist/validity";
import type { AssetRow, DealItemRow, DocumentRow, PartyRow, TemplateItemRow } from "@/lib/db-types";
import { DEAL_KIND_LABEL, type DealKind } from "@/lib/domain";
import { DOCUMENTS_BUCKET } from "@/lib/documents";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";

export type AnalysisState = { error?: string; ok?: boolean };

const ids = z.object({ dealId: z.uuid(), documentId: z.uuid() });

/** Lê o documento com a IA, guarda a análise, preenche metadados vazios e registra os apontamentos. */
export async function analyzeDocument(dealId: string, documentId: string): Promise<AnalysisState> {
  if (!(await getCurrentUserId())) return { error: "Sessão expirada. Entre de novo." };
  if (!ids.safeParse({ dealId, documentId }).success) return { error: "Documento inválido." };
  const ai = aiConfig();
  if (!ai) {
    return { error: "Leitura por IA desativada: configure o Vercel AI Gateway ou ANTHROPIC_API_KEY no servidor." };
  }

  const supabase = await createClient();
  const { data: doc } = await supabase.from("documents").select("*").eq("id", documentId).eq("deal_id", dealId).maybeSingle<DocumentRow>();
  if (!doc) return { error: "Documento não encontrado." };
  const { data: deal } = await supabase.from("deals").select("kind").eq("id", dealId).maybeSingle<{ kind: DealKind }>();
  if (!deal) return { error: "Negócio não encontrado." };

  const item = doc.deal_item_id ? await loadItemContext(supabase, doc.deal_item_id, deal.kind) : null;

  const model = ai.model;
  const { data: analysis, error: insErr } = await supabase
    .from("document_analyses")
    .insert({ deal_id: dealId, document_id: documentId, status: "pendente", model })
    .select("id")
    .single();
  if (insErr || !analysis) return { error: "Não foi possível iniciar a análise." };

  const finish = async (patch: Record<string, unknown>) =>
    supabase.from("document_analyses").update({ ...patch, completed_at: new Date().toISOString() }).eq("id", analysis.id);

  const { data: blob, error: dlErr } = await supabase.storage.from(DOCUMENTS_BUCKET).download(doc.storage_path);
  if (dlErr || !blob) {
    await finish({ status: "erro", error: "Arquivo não encontrado no armazenamento." });
    return { error: "Não foi possível baixar o arquivo." };
  }

  const result = await extractDocument(createAiClient(ai), {
    fileBase64: Buffer.from(await blob.arrayBuffer()).toString("base64"),
    mimeType: doc.mime_type as "application/pdf",
    fileName: doc.file_name,
    item,
    today: todaySaoPaulo(),
  }, model, { serverFallback: ai.via === "anthropic" });

  if (!result.ok) {
    await finish({ status: "erro", error: result.error });
    revalidatePath(`/negocios/${dealId}`);
    return { error: result.error };
  }

  const out = result.data;
  await finish({ status: "concluida", output: out, model: result.model, input_tokens: result.inputTokens, output_tokens: result.outputTokens });

  // Preenche só o que o usuário ainda não informou.
  await supabase.from("documents").update(mergeDocumentMeta(doc, out)).eq("id", documentId);

  // Re-leitura substitui os apontamentos da IA ainda não resolvidos deste documento.
  await supabase.from("findings").delete().eq("document_id", documentId).eq("source", "ia").eq("resolved", false);
  const findings = buildFindings(out, { dealId, documentId, itemId: doc.deal_item_id, analysisId: analysis.id });
  if (findings.length) await supabase.from("findings").insert(findings);

  revalidatePath(`/negocios/${dealId}`);
  return { ok: true };
}

async function loadItemContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  itemId: string,
  kind: DealKind,
): Promise<ItemContext> {
  const { data: it } = await supabase.from("deal_items").select("*").eq("id", itemId).maybeSingle<DealItemRow>();
  if (!it) return null;
  const { data: t } = await supabase.from("template_items").select("*").eq("id", it.template_item_id).maybeSingle<TemplateItemRow>();
  if (!t) return null;
  let subject: string | null = null;
  let expected: string | null = null;
  if (it.party_id) {
    const { data: p } = await supabase.from("parties").select("*").eq("id", it.party_id).maybeSingle<PartyRow>();
    if (p) {
      subject = partyLabel(p);
      expected = p.document;
    }
  } else if (it.asset_id) {
    const { data: a } = await supabase.from("assets").select("*").eq("id", it.asset_id).maybeSingle<AssetRow>();
    if (a) {
      subject = assetLabel(a);
      expected = a.matricula ? `matrícula ${a.matricula}${a.cartorio ? ` — ${a.cartorio}` : ""}` : a.cnpj;
    }
  }
  return { code: t.code, title: t.title, description: t.description, subject, expectedDocument: expected, dealKind: DEAL_KIND_LABEL[kind] };
}

/** Aplica ao item o status sugerido pela última leitura. */
export async function applySuggestedStatus(dealId: string, analysisId: string): Promise<AnalysisState> {
  if (!(await getCurrentUserId())) return { error: "Sessão expirada. Entre de novo." };
  const supabase = await createClient();
  const { data: a } = await supabase
    .from("document_analyses")
    .select("output, document_id")
    .eq("id", analysisId)
    .eq("deal_id", dealId)
    .maybeSingle<{ output: Extraction | null; document_id: string }>();
  if (!a?.output) return { error: "Análise não encontrada." };
  const { data: doc } = await supabase.from("documents").select("deal_item_id").eq("id", a.document_id).maybeSingle<{ deal_item_id: string | null }>();
  if (!doc?.deal_item_id) return { error: "O documento não está ligado a um item." };
  const { error } = await supabase.from("deal_items").update({ status: a.output.suggested_status }).eq("id", doc.deal_item_id);
  if (error) return { error: "Não foi possível aplicar." };
  revalidatePath(`/negocios/${dealId}`);
  return { ok: true };
}
