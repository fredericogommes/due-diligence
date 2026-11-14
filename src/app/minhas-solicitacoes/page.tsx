import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { CLIENT_STAGE_LABEL, STAGES, type Stage } from "@/lib/board";
import { DEAL_KIND_LABEL, formatBRL, formatDate, type DealKind } from "@/lib/domain";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";
import { CopyButton } from "./copy-button";
import { NewRequestForm } from "./new-request-form";

export const metadata: Metadata = { title: "Minhas solicitações · Due Diligence" };

type Boleto = { item: string; line: string | null; url: string | null; due: string | null; cost_cents: number | null };
type Request = {
  id: string;
  org_name: string;
  title: string;
  kind: DealKind;
  price: string | null;
  stage: Stage;
  created_at: string;
  previews: number;
  issued: number;
  signed_version: number | null;
  boletos: Boleto[];
};

export default function ClientRequestsPage() {
  return (
    <>
      <AppHeader current="solicitacoes" />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight text-ink">Minhas solicitações</h1>
        <Suspense fallback={<p className="text-sm text-subtle">Carregando…</p>}>
          <Requests />
        </Suspense>
      </main>
    </>
  );
}

/** Mensagem simples do que está acontecendo, para o cliente. */
function statusText(r: Request): string {
  if (r.boletos.length) return "Há boletos de emolumentos para você pagar. Depois do pagamento as certidões oficiais são emitidas.";
  switch (r.stage) {
    case "qualificacao":
      return "Recebemos sua solicitação. A equipe está conferindo os dados das partes e do imóvel ou empresa.";
    case "consulta":
      return "Estamos consultando as certidões do negócio.";
    case "analise":
      return r.signed_version
        ? "O relatório preliminar está pronto. Se quiser seguir com o negócio, fale com a equipe para pedir as certidões oficiais."
        : "As certidões foram consultadas e a equipe está preparando o relatório preliminar.";
    case "emissao":
      return "As certidões oficiais estão sendo emitidas.";
    case "concluido":
      return "Solicitação concluída.";
  }
}

async function Requests() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");
  const supabase = await createClient();
  const [{ data: reqData }, { data: orgData }] = await Promise.all([supabase.rpc("my_client_requests"), supabase.rpc("my_client_orgs")]);
  const requests = (reqData as Request[] | null) ?? [];
  const orgs = (orgData as { org_id: string; org_name: string }[] | null) ?? [];

  if (!orgs.length) {
    return (
      <p className="rounded-xl border border-line bg-surface p-6 text-sm text-subtle">
        Você ainda não é cliente de nenhum escritório. Peça ao escritório um convite para o seu e-mail; ele aparece em{" "}
        <Link href="/" className="text-brand underline">Organizações</Link>.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {requests.length === 0 && (
        <p className="rounded-xl border border-line bg-surface p-6 text-sm text-subtle">Nenhuma solicitação ainda. Abra a primeira abaixo.</p>
      )}
      {requests.map((r) => {
        const current = STAGES.indexOf(r.stage);
        const total = r.boletos.reduce((s, b) => s + (b.cost_cents ?? 0), 0);
        return (
          <article key={r.id} className="space-y-4 rounded-xl border border-line bg-surface p-6">
            <div>
              <h2 className="text-lg font-semibold text-ink">{r.title}</h2>
              <p className="text-sm text-subtle">
                {DEAL_KIND_LABEL[r.kind]}
                {r.price ? ` · ${formatBRL(r.price)}` : ""} · {r.org_name} · aberta em {formatDate(r.created_at)}
              </p>
            </div>

            <ol className="grid gap-2 sm:grid-cols-5" aria-label="Andamento">
              {STAGES.map((s, i) => (
                <li key={s} className="flex items-center gap-2 sm:flex-col sm:items-start" aria-current={i === current ? "step" : undefined}>
                  <span
                    className={`h-1.5 w-8 rounded-full sm:w-full ${i < current || r.stage === "concluido" ? "bg-ok" : i === current ? "bg-brand" : "bg-muted"}`}
                    aria-hidden
                  />
                  <span className={`text-xs ${i === current ? "font-semibold text-ink" : "text-subtle"}`}>{CLIENT_STAGE_LABEL[s]}</span>
                </li>
              ))}
            </ol>

            <p className="text-sm">{statusText(r)}</p>

            {r.boletos.length > 0 && (
              <div className="rounded-lg border border-line">
                <p className="border-b border-line bg-muted px-3 py-2 text-xs font-semibold text-ink">
                  Boletos a pagar ({r.boletos.length}) · total {formatBRL(total / 100)}
                </p>
                <ul className="divide-y divide-line">
                  {r.boletos.map((b, i) => (
                    <li key={i} className="space-y-1 px-3 py-2 text-xs">
                      <p className="font-medium">{b.item}</p>
                      <p className="text-subtle">
                        {b.cost_cents != null && formatBRL(b.cost_cents / 100)}
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
                          <CopyButton text={b.line} />
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap gap-4 text-sm">
              {r.signed_version ? (
                <Link href={`/minhas-solicitacoes/${r.id}`} className="font-semibold text-brand underline">
                  Ver relatório preliminar (versão {r.signed_version})
                </Link>
              ) : (
                <span className="text-subtle">Relatório preliminar: ainda não disponível</span>
              )}
              {r.issued > 0 && <span className="text-ok">{r.issued} certidões oficiais emitidas</span>}
            </div>
          </article>
        );
      })}

      <section className="space-y-4 rounded-xl border border-line bg-surface p-6">
        <h2 className="text-lg font-semibold text-ink">Nova solicitação</h2>
        <NewRequestForm orgs={orgs} />
      </section>
    </div>
  );
}
