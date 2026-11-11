"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";
import { firstError, formToObject } from "@/lib/validation";

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
