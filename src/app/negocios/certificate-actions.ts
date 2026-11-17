"use server";

import { aiEnabled } from "@/lib/analysis/client";
import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getProvider, isOnlineItem, pickProvider, type CertidaoSubject, type ReceivedFile } from "@/lib/certidoes/providers";
import { subjectFromRows } from "@/lib/certidoes/subject";
import { computeValidity, todaySaoPaulo } from "@/lib/checklist/validity";
import { assetLabel, partyLabel } from "@/lib/checklist/build";
import { loadDeal } from "@/lib/deals/load";
import { syncStage } from "@/lib/deals/stage";
import { buildStoragePath, DOCUMENTS_BUCKET } from "@/lib/documents";
import { formatBRL } from "@/lib/domain";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";
import { analyzeDocument } from "./analysis-actions";

export type CertificateState = { error?: string; ok?: boolean; message?: string };

type Supabase = Awaited<ReturnType<typeof createClient>>;

const SESSION_EXPIRED: CertificateState = { error: "Sessão expirada. Entre de novo." };
const OPEN_ISSUE = ["pendente", "aguardando_pagamento"];

/** Guarda o PDF recebido no Storage e registra o documento ligado ao item. */
async function storeReceived(
  supabase: Supabase, orgId: string, dealId: string, itemId: string, r: ReceivedFile, isPreview: boolean,
): Promise<string | null> {
  const path = buildStoragePath(orgId, dealId, randomUUID(), r.file.fileName);
  const { error: upErr } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, r.file.bytes, { contentType: r.file.mimeType, upsert: false });
  if (upErr) return null;
  const { data: doc, error } = await supabase
    .from("documents")
    .insert({
      deal_id: dealId,
      deal_item_id: itemId,
      storage_path: path,
      file_name: r.file.fileName,
      mime_type: r.file.mimeType,
      size_bytes: r.file.bytes.byteLength,
      sha256: createHash("sha256").update(r.file.bytes).digest("hex"),
      doc_type: r.meta.docType,
      issuer: r.meta.issuer,
      issued_at: r.meta.issuedAt,
      expires_at: r.meta.expiresAt,
      result: r.meta.result,
      source: "api",
      is_preview: isPreview,
    })
    .select("id")
    .single();
  if (error || !doc) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
    return null;
  }
  return doc.id;
}

function subjectName(s: CertidaoSubject): string {
  return s.party?.name ?? s.asset?.description ?? "negócio";
}

/** Limita quantas tarefas rodam ao mesmo tempo. */
async function inBatches<T>(items: T[], size: number, fn: (item: T) => Promise<unknown>): Promise<void> {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

/**
 * FASE 1 — Consulta prévia: busca a visualização de todas as certidões online
 * do negócio, guarda os arquivos, registra apontamento para cada resultado
 * positivo e, com a IA ligada, lê cada visualização.
 * `refresh` = consultar de novo também os itens que já têm visualização.
 */
export async function runPreviews(dealId: string, refresh = false): Promise<CertificateState> {
  if (!(await getCurrentUserId())) return SESSION_EXPIRED;
  if (!z.uuid().safeParse(dealId).success) return { error: "Negócio inválido." };
  const data = await loadDeal(dealId);
  if (!data) return { error: "Negócio não encontrado." };
  const supabase = await createClient();
  const today = todaySaoPaulo();
  const tpl = new Map(data.templateItems.map((t) => [t.id, t]));
  const previewed = new Set(data.documents.filter((d) => d.is_preview && d.deal_item_id).map((d) => d.deal_item_id));

  let done = 0;
  let positives = 0;
  const skipped: string[] = [];
  const failed: string[] = [];
  const newDocs: string[] = [];

  const targets = data.items.filter((it) => {
    const t = tpl.get(it.template_item_id);
    return t && isOnlineItem(t.code) && it.status !== "dispensado" && (refresh || !previewed.has(it.id));
  });

  await inBatches(targets, 4, async (it) => {
    const t = tpl.get(it.template_item_id)!;
    const subject = subjectFromRows(it, t, data.parties, data.assets);
    const choice = pickProvider(subject, "visualizacao");
    if (!choice.ok) {
      skipped.push(`${t.code}: ${choice.reason}`);
      return;
    }
    const { data: req } = await supabase
      .from("certificate_requests")
      .insert({ deal_id: dealId, deal_item_id: it.id, provider: choice.provider.id, mode: "visualizacao", request: subject })
      .select("id")
      .single();
    if (!req) {
      failed.push(t.code);
      return;
    }
    const r = await choice.provider.preview(subject, today);
    if (r.status === "erro") {
      await supabase.from("certificate_requests").update({ status: "erro", error: r.error.slice(0, 2000), updated_at: new Date().toISOString() }).eq("id", req.id);
      failed.push(`${t.code}: ${r.error}`);
      return;
    }
    const docId = await storeReceived(supabase, data.deal.org_id, dealId, it.id, r, true);
    await supabase
      .from("certificate_requests")
      .update({ status: docId ? "concluido" : "erro", document_id: docId, cost_cents: r.costCents, protocol: r.protocol, error: docId ? null : "Falha ao guardar o arquivo.", updated_at: new Date().toISOString() })
      .eq("id", req.id);
    if (!docId) {
      failed.push(t.code);
      return;
    }
    done++;
    newDocs.push(docId);
    if (r.meta.result === "positiva") {
      positives++;
      const who = it.party_id
        ? partyLabel(data.parties.find((p) => p.id === it.party_id)!)
        : it.asset_id
          ? assetLabel(data.assets.find((a) => a.id === it.asset_id)!)
          : subjectName(subject);
      await supabase.from("findings").insert({
        deal_id: dealId,
        deal_item_id: it.id,
        document_id: docId,
        severity: "alto",
        title: `Visualização positiva: ${t.title} (${who})`,
        description: "A consulta prévia encontrou registro. Verificar o teor na visualização e, se o negócio avançar, na certidão oficial.",
        source: "consulta",
      });
    }
  });

  // Leitura por IA das visualizações novas (quando configurada).
  let aiRead = 0;
  if (aiEnabled() && newDocs.length) {
    await inBatches(newDocs, 3, async (id) => {
      if (!(await analyzeDocument(dealId, id)).error) aiRead++;
    });
  }

  await syncStage(supabase, dealId);
  revalidatePath(`/negocios/${dealId}`);
  if (!done && !failed.length) {
    return skipped.length
      ? { error: `Nenhuma certidão consultada. ${skipped.slice(0, 3).join(" ")}` }
      : { ok: true, message: "Todas as certidões online já foram consultadas. Use “Consultar de novo” para atualizar." };
  }
  const parts = [`${done} ${done === 1 ? "certidão consultada" : "certidões consultadas"}`];
  parts.push(positives ? `${positives} com registro (viraram apontamentos)` : "nenhuma com registro");
  if (aiRead) parts.push(`${aiRead} lidas pela IA`);
  if (skipped.length) parts.push(`${skipped.length} sem fonte disponível`);
  if (failed.length) parts.push(`${failed.length} com erro`);
  return { ok: true, message: `${parts.join(" · ")}.` };
}

/**
 * FASE 2 — Emissão: pede as certidões oficiais de todos os itens online que
 * ainda não têm certidão oficial válida nem pedido em aberto. O provedor
 * devolve o boleto, que fica no pedido para o usuário pagar.
 */
export async function requestIssuance(dealId: string): Promise<CertificateState> {
  if (!(await getCurrentUserId())) return SESSION_EXPIRED;
  if (!z.uuid().safeParse(dealId).success) return { error: "Negócio inválido." };
  const data = await loadDeal(dealId);
  if (!data) return { error: "Negócio não encontrado." };
  const supabase = await createClient();
  // Emissão oficial só depois do relatório preliminar assinado (fase 2 do fluxo da MK).
  const { count: signed } = await supabase.from("report_versions").select("id", { count: "exact", head: true }).eq("deal_id", dealId).eq("status", "assinado");
  if (!signed) return { error: "Assine o relatório preliminar antes de pedir as certidões oficiais." };
  const today = todaySaoPaulo();
  const tpl = new Map(data.templateItems.map((t) => [t.id, t]));
  const openItems = new Set(data.certRequests.filter((r) => r.mode === "emissao" && OPEN_ISSUE.includes(r.status)).map((r) => r.deal_item_id));

  let requested = 0;
  let totalCents = 0;
  const skipped: string[] = [];
  const failed: string[] = [];

  const targets = data.items.filter((it) => {
    const t = tpl.get(it.template_item_id);
    if (!t || !isOnlineItem(t.code) || it.status === "dispensado" || openItems.has(it.id)) return false;
    const official = data.documents.filter((d) => d.deal_item_id === it.id && !d.is_preview);
    const hasValid = official.some((d) => computeValidity(d, t.validity_days, today).state !== "vencida");
    return !hasValid;
  });

  await inBatches(targets, 4, async (it) => {
    const t = tpl.get(it.template_item_id)!;
    const subject = subjectFromRows(it, t, data.parties, data.assets);
    const choice = pickProvider(subject, "emissao");
    if (!choice.ok) {
      skipped.push(`${t.code}: ${choice.reason}`);
      return;
    }
    const { data: req } = await supabase
      .from("certificate_requests")
      .insert({ deal_id: dealId, deal_item_id: it.id, provider: choice.provider.id, mode: "emissao", request: subject })
      .select("id")
      .single();
    if (!req) {
      failed.push(t.code);
      return;
    }
    const r = await choice.provider.request(subject, today);
    const now = new Date().toISOString();
    if (r.status === "erro") {
      await supabase.from("certificate_requests").update({ status: "erro", error: r.error.slice(0, 2000), updated_at: now }).eq("id", req.id);
      failed.push(`${t.code}: ${r.error}`);
      return;
    }
    if (r.status === "concluido") {
      const docId = await storeReceived(supabase, data.deal.org_id, dealId, it.id, r, false);
      await supabase.from("certificate_requests").update({ status: docId ? "concluido" : "erro", document_id: docId, protocol: r.protocol, cost_cents: r.costCents, updated_at: now }).eq("id", req.id);
    } else {
      await supabase
        .from("certificate_requests")
        .update({
          status: r.status,
          protocol: r.protocol,
          cost_cents: r.costCents,
          response: { message: r.message },
          ...(r.status === "aguardando_pagamento" ? { boleto_url: r.boleto.url, boleto_line: r.boleto.line, boleto_due: r.boleto.due } : {}),
          updated_at: now,
        })
        .eq("id", req.id);
    }
    requested++;
    totalCents += r.costCents ?? 0;
  });

  await syncStage(supabase, dealId);
  revalidatePath(`/negocios/${dealId}`);
  if (!requested) {
    if (failed.length) return { error: `Não foi possível pedir as certidões. ${failed.slice(0, 3).join(" ")}` };
    if (skipped.length) return { error: `Nenhuma certidão pedida. ${skipped.slice(0, 3).join(" ")}` };
    return { ok: true, message: "Não há certidões a pedir: todas já têm certidão oficial válida ou pedido em andamento." };
  }
  const parts = [`${requested} ${requested === 1 ? "certidão pedida" : "certidões pedidas"}`, `total estimado ${formatBRL(totalCents / 100)}`];
  if (skipped.length) parts.push(`${skipped.length} sem fonte disponível`);
  if (failed.length) parts.push(`${failed.length} com erro`);
  return { ok: true, message: `${parts.join(" · ")}. Os boletos estão na lista abaixo.` };
}

/** Consulta os pedidos de emissão em aberto; certidão recebida vai para o item. */
export async function checkIssuance(dealId: string): Promise<CertificateState> {
  if (!(await getCurrentUserId())) return SESSION_EXPIRED;
  if (!z.uuid().safeParse(dealId).success) return { error: "Negócio inválido." };
  const data = await loadDeal(dealId);
  if (!data) return { error: "Negócio não encontrado." };
  const supabase = await createClient();
  const today = todaySaoPaulo();
  const tpl = new Map(data.templateItems.map((t) => [t.id, t]));
  const open = data.certRequests.filter((r) => r.mode === "emissao" && OPEN_ISSUE.includes(r.status) && r.protocol);
  if (!open.length) return { ok: true, message: "Não há pedidos em aberto." };

  let received = 0;
  let waiting = 0;
  const failed: string[] = [];
  await inBatches(open, 4, async (req) => {
    const it = data.items.find((i) => i.id === req.deal_item_id);
    const t = it ? tpl.get(it.template_item_id) : undefined;
    const provider = getProvider(req.provider);
    if (!it || !t || !provider) return;
    const subject = subjectFromRows(it, t, data.parties, data.assets);
    const r = await provider.poll(req.protocol!, subject, today);
    const now = new Date().toISOString();
    if (r.status === "erro") {
      await supabase.from("certificate_requests").update({ status: "erro", error: r.error.slice(0, 2000), updated_at: now }).eq("id", req.id);
      failed.push(t.code);
      return;
    }
    if (r.status !== "concluido") {
      waiting++;
      return;
    }
    const docId = await storeReceived(supabase, data.deal.org_id, dealId, it.id, r, false);
    await supabase.from("certificate_requests").update({ status: docId ? "concluido" : "erro", document_id: docId, updated_at: now }).eq("id", req.id);
    if (!docId) {
      failed.push(t.code);
      return;
    }
    received++;
    // Certidão oficial negativa atende o item; positiva vira apontamento para análise.
    if (r.meta.result === "negativa") {
      await supabase.from("deal_items").update({ status: "completo" }).eq("id", it.id);
    } else {
      await supabase.from("findings").insert({
        deal_id: dealId, deal_item_id: it.id, document_id: docId, severity: "alto",
        title: `Certidão oficial positiva: ${t.title} (${subjectName(subject)})`, source: "consulta",
      });
    }
  });

  await syncStage(supabase, dealId);
  revalidatePath(`/negocios/${dealId}`);
  const parts = [`${received} ${received === 1 ? "certidão recebida" : "certidões recebidas"}`];
  if (waiting) parts.push(`${waiting} aguardando pagamento ou emissão`);
  if (failed.length) parts.push(`${failed.length} com erro`);
  return { ok: !failed.length || received > 0, message: `${parts.join(" · ")}.`, error: failed.length && !received ? `Erro em ${failed.join(", ")}.` : undefined };
}
