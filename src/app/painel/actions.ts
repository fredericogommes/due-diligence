"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { STAGES, transitionBlock, type BoardRow } from "@/lib/board";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";

export type BoardState = { error?: string; ok?: boolean };

/** Move o cartão para outra coluna (decisão humana, inclusive voltar etapa). */
export async function moveDeal(dealId: string, stage: string): Promise<BoardState> {
  if (!(await getCurrentUserId())) return { error: "Sessão expirada. Entre de novo." };
  const parsed = z.object({ dealId: z.uuid(), stage: z.enum(STAGES) }).safeParse({ dealId, stage });
  if (!parsed.success) return { error: "Etapa inválida." };
  const supabase = await createClient();
  // Pré-condições conferidas no servidor com os dados atuais (não com o que a tela mostrava).
  const { data: row } = await supabase.from("deal_board").select("*").eq("id", dealId).maybeSingle<BoardRow>();
  if (!row) return { error: "Negócio não encontrado." };
  const blocked = transitionBlock(row, parsed.data.stage);
  if (blocked) return { error: blocked };
  const { error, count } = await supabase.from("deals").update({ stage: parsed.data.stage }, { count: "exact" }).eq("id", dealId);
  if (error || count === 0) return { error: "Não foi possível mover o negócio." };
  revalidatePath("/painel");
  return { ok: true };
}

/** Define o responsável da equipe (null = ninguém). "Assumir" = o próprio usuário. */
export async function assignDeal(dealId: string, userId: string | null): Promise<BoardState> {
  const me = await getCurrentUserId();
  if (!me) return { error: "Sessão expirada. Entre de novo." };
  const parsed = z.object({ dealId: z.uuid(), userId: z.uuid().nullable() }).safeParse({ dealId, userId });
  if (!parsed.success) return { error: "Dados inválidos." };
  const supabase = await createClient();
  const { error, count } = await supabase.from("deals").update({ assignee_id: parsed.data.userId }, { count: "exact" }).eq("id", dealId);
  if (error) return { error: error.code === "23514" ? "O responsável precisa ser da equipe." : "Não foi possível definir o responsável." };
  if (count === 0) return { error: "Negócio não encontrado." };
  revalidatePath("/painel");
  revalidatePath(`/negocios/${dealId}`);
  return { ok: true };
}

/** Liga a solicitação a um cliente da organização (null = sem cliente). */
export async function setDealClient(dealId: string, clientId: string | null): Promise<BoardState> {
  if (!(await getCurrentUserId())) return { error: "Sessão expirada. Entre de novo." };
  const parsed = z.object({ dealId: z.uuid(), clientId: z.uuid().nullable() }).safeParse({ dealId, clientId });
  if (!parsed.success) return { error: "Dados inválidos." };
  const supabase = await createClient();
  const { error, count } = await supabase.from("deals").update({ client_id: parsed.data.clientId }, { count: "exact" }).eq("id", dealId);
  if (error) return { error: error.code === "23514" ? "Escolha um membro com o papel cliente." : "Não foi possível definir o cliente." };
  if (count === 0) return { error: "Negócio não encontrado." };
  revalidatePath(`/negocios/${dealId}`);
  revalidatePath("/painel");
  return { ok: true };
}
