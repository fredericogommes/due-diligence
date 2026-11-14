import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

/**
 * Destino do link de confirmação de e-mail. Aceita os dois formatos do Supabase:
 * ?code= (PKCE, padrão do @supabase/ssr) e ?token_hash=&type= (template customizado).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNextPath(params.get("next"));
  const supabase = await createClient();

  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }

  // Conta confirmada pela área do cliente: entra como cliente do escritório público (se não for da equipe).
  if (ok) {
    const { data: roles } = await supabase.from("memberships").select("role").returns<{ role: string }[]>();
    if (!(roles ?? []).length) await supabase.rpc("join_public_client_org");
  }
  return NextResponse.redirect(new URL(ok ? next : "/login?erro=link", request.url));
}
