"use client";

import { useActionState, useState, useTransition } from "react";
import { Field, FormMessage, inputClass, SubmitButton } from "@/components/ui";
import type { FindingRow } from "@/lib/db-types";
import { SEVERITIES, SEVERITY_LABEL, SEVERITY_STYLE, sortBySeverity } from "@/lib/findings";
import { addFinding, deleteFinding, setFindingResolved, type FindingState } from "../finding-actions";
import type { ItemOption } from "./documents";

/** Riscos e pendências do negócio (da IA e manuais) — base do parecer. */
export function FindingsSection({ dealId, findings, itemOptions }: { dealId: string; findings: FindingRow[]; itemOptions: ItemOption[] }) {
  const [state, action] = useActionState<FindingState, FormData>(addFinding, {});
  const [adding, setAdding] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const itemLabel = new Map(itemOptions.map((o) => [o.id, o.label]));
  const open = sortBySeverity(findings.filter((f) => !f.resolved));
  const resolved = findings.filter((f) => f.resolved);
  const shown = showResolved ? [...open, ...resolved] : open;
  const counts = SEVERITIES.map((s) => `${open.filter((f) => f.severity === s).length} ${SEVERITY_LABEL[s].toLowerCase()}`).join(", ");

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-ink">Riscos e apontamentos</h2>
          <p className="text-sm text-subtle">
            {open.length} em aberto{open.length > 0 && ` (${counts})`}
            {resolved.length > 0 && ` · ${resolved.length} resolvidos`}
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          {resolved.length > 0 && (
            <button type="button" className="text-subtle hover:underline" onClick={() => setShowResolved((s) => !s)}>
              {showResolved ? "Ocultar resolvidos" : "Mostrar resolvidos"}
            </button>
          )}
          <button type="button" className="text-brand hover:underline" onClick={() => setAdding((a) => !a)}>
            {adding ? "Cancelar" : "Adicionar apontamento"}
          </button>
        </div>
      </div>

      {adding && (
        <form key={state.at ?? 0} action={action} className="mb-4 grid gap-3 rounded-lg border border-dashed border-line p-3 sm:grid-cols-2">
          <input type="hidden" name="dealId" value={dealId} />
          <Field label="Gravidade">
            <select name="severity" className={inputClass} defaultValue="medio">
              {SEVERITIES.map((s) => <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>)}
            </select>
          </Field>
          <Field label="Item relacionado" hint="Opcional">
            <select name="dealItemId" className={inputClass} defaultValue="">
              <option value="">Nenhum</option>
              {itemOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Apontamento"><input name="title" required minLength={2} maxLength={300} className={inputClass} /></Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Detalhes"><textarea name="description" rows={2} maxLength={4000} className={inputClass} /></Field>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <FormMessage error={state.error} />
            <SubmitButton>Registrar</SubmitButton>
          </div>
        </form>
      )}

      {shown.length === 0 ? (
        <p className="text-sm text-subtle">Nenhum apontamento. A leitura por IA dos documentos registra os riscos aqui; você também pode anotar à mão.</p>
      ) : (
        <ul className="divide-y divide-line">
          {shown.map((f) => (
            <li key={f.id} className={`flex gap-3 py-2 text-sm ${f.resolved ? "opacity-60" : ""}`}>
              <span className={`h-fit shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${SEVERITY_STYLE[f.severity]}`}>{SEVERITY_LABEL[f.severity]}</span>
              <div className="min-w-0 flex-1">
                <div className={`font-medium ${f.resolved ? "line-through" : ""}`}>{f.title}</div>
                {f.description && <p className="text-xs text-subtle">{f.description}</p>}
                {f.evidence && <p className="text-xs italic text-subtle">&ldquo;{f.evidence}&rdquo;</p>}
                <p className="text-[11px] text-subtle">
                  {f.source === "ia" ? "Leitura por IA" : "Manual"}
                  {f.deal_item_id && itemLabel.get(f.deal_item_id) ? ` · ${itemLabel.get(f.deal_item_id)}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                <button type="button" disabled={pending} className="text-brand hover:underline"
                  onClick={() => start(async () => setError((await setFindingResolved(dealId, f.id, !f.resolved)).error))}>
                  {f.resolved ? "Reabrir" : "Resolver"}
                </button>
                <button type="button" disabled={pending} className="text-danger hover:underline"
                  onClick={() => {
                    if (!confirm("Apagar este apontamento?")) return;
                    start(async () => setError((await deleteFinding(dealId, f.id)).error));
                  }}>
                  Apagar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <FormMessage error={error} />
    </section>
  );
}
