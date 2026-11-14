"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Erro inesperado numa tela: mensagem clara, tentar de novo e caminho de volta. */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-danger">Algo deu errado</p>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Não foi possível carregar esta tela.</h1>
      <p className="text-sm text-subtle">
        Pode ter sido uma instabilidade momentânea. Nenhum dado foi alterado. Tente de novo; se continuar, avise a equipe.
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={() => retry()} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong">
          Tentar de novo
        </button>
        <Link href="/gestao" className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium hover:bg-muted">
          Ir para o início
        </Link>
      </div>
    </main>
  );
}
