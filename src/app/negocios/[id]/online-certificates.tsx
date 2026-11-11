"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { buttonClass, FormMessage } from "@/components/ui";
import { formatBRL, formatDate } from "@/lib/domain";
import { checkIssuance, requestIssuance, runPreviews, type CertificateState } from "../certificate-actions";

export type Boleto = { id: string; label: string; line: string | null; url: string | null; due: string | null; costCents: number | null };

export type OnlineSummary = {
  qualified: boolean;
  onlineItems: number;
  previewed: number;
  positives: number;
  openFindings: number;
  issueOpen: number;
  issueDone: number;
  aiEnabled: boolean;
};

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-ok text-white" : "bg-muted text-subtle"}`}
        aria-hidden
      >
        {done ? "✓" : n}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="font-semibold text-ink">{title}</p>
        {children}
      </div>
    </li>
  );
}

/** As quatro etapas do negócio: qualificação, consulta prévia, relatório e emissão oficial. */
export function OnlineCertificates({ dealId, summary: s, boletos }: { dealId: string; summary: OnlineSummary; boletos: Boleto[] }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<CertificateState>({});
  const run = (fn: () => Promise<CertificateState>) => start(async () => setState(await fn()));
  const total = boletos.reduce((sum, b) => sum + (b.costCents ?? 0), 0);

  return (
    <section className="rounded-xl border border-line bg-surface p-6">
      <h2 className="mb-4 text-lg font-semibold text-ink">Etapas do negócio</h2>
      <ol className="space-y-5 text-sm">
        <Step n={1} title="Qualificar as partes e o objeto" done={s.qualified}>
          <p className="text-subtle">
            {s.qualified
              ? "Partes e bens cadastrados abaixo. Complete CPF/CNPJ, matrícula e cartório para as consultas encontrarem os registros."
              : "Cadastre abaixo os bens (objeto do negócio) e as partes, com CPF/CNPJ."}
          </p>
        </Step>

        <Step n={2} title="Consulta prévia das certidões (visualização)" done={s.previewed > 0}>
          <p className="text-subtle">
            O sistema consulta a visualização das {s.onlineItems} certidões online pertinentes ao negócio
            {s.aiEnabled ? " e a IA lê cada uma" : ""}. Visualização serve para análise; não substitui a certidão oficial.
          </p>
          {s.previewed > 0 && (
            <p>
              {s.previewed} de {s.onlineItems} consultadas ·{" "}
              <span className={s.positives ? "font-semibold text-danger" : "text-ok"}>
                {s.positives ? `${s.positives} com registro` : "nenhuma com registro"}
              </span>
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {s.previewed < s.onlineItems && (
              <button type="button" disabled={pending || !s.qualified || !s.onlineItems} className={buttonClass("primary")} onClick={() => run(() => runPreviews(dealId))}>
                {pending ? "Consultando…" : s.previewed ? "Consultar as que faltam" : "Consultar certidões"}
              </button>
            )}
            {s.previewed > 0 && (
              <button type="button" disabled={pending} className={buttonClass("secondary")} onClick={() => run(() => runPreviews(dealId, true))}>
                {pending ? "Consultando…" : "Consultar de novo"}
              </button>
            )}
          </div>
        </Step>

        <Step n={3} title="Relatório preliminar" done={false}>
          <p className="text-subtle">
            Inconsistências, riscos e apontamentos a partir das visualizações{s.openFindings ? ` (${s.openFindings} em aberto)` : ""}.
          </p>
          <Link href={`/negocios/${dealId}/relatorio`} className={buttonClass(s.previewed ? "primary" : "secondary")}>
            Abrir relatório preliminar
          </Link>
        </Step>

        <Step n={4} title="Se o negócio avançar: certidões oficiais" done={s.issueDone > 0 && s.issueOpen === 0}>
          <p className="text-subtle">
            Pede pela API a emissão de todas as certidões oficiais válidas do negócio. O sistema só repassa os boletos; depois do pagamento, as
            certidões chegam e são anexadas aos itens.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || !s.onlineItems}
              className={buttonClass("primary")}
              onClick={() => {
                if (!confirm("Pedir a emissão das certidões oficiais? Cada certidão gera um boleto de emolumentos.")) return;
                run(() => requestIssuance(dealId));
              }}
            >
              Requerer certidões oficiais
            </button>
            {s.issueOpen > 0 && (
              <button type="button" disabled={pending} className={buttonClass("secondary")} onClick={() => run(() => checkIssuance(dealId))}>
                Verificar pagamentos e emissões
              </button>
            )}
          </div>
          {s.issueDone > 0 && <p className="text-ok">{s.issueDone} certidões oficiais recebidas.</p>}
          {boletos.length > 0 && (
            <div className="rounded-lg border border-line">
              <p className="border-b border-line bg-muted px-3 py-2 text-xs font-semibold text-ink">
                Boletos a pagar ({boletos.length}) · total {formatBRL(total / 100)}
              </p>
              <ul className="divide-y divide-line">
                {boletos.map((b) => (
                  <li key={b.id} className="space-y-1 px-3 py-2 text-xs">
                    <p className="font-medium">{b.label}</p>
                    <p className="text-subtle">
                      {b.costCents != null && formatBRL(b.costCents / 100)}
                      {b.due && ` · vence ${formatDate(b.due)}`}
                      {b.url && (
                        <>
                          {" · "}
                          <a href={b.url} target="_blank" rel="noopener noreferrer" className="text-brand underline">abrir boleto</a>
                        </>
                      )}
                    </p>
                    {b.line && (
                      <p className="flex flex-wrap items-center gap-2">
                        <code className="break-all rounded bg-muted px-1.5 py-0.5">{b.line}</code>
                        <button type="button" className="text-brand underline" onClick={() => navigator.clipboard?.writeText(b.line!)}>copiar</button>
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Step>
      </ol>
      <div className="mt-4">
        <FormMessage error={state.error} info={state.message} />
      </div>
    </section>
  );
}
