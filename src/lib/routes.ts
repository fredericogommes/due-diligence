/** Rotas acessíveis sem login. */
/** `/macedo-keenan` é a demonstração pública (dados fictícios, sem banco) do subsistema no site do escritório. */
const PUBLIC_PREFIXES = ["/login", "/auth/", "/macedo-keenan", ...(process.env.NODE_ENV === "production" ? [] : ["/demo/"])] as const;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : `${p}/`));
}

/** Só aceita caminhos internos (evita redirecionamento aberto em ?next=). */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
