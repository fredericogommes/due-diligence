import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/login/actions";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";

type Section = "painel" | "negocios" | "solicitacoes" | "organizacoes";

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-1.5 text-sm ${active ? "bg-muted font-semibold text-ink" : "text-subtle hover:text-ink"}`}
      aria-current={active ? "page" : undefined}
    >
      {label}
    </Link>
  );
}

/** Links conforme os papéis do usuário: equipe vê painel e negócios; cliente vê as solicitações dele. */
async function Nav({ current }: { current?: Section }) {
  const userId = await getCurrentUserId();
  let staff = false;
  let client = false;
  if (userId) {
    const supabase = await createClient();
    const { data } = await supabase.from("memberships").select("role").eq("user_id", userId).returns<{ role: string }[]>();
    staff = (data ?? []).some((m) => m.role !== "cliente");
    client = (data ?? []).some((m) => m.role === "cliente");
  }
  return (
    <>
      {staff && <NavLink href="/painel" label="Painel" active={current === "painel"} />}
      {staff && <NavLink href="/negocios" label="Negócios" active={current === "negocios"} />}
      {client && <NavLink href="/minhas-solicitacoes" label="Minhas solicitações" active={current === "solicitacoes"} />}
      <NavLink href="/" label="Organizações" active={current === "organizacoes"} />
    </>
  );
}

/** Cabeçalho das telas autenticadas. */
export function AppHeader({ current }: { current?: Section }) {
  return (
    <header className="border-b border-line bg-surface print:hidden">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/painel" className="text-lg font-bold text-ink">Due Diligence</Link>
          <nav className="flex flex-wrap gap-1">
            <Suspense fallback={<NavLink href="/" label="Organizações" active={current === "organizacoes"} />}>
              <Nav current={current} />
            </Suspense>
          </nav>
        </div>
        <form action={signOut}>
          <button className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-muted">Sair</button>
        </form>
      </div>
    </header>
  );
}
