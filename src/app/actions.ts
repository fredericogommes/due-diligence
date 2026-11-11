"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";
import { firstError, organizationSchema } from "@/lib/validation";

export type OrgState = { error?: string; ok?: boolean };

export async function createOrganization(_prev: OrgState, form: FormData): Promise<OrgState> {
  if (!(await getCurrentUserId())) return { error: "Sessão expirada. Entre de novo." };

  const parsed = organizationSchema.safeParse({ name: form.get("name"), cnpj: form.get("cnpj") ?? "" });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_organization", {
    p_name: parsed.data.name,
    p_cnpj: parsed.data.cnpj || null,
  });
  if (error) return { error: "Não foi possível criar a organização." };

  revalidatePath("/");
  return { ok: true };
}
