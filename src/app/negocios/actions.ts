"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { syncStage } from "@/lib/deals/stage";
import { DEAL_STATUSES } from "@/lib/domain";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";
import {
  assetSchema, dealSchema, firstError, formToObject, itemUpdateSchema, partySchema,
} from "@/lib/validation";
import { z } from "zod";

/** `at` muda a cada sucesso — usado como key para limpar formulários. */
export type ActionState = { error?: string; ok?: boolean; at?: number };

const SESSION_EXPIRED: ActionState = { error: "Sessão expirada. Entre de novo." };

async function authed() {
  if (!(await getCurrentUserId())) return null;
  return createClient();
}

export async function createDeal(_prev: ActionState, form: FormData): Promise<ActionState> {
  const supabase = await authed();
  if (!supabase) return SESSION_EXPIRED;
  const parsed = dealSchema.safeParse(formToObject(form));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { orgId, kind, title, price, notes, templateId } = parsed.data;
  const { data, error } = await supabase
    .from("deals")
    .insert({ org_id: orgId, kind, title, price: price ?? null, notes: notes ?? null, ...(templateId ? { template_id: templateId } : {}) })
    .select("id")
    .single();
  if (error || !data) return { error: "Não foi possível criar o negócio." };
  redirect(`/negocios/${data.id}`);
}

export async function updateDealStatus(dealId: string, status: string): Promise<ActionState> {
  const supabase = await authed();
  if (!supabase) return SESSION_EXPIRED;
  const parsed = z.object({ dealId: z.uuid(), status: z.enum(DEAL_STATUSES) }).safeParse({ dealId, status });
  if (!parsed.success) return { error: "Status inválido." };
  const { error, count } = await supabase
    .from("deals")
    .update({ status: parsed.data.status }, { count: "exact" })
    .eq("id", parsed.data.dealId);
  if (error || count === 0) return { error: "Não foi possível alterar o status." };
  revalidatePath(`/negocios/${dealId}`);
  return { ok: true };
}

export async function deleteDeal(dealId: string): Promise<ActionState> {
  const supabase = await authed();
  if (!supabase) return SESSION_EXPIRED;
  if (!z.uuid().safeParse(dealId).success) return { error: "Negócio inválido." };
  const { error, count } = await supabase.from("deals").delete({ count: "exact" }).eq("id", dealId);
  if (error || count === 0) return { error: "Só dono ou administrador podem apagar negócios." };
  redirect("/negocios");
}

/** Depois de qualificar: avança a etapa e, se entrou na consulta prévia, roda a consulta (IA) em segundo plano. */
async function afterQualification(supabase: NonNullable<Awaited<ReturnType<typeof authed>>>, dealId: string) {
  const moved = await syncStage(supabase, dealId);
  if (moved && moved.from === "qualificacao" && moved.to === "consulta") {
    after(async () => {
      const { runPreviews } = await import("./certificate-actions");
      await runPreviews(dealId);
    });
  }
}

export async function addParty(_prev: ActionState, form: FormData): Promise<ActionState> {
  const supabase = await authed();
  if (!supabase) return SESSION_EXPIRED;
  const parsed = partySchema.safeParse(formToObject(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const p = parsed.data;
  const { error } = await supabase.from("parties").insert({
    deal_id: p.dealId,
    kind: p.kind,
    role: p.role,
    name: p.name,
    document: p.document ?? null,
    marital_status: p.maritalStatus ?? null,
    property_regime: p.propertyRegime ?? null,
    notes: p.notes ?? null,
  });
  if (error) return { error: "Não foi possível adicionar a parte." };
  await afterQualification(supabase, p.dealId);
  revalidatePath(`/negocios/${p.dealId}`);
  return { ok: true, at: Date.now() };
}

export async function deleteParty(dealId: string, partyId: string): Promise<ActionState> {
  const supabase = await authed();
  if (!supabase) return SESSION_EXPIRED;
  const { error } = await supabase.from("parties").delete().eq("id", partyId).eq("deal_id", dealId);
  if (error) return { error: "Não foi possível remover a parte." };
  revalidatePath(`/negocios/${dealId}`);
  return { ok: true };
}

export async function addAsset(_prev: ActionState, form: FormData): Promise<ActionState> {
  const supabase = await authed();
  if (!supabase) return SESSION_EXPIRED;
  const parsed = assetSchema.safeParse(formToObject(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const a = parsed.data;
  const { error } = await supabase.from("assets").insert({
    deal_id: a.dealId,
    kind: a.kind,
    description: a.description,
    matricula: a.matricula ?? null,
    cartorio: a.cartorio ?? null,
    cns: a.cns ?? null,
    inscricao_iptu: a.inscricaoIptu ?? null,
    address: a.address ?? null,
    municipio: a.municipio ?? null,
    uf: a.uf ?? null,
    cnpj: a.cnpj ?? null,
  });
  if (error) return { error: "Não foi possível adicionar o bem." };
  await afterQualification(supabase, a.dealId);
  revalidatePath(`/negocios/${a.dealId}`);
  return { ok: true, at: Date.now() };
}

export async function deleteAsset(dealId: string, assetId: string): Promise<ActionState> {
  const supabase = await authed();
  if (!supabase) return SESSION_EXPIRED;
  const { error } = await supabase.from("assets").delete().eq("id", assetId).eq("deal_id", dealId);
  if (error) return { error: "Não foi possível remover o bem." };
  revalidatePath(`/negocios/${dealId}`);
  return { ok: true };
}

export async function updateItem(dealId: string, input: { itemId: string; status: string; notes?: string }): Promise<ActionState> {
  const supabase = await authed();
  if (!supabase) return SESSION_EXPIRED;
  const parsed = itemUpdateSchema.safeParse(input);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { error, count } = await supabase
    .from("deal_items")
    .update({ status: parsed.data.status, notes: parsed.data.notes ?? null }, { count: "exact" })
    .eq("id", parsed.data.itemId)
    .eq("deal_id", dealId);
  if (error || count === 0) return { error: "Não foi possível atualizar o item." };
  revalidatePath(`/negocios/${dealId}`);
  return { ok: true };
}
