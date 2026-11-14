import Link from "next/link";

/** Página não encontrada (ou sem permissão: não revelamos a diferença). */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-subtle">404</p>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Página não encontrada</h1>
      <p className="text-sm text-subtle">
        O endereço não existe ou você não tem acesso a ele com a sua conta atual.
      </p>
      <Link href="/gestao" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong">
        Ir para o início
      </Link>
    </main>
  );
}
