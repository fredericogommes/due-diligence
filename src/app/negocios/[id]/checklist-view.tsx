"use client";

import { useState, useTransition } from "react";
import { inputClass } from "@/components/ui";
import type { ChecklistEntry, ChecklistSection, ChecklistSummary } from "@/lib/checklist/build";
import { ITEM_STATUS_LABEL, ITEM_STATUSES, type ItemStatus } from "@/lib/domain";
import { updateItem } from "../actions";
import { DocumentList, DocumentUploader, type ItemOption } from "./documents";

export const STATUS_STYLE: Record<ItemStatus, string> = {
  completo: "bg-ok/15 text-ok border-ok/30",
  parcial: "bg-warn/15 text-warn border-warn/30",
  faltante: "bg-danger/10 text-danger border-danger/30",
  dispensado: "bg-muted text-subtle border-line",
};

export function ChecklistView({
  dealId, sections, summary, itemOptions,
}: {
  dealId: string;
  sections: ChecklistSection[];
  summary: ChecklistSummary;
  itemOptions: ItemOption[];
}) {
  const [filter, setFilter] = useState<ItemStatus | "todos">("todos");

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Checklist</h2>
          <p className="text-sm text-subtle">
            {summary.total === 0
              ? "Os itens aparecem conforme você cadastra bens e partes."
              : `${summary.completo} completos · ${summary.parcial} parciais · ${summary.faltante} faltantes · ${summary.dispensado} dispensados`}
          </p>
          {summary.vencidos > 0 && (
            <p className="text-sm font-semibold text-danger">
              {summary.vencidos} {summary.vencidos === 1 ? "item marcado como atendido tem" : "itens marcados como atendidos têm"} documento vencido.
            </p>
          )}
        </div>
        {summary.total > 0 && (
          <div className="flex flex-wrap gap-1 text-xs" role="group" aria-label="Filtrar por status">
            {(["todos", ...ITEM_STATUSES] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(s)}
                aria-pressed={filter === s}
                className={`rounded-full border px-3 py-1 ${filter === s ? "border-brand bg-brand text-white" : "border-line hover:bg-muted"}`}
              >
                {s === "todos" ? "Todos" : ITEM_STATUS_LABEL[s]} ({s === "todos" ? summary.total : summary[s]})
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-6">
        {sections.map((sec) => {
          const entries = sec.entries.filter((e) => filter === "todos" || e.status === filter);
          if (!entries.length) return null;
          return (
            <div key={sec.name}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand">{sec.name}</h3>
              <ul className="divide-y divide-line rounded-lg border border-line">
                {entries.map((e) => <ItemRow key={e.id} dealId={dealId} entry={e} itemOptions={itemOptions} />)}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ItemRow({ dealId, entry, itemOptions }: { dealId: string; entry: ChecklistEntry; itemOptions: ItemOption[] }) {
  const [attaching, setAttaching] = useState(false);
  const [status, setStatus] = useState<ItemStatus>(entry.status);
  const [notes, setNotes] = useState(entry.notes ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();

  const save = (nextStatus: ItemStatus, nextNotes: string) =>
    start(async () => {
      const r = await updateItem(dealId, { itemId: entry.id, status: nextStatus, notes: nextNotes });
      setError(r.error);
      if (r.error) setStatus(entry.status);
    });

  return (
    <li className="grid gap-3 p-3 sm:grid-cols-[1fr_auto]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-mono text-xs text-subtle">{entry.code}</span>
          <span className="font-medium">{entry.title}</span>
          {!entry.required && <span className="text-xs text-subtle">(se aplicável)</span>}
        </div>
        {entry.subject && <div className="text-xs font-medium text-ink">{entry.subject}</div>}
        {entry.description && <p className="mt-0.5 text-xs text-subtle">{entry.description}</p>}
        {entry.validityDays && <p className="mt-0.5 text-xs text-subtle">Prazo de referência: {entry.validityDays} dias da emissão.</p>}
        <textarea
          aria-label={`Observação de ${entry.code}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== (entry.notes ?? "") && save(status, notes)}
          placeholder="Observação da análise"
          rows={1}
          maxLength={2000}
          className={`${inputClass} mt-2 resize-y text-xs`}
        />
        {entry.expiredWarning && (
          <p className="mt-1 text-xs font-semibold text-danger">Atenção: o documento deste item está vencido — peça uma certidão atualizada.</p>
        )}
        <DocumentList dealId={dealId} docs={entry.documents} itemOptions={itemOptions} />
        <button type="button" className="mt-2 text-xs font-semibold text-brand hover:underline" onClick={() => setAttaching((a) => !a)}>
          {attaching ? "Cancelar" : entry.documents.length ? "+ Anexar outro documento" : "+ Anexar documento"}
        </button>
        {attaching && <DocumentUploader dealId={dealId} itemId={entry.id} onDone={() => setAttaching(false)} />}
        {error && <p className="mt-1 text-xs text-danger" role="alert">{error}</p>}
      </div>
      <div>
        <select
          aria-label={`Status de ${entry.code}`}
          value={status}
          disabled={pending}
          onChange={(e) => {
            const s = e.target.value as ItemStatus;
            setStatus(s);
            save(s, notes);
          }}
          className={`rounded-md border px-2 py-1 text-xs font-semibold ${STATUS_STYLE[status]}`}
        >
          {ITEM_STATUSES.map((s) => <option key={s} value={s}>{ITEM_STATUS_LABEL[s]}</option>)}
        </select>
      </div>
    </li>
  );
}
