"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DEAL_KINDS } from "@/lib/domain";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";
import { dealSchema, firstError, formToObject } from "@/lib/validation";

export type RequestState = { error?: string; ok?: boolean; at?: number };

/** O cliente abre uma solicitação de due diligence. */
export async function createRequest(_prev: RequestState, form: FormData): Promise<RequestState> {
  if (!(await getCurrentUserId())) return { error: "Sessão expirada. Entre de novo." };
  const parsed = dealSchema.extend({ kind: z.enum(DEAL_KINDS, "Escolha o tipo de negócio.") }).safeParse(formToObject(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_client_request", {
    p_org: d.orgId,
    p_kind: d.kind,
    p_title: d.title,
    p_price: d.price ?? null,
    p_notes: d.notes ?? null,
  });
  if (error) return { error: "Não foi possível abrir a solicitação." };
  revalidatePath("/minhas-solicitacoes");
  return { ok: true, at: Date.now() };
}
