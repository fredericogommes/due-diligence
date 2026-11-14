import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { signOut } from "@/app/login/actions";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";

type Section = "gestao" | "painel" | "negocios" | "solicitacoes" | "organizacoes";

/** Ícones simples (traço 1.75, 20px), sem dependência externa. */
const ICON: Record<Section, ReactNode> = {
  gestao: <path d="M4 19V10m6 9V5m6 14v-7m4 7H2" />,
  painel: <path d="M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v13h-4z" />,
  negocios: <path d="M4 7h16v12H4zM9 7V5h6v2M4 12h16" />,
  solicitacoes: <path d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6" />,
  organizacoes: <path d="M4 20V8l8-4 8 4v12M9 20v-6h6v6M8 11h.01M16 11h.01" />,
};

const LABEL: Record<Section, string> = {
  gestao: "Gestão",
  painel: "Quadro",
  negocios: "Negócios",
  solicitacoes: "Minhas solicitações",
  organizacoes: "Organizações",
};

const HREF: Record<Section, string> = {
  gestao: "/gestao",
  painel: "/painel",
  negocios: "/negocios",
  solicitacoes: "/minhas-solicitacoes",
  organizacoes: "/organizacoes",
};

function NavLink({ section, active }: { section: Section; active: boolean }) {
  return (
    <Link
      href={HREF[section]}
      aria-current={active ? "page" : undefined}
      className={`flex shrink-0 items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors ${
        active ? "bg-brand/10 font-semibold text-brand" : "text-subtle hover:bg-muted hover:text-ink"
      }`}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {ICON[section]}
      </svg>
      {LABEL[section]}
    </Link>
  );
}

type Who = { sections: Section[]; name: string | null; email: string | null };

async function loadWho(): Promise<Who> {
  const userId = await getCurrentUserId();
  if (!userId) return { sections: ["organizacoes"], name: null, email: null };
  const supabase = await createClient();
  const [{ data: roles }, { data: profile }, { data: auth }] = await Promise.all([
    supabase.from("memberships").select("role").eq("user_id", userId).returns<{ role: string }[]>(),
    supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle<{ full_name: string | null }>(),
    supabase.auth.getUser(),
  ]);
  const staff = (roles ?? []).some((m) => m.role !== "cliente");
  const client = (roles ?? []).some((m) => m.role === "cliente");
  const sections: Section[] = [
    ...(staff ? (["gestao", "painel", "negocios"] as Section[]) : []),
    ...(client ? (["solicitacoes"] as Section[]) : []),
    "organizacoes",
  ];
  return { sections, name: profile?.full_name ?? null, email: auth.user?.email ?? null };
}

async function Nav({ current, layout }: { current?: Section; layout: "side" | "top" }) {
  const who = await loadWho();
  const links = who.sections.map((s) => <NavLink key={s} section={s} active={current === s} />);
  if (layout === "top") return <>{links}</>;
  return (
    <>
      <nav className="flex flex-1 flex-col gap-1 px-3">{links}</nav>
      <div className="border-t border-line p-4">
        {who.name && <p className="truncate text-sm font-medium text-ink">{who.name}</p>}
        {who.email && <p className="truncate text-xs text-subtle">{who.email}</p>}
        <form action={signOut} className="mt-3">
          <button className="w-full rounded-lg border border-line px-3 py-1.5 text-sm text-text hover:bg-muted">Sair</button>
        </form>
      </div>
    </>
  );
}

function Brand() {
  return (
    <Link href="/gestao" className="flex items-center gap-2 font-semibold tracking-tight text-ink">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-xs font-bold text-white" aria-hidden>DD</span>
      Due Diligence
    </Link>
  );
}

/**
 * Navegação das telas autenticadas: menu lateral fixo no desktop (o body ganha
 * o recuo pela classe `app-sidebar`, ver globals.css) e barra superior no celular.
 */
export function AppHeader({ current }: { current?: Section }) {
  return (
    <>
      <aside className="app-sidebar fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface print:hidden lg:flex">
        <div className="px-6 py-5"><Brand /></div>
        <Suspense fallback={<div className="flex-1" />}>
          <Nav current={current} layout="side" />
        </Suspense>
      </aside>
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur print:hidden lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <Brand />
          <form action={signOut}>
            <button className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-muted">Sair</button>
          </form>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          <Suspense fallback={null}>
            <Nav current={current} layout="top" />
          </Suspense>
        </nav>
      </header>
    </>
  );
}
