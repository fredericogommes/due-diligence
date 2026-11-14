"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { credentialsSchema, firstError, signUpSchema } from "@/lib/validation";

export type AuthState = { error?: string; info?: string };

async function siteUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  return h.get("origin") ?? `https://${h.get("host")}`;
}

/** Área escolhida no login: cliente (quem quer solicitar due diligence) ou equipe do escritório. */
export type LoginProfile = "cliente" | "equipe";

function profileOf(form: FormData): LoginProfile {
  return form.get("profile") === "equipe" ? "equipe" : "cliente";
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Para onde vai quem acabou de entrar. A decisão é do servidor, pelos vínculos
 * reais no banco (não pela aba escolhida):
 *  - equipe (dono, admin, advogado, corretor) → Gestão;
 *  - cliente → Minhas solicitações (e, se ainda não for cliente de ninguém,
 *    entra como cliente do escritório que aceita clientes pela internet).
 * A aba "equipe" com conta sem vínculo de equipe é recusada.
 */
async function destinationAfterLogin(supabase: Supabase, userId: string, profile: LoginProfile): Promise<{ to?: string; error?: string }> {
  const { data } = await supabase.from("memberships").select("role").eq("user_id", userId).returns<{ role: string }[]>();
  const roles = (data ?? []).map((m) => m.role);
  const staff = roles.some((r) => r !== "cliente");
  if (profile === "equipe") {
    if (!staff) return { error: "Esta conta não faz parte da equipe do escritório. Use a área do cliente." };
    return { to: "/gestao" };
  }
  if (staff) return { to: "/gestao" };
  if (!roles.includes("cliente")) await supabase.rpc("join_public_client_org");
  return { to: "/minhas-solicitacoes" };
}

export async function signIn(_prev: AuthState, form: FormData): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    return {
      error: error?.code === "email_not_confirmed" ? "Confirme seu e-mail antes de entrar." : "E-mail ou senha incorretos.",
    };
  }
  const dest = await destinationAfterLogin(supabase, data.user.id, profileOf(form));
  if (dest.error) {
    await supabase.auth.signOut();
    return { error: dest.error };
  }
  redirect(dest.to!);
}

export async function signUp(_prev: AuthState, form: FormData): Promise<AuthState> {
  const parsed = signUpSchema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
    fullName: form.get("fullName"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${await siteUrl()}/auth/confirm?next=/minhas-solicitacoes`,
    },
  });
  if (error) return { error: "Não foi possível criar a conta. Verifique os dados e tente de novo." };

  // Com confirmação de e-mail ligada no Supabase não há sessão ainda.
  if (!data.session || !data.user) return { info: "Conta criada. Enviamos um link de confirmação para o seu e-mail." };
  const dest = await destinationAfterLogin(supabase, data.user.id, "cliente");
  redirect(dest.to ?? "/minhas-solicitacoes");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
