"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { todaySaoPaulo } from "@/lib/checklist/validity";
import { loadDeal } from "@/lib/deals/load";
import { buildReport, type ReportSnapshot } from "@/lib/report/build";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";
import { firstError, formToObject } from "@/lib/validation";
import type { OpinionData } from "./opinion-editor";

export type OpinionState = { error?: string; ok?: boolean };

const opinionSchema = z.object({
  dealId: z.uuid(),
  conclusion: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["viavel", "viavel_com_ressalvas", "incompleta", "inviavel"]).optional()),
  opinion: z.string().trim().max(20000, "Parecer muito longo.").optional(),
  signerName: z.string().trim().max(200).optional(),
  signerRegistration: z.string().trim().max(100).optional(),
});

export async function saveOpinion(_prev: OpinionState, form: FormData): Promise<OpinionState> {
  if (!(await getCurrentUserId())) return { error: "Sessão expirada. Entre de novo." };
  const parsed = opinionSchema.safeParse(formToObject(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const o = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("deal_opinions").upsert(
    {
      deal_id: o.dealId,
      conclusion: o.conclusion ?? null,
      opinion: o.opinion || null,
      signer_name: o.signerName || null,
      signer_registration: o.signerRegistration || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "deal_id" },
  );
  if (error) return { error: "Não foi possível salvar o parecer." };
  revalidatePath(`/negocios/${o.dealId}/relatorio`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Versões do relatório: congelam o relatório atual (montado no servidor).

export type VersionState = { error?: string; ok?: boolean };

export async function createReportVersion(dealId: string): Promise<VersionState> {
  if (!(await getCurrentUserId())) return { error: "Sessão expirada. Entre de novo." };
  if (!z.uuid().safeParse(dealId).success) return { error: "Negócio inválido." };
  const data = await loadDeal(dealId);
  if (!data) return { error: "Negócio não encontrado." };
  const supabase = await createClient();
  const { data: opinion } = await supabase
    .from("deal_opinions")
    .select("conclusion, opinion, signer_name, signer_registration")
    .eq("deal_id", dealId)
    .maybeSingle<OpinionData>();
  const report = buildReport(data, todaySaoPaulo());
  const snapshot: ReportSnapshot = { report, conclusion: opinion?.conclusion ?? report.suggestedConclusion, opinion: opinion ?? null };
  const { error } = await supabase.from("report_versions").insert({ deal_id: dealId, conclusion: snapshot.conclusion, snapshot });
  if (error) return { error: "Não foi possível salvar a versão." };
  revalidatePath(`/negocios/${dealId}/relatorio`);
  return { ok: true };
}

export async function advanceReportVersion(dealId: string, versionId: string, status: string): Promise<VersionState> {
  if (!(await getCurrentUserId())) return { error: "Sessão expirada. Entre de novo." };
  const parsed = z.object({ dealId: z.uuid(), versionId: z.uuid(), status: z.enum(["revisado", "assinado"]) }).safeParse({ dealId, versionId, status });
  if (!parsed.success) return { error: "Dados inválidos." };
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("report_versions")
    .update({ status: parsed.data.status }, { count: "exact" })
    .eq("id", versionId)
    .eq("deal_id", dealId);
  if (error?.code === "42501") return { error: "Só quem tem a permissão de revisor jurídico revisa ou assina." };
  if (error || count === 0) return { error: "Não foi possível mudar o status (revise antes de assinar)." };
  revalidatePath(`/negocios/${dealId}/relatorio`);
  return { ok: true };
}

export async function deleteReportVersion(dealId: string, versionId: string): Promise<VersionState> {
  if (!(await getCurrentUserId())) return { error: "Sessão expirada. Entre de novo." };
  if (!z.uuid().safeParse(versionId).success) return { error: "Versão inválida." };
  const supabase = await createClient();
  const { error, count } = await supabase.from("report_versions").delete({ count: "exact" }).eq("id", versionId).eq("deal_id", dealId);
  if (error || count === 0) return { error: "Só rascunhos podem ser apagados." };
  revalidatePath(`/negocios/${dealId}/relatorio`);
  return { ok: true };
}
