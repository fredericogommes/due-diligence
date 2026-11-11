"use client";

import { useState } from "react";
import type { DocView } from "@/lib/checklist/build";
import { DocumentList, DocumentUploader, type ItemOption } from "./documents";

/** Documentos que não correspondem a item do checklist (como a seção 9 do parecer TETTU). */
export function ExtraDocuments({ dealId, docs, itemOptions }: { dealId: string; docs: DocView[]; itemOptions: ItemOption[] }) {
  const [adding, setAdding] = useState(false);
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-ink">Documentos fora do checklist</h2>
          <p className="text-sm text-subtle">Documentos relevantes sem item correspondente. Use “Editar” para ligar a um item.</p>
        </div>
        <button type="button" className="text-sm text-brand hover:underline" onClick={() => setAdding((a) => !a)}>
          {adding ? "Cancelar" : "Adicionar documento"}
        </button>
      </div>
      {adding && <DocumentUploader dealId={dealId} onDone={() => setAdding(false)} />}
      {docs.length === 0 && !adding && <p className="mt-3 text-sm text-subtle">Nenhum.</p>}
      <DocumentList dealId={dealId} docs={docs} itemOptions={itemOptions} />
    </section>
  );
}
