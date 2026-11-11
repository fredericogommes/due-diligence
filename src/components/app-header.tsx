import Link from "next/link";
import { signOut } from "@/app/login/actions";

/** Cabeçalho das telas autenticadas. */
export function AppHeader({ current }: { current?: "negocios" | "organizacoes" }) {
  const link = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      className={`rounded-md px-3 py-1.5 text-sm ${active ? "bg-muted font-semibold text-ink" : "text-subtle hover:text-ink"}`}
      aria-current={active ? "page" : undefined}
    >
      {label}
    </Link>
  );
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-4">
          <Link href="/negocios" className="text-lg font-bold text-ink">Due Diligence</Link>
          <nav className="flex gap-1">
            {link("/negocios", "Negócios", current === "negocios")}
            {link("/", "Organizações", current === "organizacoes")}
          </nav>
        </div>
        <form action={signOut}>
          <button className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-muted">Sair</button>
        </form>
      </div>
    </header>
  );
}
