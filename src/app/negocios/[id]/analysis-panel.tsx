"use client";

import { useState, useTransition } from "react";
import type { AnalysisRow } from "@/lib/db-types";
import { ITEM_STATUS_LABEL } from "@/lib/domain";
import { SEVERITY_LABEL, SEVERITY_STYLE, sortBySeverity } from "@/lib/findings";
import { analyzeDocument, applySuggestedStatus } from "../analysis-actions";

const CONFIDENCE_LABEL = { alta: "confiança alta", media: "confiança média", baixa: "confiança baixa" } as const;

/** Botão "Ler com IA" e o resultado da última leitura do documento. */
export function AnalysisPanel({
  dealId, documentId, analysis, linkedToItem, aiEnabled,
}: {
  dealId: string;
  documentId: string;
  analysis?: AnalysisRow;
  linkedToItem: boolean;
  aiEnabled: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const out = analysis?.status === "concluida" ? analysis.output : null;

  return (
    <div className="mt-2 rounded-md bg-muted/50 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending || !aiEnabled}
          title={aiEnabled ? undefined : "Configure ANTHROPIC_API_KEY para ativar"}
          onClick={() => start(async () => setError((await analyzeDocument(dealId, documentId)).error))}
          className="rounded border border-brand/40 px-2 py-1 text-[11px] font-semibold text-brand hover:bg-brand/10 disabled:opacity-50"
        >
          {pending ? "Lendo o documento…" : out ? "Ler de novo com IA" : "Ler com IA"}
        </button>
        {!aiEnabled && <span className="text-[11px] text-subtle">Leitura por IA não configurada.</span>}
        {analysis?.status === "erro" && !pending && <span className="text-[11px] text-danger">Última leitura falhou: {analysis.error}</span>}
        {error && <span className="text-[11px] text-danger" role="alert">{error}</span>}
      </div>

      {out && (
        <div className="mt-2 space-y-1 text-[11px]">
          <p>
            <span className="font-semibold">Leitura da IA</span> ({CONFIDENCE_LABEL[out.confidence]}): {out.summary}
          </p>
          {!out.matches_item && out.mismatch_reason && (
            <p className="font-semibold text-danger">Não corresponde ao item: {out.mismatch_reason}</p>
          )}
          {out.findings.length > 0 && (
            <ul className="space-y-0.5">
              {sortBySeverity(out.findings).map((f, i) => (
                <li key={i}>
                  <span className={`mr-1 rounded px-1 font-semibold ${SEVERITY_STYLE[f.severity]}`}>{SEVERITY_LABEL[f.severity]}</span>
                  {f.title}
                </li>
              ))}
            </ul>
          )}
          {linkedToItem && analysis && (
            <p>
              Status sugerido: <span className="font-semibold">{ITEM_STATUS_LABEL[out.suggested_status]}</span>{" "}
              <button
                type="button"
                disabled={pending}
                className="text-brand underline"
                onClick={() => start(async () => setError((await applySuggestedStatus(dealId, analysis.id)).error))}
              >
                aplicar ao item
              </button>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
