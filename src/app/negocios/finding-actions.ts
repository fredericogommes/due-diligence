"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";
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

export async function setFindingResolved(dealId: string, findingId: string, resolved: boolean): Promise<FindingState> {
  if (!(await getCurrentUserId())) return { error: "Sessão expirada. Entre de novo." };
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("findings")
    .update({ resolved }, { count: "exact" })
    .eq("id", findingId)
    .eq("deal_id", dealId);
  if (error || count === 0) return { error: "Não foi possível atualizar." };
  revalidatePath(`/negocios/${dealId}`);
  return { ok: true };
}

export async function deleteFinding(dealId: string, findingId: string): Promise<FindingState> {
  if (!(await getCurrentUserId())) return { error: "Sessão expirada. Entre de novo." };
  const supabase = await createClient();
  const { error } = await supabase.from("findings").delete().eq("id", findingId).eq("deal_id", dealId);
  if (error) return { error: "Não foi possível apagar." };
  revalidatePath(`/negocios/${dealId}`);
  return { ok: true };
}
