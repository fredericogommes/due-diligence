"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";
import { CLOSED_STATUSES, FINDING_STATUSES } from "@/lib/findings";
import { firstError, formToObject } from "@/lib/validation";

export type FindingState = { error?: string; ok?: boolean; at?: number };

const findingSchema = z.object({
  dealId: z.uuid(),
  dealItemId: z.preprocess((v) => (v === "" ? undefined : v), z.uuid().optional()),
  severity: z.enum(["critico", "alto", "medio", "baixo"], "Escolha a gravidade."),
  title: z.string().trim().min(2, "Descreva o apontamento.").max(300),
  description: z.string().trim().max(4000).optional(),
});

export async function addFinding(_prev: FindingState, form: FormData): Promise<FindingState> {
  if (!(await getCurrentUserId())) return { error: "Sessão expirada. Entre de novo." };
  const parsed = findingSchema.safeParse(formToObject(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const f = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("findings").insert({
    deal_id: f.dealId,
    deal_item_id: f.dealItemId ?? null,
    severity: f.severity,
    title: f.title,
    description: f.description || null,
    source: "manual",
  });
  if (error) return { error: "Não foi possível registrar o apontamento." };
  revalidatePath(`/negocios/${f.dealId}`);
  return { ok: true, at: Date.now() };
}

const statusSchema = z.object({
  dealId: z.uuid(),
  findingId: z.uuid(),
  status: z.enum(FINDING_STATUSES),
  note: z.string().trim().max(2000, "Justificativa muito longa.").optional(),
});

/** Muda o estado do achado; encerrar exige justificativa e aceitar risco exige revisor (o banco confere). */
export async function setFindingStatus(dealId: string, findingId: string, status: string, note?: string): Promise<FindingState> {
  if (!(await getCurrentUserId())) return { error: "Sessão expirada. Entre de novo." };
  const parsed = statusSchema.safeParse({ dealId, findingId, status, note });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const p = parsed.data;
  if (CLOSED_STATUSES.includes(p.status) && !p.note) return { error: "Informe a justificativa." };
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("findings")
    .update({ status: p.status, resolution_note: CLOSED_STATUSES.includes(p.status) ? p.note : null }, { count: "exact" })
    .eq("id", p.findingId)
    .eq("deal_id", p.dealId);
  if (error?.code === "42501") return { error: "Só revisor jurídico aceita um risco." };
  if (error || count === 0) return { error: "Não foi possível atualizar o apontamento." };
  revalidatePath(`/negocios/${dealId}`);
  return { ok: true };
}

export async function deleteFinding(dealId: string, findingId: string): Promise<FindingState> {
  if (!(await getCurrentUserId())) return { error: "Sessão expirada. Entre de novo." };
  const supabase = await createClient();
  const { error, count } = await supabase.from("findings").delete({ count: "exact" }).eq("id", findingId).eq("deal_id", dealId);
  if (error || count === 0) return { error: "Este apontamento já entrou na análise: encerre-o como descartado, com justificativa." };
  revalidatePath(`/negocios/${dealId}`);
  return { ok: true };
}
