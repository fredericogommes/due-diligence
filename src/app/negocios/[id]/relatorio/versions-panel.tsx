"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { buttonClass, FormMessage } from "@/components/ui";
import { nextReportStatus, REPORT_STATUS_LABEL, type ReportStatus } from "@/lib/members";
import { CONCLUSION_LABEL, type Conclusion } from "@/lib/report/build";
import { advanceReportVersion, createReportVersion, deleteReportVersion } from "./actions";

export type VersionItem = {
  id: string;
  version: number;
  status: ReportStatus;
  conclusion: Conclusion;
  createdLabel: string;
  createdBy: string;
  reviewedLabel: string | null;
  signedLabel: string | null;
};

const STATUS_CLASS: Record<ReportStatus, string> = {
  rascunho: "bg-muted text-subtle",
  revisado: "bg-warn/15 text-warn",
  assinado: "bg-ok/15 text-ok",
};

/** Versões congeladas do relatório (só na tela). */
export function VersionsPanel({ dealId, versions, canSign }: { dealId: string; versions: VersionItem[]; canSign: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const run = (fn: () => Promise<{ error?: string }>) => start(async () => setError((await fn()).error));

  return (
    <section className="space-y-3 rounded-xl border border-line bg-surface p-5 print:hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Versões do relatório</h2>
          <p className="text-sm text-subtle">
            “Salvar versão” congela o relatório como está agora (checklist, riscos e parecer). A versão passa por rascunho → revisado → assinado
            e não muda mais. Salve o parecer antes de salvar a versão.
          </p>
        </div>
        <button type="button" disabled={pending} className={buttonClass("primary")} onClick={() => run(() => createReportVersion(dealId))}>
          {pending ? "Salvando…" : "Salvar versão"}
        </button>
      </div>

      {versions.length === 0 ? (
        <p className="text-sm text-subtle">Nenhuma versão salva ainda.</p>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {versions.map((v) => {
            const next = nextReportStatus(v.status);
            return (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <div>
                  <Link href={`/negocios/${dealId}/relatorio/versoes/${v.version}`} className="font-medium text-brand underline">
                    Versão {v.version}
                  </Link>{" "}
                  <span className={`ml-1 rounded-full px-2 py-0.5 text-xs ${STATUS_CLASS[v.status]}`}>{REPORT_STATUS_LABEL[v.status]}</span>{" "}
                  <span className="text-subtle">· {CONCLUSION_LABEL[v.conclusion]}</span>
                  <p className="text-xs text-subtle">
                    Salva por {v.createdBy} em {v.createdLabel}
                    {v.reviewedLabel && ` · revisada ${v.reviewedLabel}`}
                    {v.signedLabel && ` · assinada ${v.signedLabel}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  {next && canSign && (
                    <button
                      type="button"
                      disabled={pending}
                      className={buttonClass("secondary")}
                      onClick={() => {
                        if (next === "assinado" && !confirm(`Assinar a versão ${v.version}? Depois de assinada ela não pode ser alterada nem apagada.`)) return;
                        run(() => advanceReportVersion(dealId, v.id, next));
                      }}
                    >
                      {next === "revisado" ? "Marcar como revisada" : "Assinar"}
                    </button>
                  )}
                  {v.status === "rascunho" && (
                    <button
                      type="button"
                      disabled={pending}
                      className={buttonClass("danger")}
                      onClick={() => confirm(`Apagar o rascunho da versão ${v.version}?`) && run(() => deleteReportVersion(dealId, v.id))}
                    >
                      Apagar
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {!canSign && <p className="text-xs text-subtle">Só quem tem a permissão de revisor jurídico revisa e assina versões (o dono concede na página da organização).</p>}
      <FormMessage error={error} />
    </section>
  );
}
