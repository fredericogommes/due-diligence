"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { INVITE_ROLES, MEMBER_ROLES } from "@/lib/members";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";
import { firstError, formToObject } from "@/lib/validation";

export type MemberActionState = { error?: string; ok?: boolean; info?: string; at?: number };

const SESSION_EXPIRED: MemberActionState = { error: "Sessão expirada. Entre de novo." };

const inviteSchema = z.object({
  orgId: z.uuid(),
  email: z.string().trim().toLowerCase().pipe(z.email("E-mail inválido.")),
  role: z.enum(INVITE_ROLES, "Escolha o papel."),
});

export async function inviteMember(_prev: MemberActionState, form: FormData): Promise<MemberActionState> {
  if (!(await getCurrentUserId())) return SESSION_EXPIRED;
  const parsed = inviteSchema.safeParse(formToObject(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { orgId, email, role } = parsed.data;
  const supabase = await createClient();

  const { data } = await supabase.rpc("org_members", { p_org: orgId });
  const members = data as { email: string }[] | null;
  if (members?.some((m) => m.email === email)) return { error: "Essa pessoa já é membro da organização." };

  const { error } = await supabase.from("invitations").insert({ org_id: orgId, email, role });
  if (error) {
    if (error.code === "23505") return { error: "Já existe um convite pendente para esse e-mail." };
    return { error: "Não foi possível convidar. Só dono ou administrador convidam." };
  }
  revalidatePath(`/organizacoes/${orgId}`);
  return {
    ok: true,
    at: Date.now(),
    info: `Convite criado. Peça para ${email} entrar (ou se cadastrar) com esse e-mail: o convite aparece na página inicial.`,
  };
}

export async function cancelInvitation(orgId: string, invitationId: string): Promise<MemberActionState> {
  if (!(await getCurrentUserId())) return SESSION_EXPIRED;
  if (!z.uuid().safeParse(invitationId).success) return { error: "Convite inválido." };
  const supabase = await createClient();
  const { error, count } = await supabase.from("invitations").delete({ count: "exact" }).eq("id", invitationId);
  if (error || count === 0) return { error: "Não foi possível cancelar o convite." };
  revalidatePath(`/organizacoes/${orgId}`);
  return { ok: true };
}

export async function acceptInvitation(invitationId: string): Promise<MemberActionState> {
  if (!(await getCurrentUserId())) return SESSION_EXPIRED;
  if (!z.uuid().safeParse(invitationId).success) return { error: "Convite inválido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invitation", { p_id: invitationId });
  if (error) return { error: "Não foi possível aceitar: o convite expirou ou é de outro e-mail." };
  revalidatePath("/organizacoes");
  return { ok: true };
}

export async function changeMemberRole(orgId: string, userId: string, role: string): Promise<MemberActionState> {
  if (!(await getCurrentUserId())) return SESSION_EXPIRED;
  const parsed = z.object({ orgId: z.uuid(), userId: z.uuid(), role: z.enum(MEMBER_ROLES) }).safeParse({ orgId, userId, role });
  if (!parsed.success) return { error: "Dados inválidos." };
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("memberships")
    .update({ role: parsed.data.role }, { count: "exact" })
    .eq("org_id", orgId)
    .eq("user_id", userId);
  if (error?.code === "23514") return { error: "A organização precisa de ao menos um dono." };
  if (error || count === 0) return { error: "Você não tem permissão para mudar esse papel." };
  revalidatePath(`/organizacoes/${orgId}`);
  return { ok: true };
}

export async function removeMember(orgId: string, userId: string): Promise<MemberActionState> {
  const me = await getCurrentUserId();
  if (!me) return SESSION_EXPIRED;
  if (!z.uuid().safeParse(orgId).success || !z.uuid().safeParse(userId).success) return { error: "Dados inválidos." };
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("memberships")
    .delete({ count: "exact" })
    .eq("org_id", orgId)
    .eq("user_id", userId);
  if (error?.code === "23514") return { error: "A organização precisa de ao menos um dono." };
  if (error || count === 0) return { error: "Você não tem permissão para remover esse membro." };
  if (userId === me) redirect("/organizacoes");
  revalidatePath(`/organizacoes/${orgId}`);
  return { ok: true };
}

/** Concede ou retira a permissão de revisor jurídico (só o dono; o banco confere). */
export async function setLegalReviewer(orgId: string, userId: string, value: boolean): Promise<MemberActionState> {
  if (!(await getCurrentUserId())) return SESSION_EXPIRED;
  const parsed = z.object({ orgId: z.uuid(), userId: z.uuid(), value: z.boolean() }).safeParse({ orgId, userId, value });
  if (!parsed.success) return { error: "Dados inválidos." };
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("memberships")
    .update({ legal_reviewer: parsed.data.value }, { count: "exact" })
    .eq("org_id", orgId)
    .eq("user_id", userId);
  if (error?.code === "42501") return { error: "Só o dono concede ou retira a permissão de revisor jurídico." };
  if (error || count === 0) return { error: "Não foi possível alterar a permissão." };
  revalidatePath(`/organizacoes/${orgId}`);
  return { ok: true };
}
