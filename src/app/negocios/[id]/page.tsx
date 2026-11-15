import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LoadingSkeleton } from "@/components/ui";
import { AppHeader } from "@/components/app-header";
import { assetLabel, buildChecklist, partyLabel, summarize, unassignedDocuments } from "@/lib/checklist/build";
import { todaySaoPaulo } from "@/lib/checklist/validity";
import { isOnlineItem, pickProvider } from "@/lib/certidoes/providers";
import { subjectFromRows } from "@/lib/certidoes/subject";
import type { CertInfo } from "./certificate-request";
import { loadDeal } from "@/lib/deals/load";
import { DEAL_KIND_LABEL, formatBRL, formatDate } from "@/lib/domain";
import { AssetsSection } from "./assets-section";
import { ChecklistView } from "./checklist-view";
import { DealActions } from "./deal-actions";
import { DealPeople } from "./deal-people";
import { StaleBanner } from "@/components/stale-banner";
import { staleSince } from "@/lib/report/staleness";
import { createClient } from "@/lib/supabase/server";
import { STAGE_LABEL, type Stage } from "@/lib/board";
import type { MemberView } from "@/lib/members";
import { ExtraDocuments } from "./extra-documents";
import { FindingsSection } from "./findings-section";
import { OnlineCertificates, type Boleto } from "./online-certificates";
import { PartiesSection } from "./parties-section";

export const metadata: Metadata = { title: "Negócio · Due Diligence" };

/** A leitura por IA de um PDF grande pode levar mais de um minuto (Server Action desta página). */
export const maxDuration = 300;

export default function DealPage({ params }: PageProps<"/negocios/[id]">) {
  return (
    <>
      <AppHeader current="negocios" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Link href="/negocios" className="text-sm text-subtle hover:text-brand">← Negócios</Link>
        <Suspense fallback={<div className="mt-4"><LoadingSkeleton /></div>}>
          <DealDetail params={params} />
        </Suspense>
      </main>
    </>
  );
}

async function DealDetail({ params }: { params: PageProps<"/negocios/[id]">["params"] }) {
  const { id } = await params;
  const data = await loadDeal(id);
  if (!data) notFound();
  const { deal, parties, assets, items, templateItems, orgName, documents, latestAnalysis, findings, certRequests } = data;
  const supabase = await createClient();
  const [{ data: memberData }, { data: extra }, { data: versionRows }] = await Promise.all([
    supabase.rpc("org_members", { p_org: deal.org_id }),
    supabase.from("deals").select("stage, assignee_id, client_id").eq("id", deal.id).maybeSingle<{ stage: Stage; assignee_id: string | null; client_id: string | null }>(),
    supabase.from("report_versions").select("version, status, created_at").eq("deal_id", deal.id).returns<{ version: number; status: string; created_at: string }[]>(),
  ]);
  const stale = staleSince(versionRows ?? [], { documents, findings, parties, assets });
  const people = ((memberData as MemberView[] | null) ?? []).map((m) => ({ id: m.user_id, name: m.full_name ?? m.email, role: m.role }));
  const ai = { analyses: latestAnalysis, aiEnabled: Boolean(process.env.ANTHROPIC_API_KEY) };
  const today = todaySaoPaulo();
  const sections = buildChecklist(items, templateItems, parties, assets, documents, today);
  const summary = summarize(sections);
  const tplById = new Map(templateItems.map((t) => [t.id, t]));
  const certs: Record<string, CertInfo> = {};
  const boletos: Boleto[] = [];
  let onlineItems = 0;
  for (const it of items) {
    const t = tplById.get(it.template_item_id);
    if (!t) continue;
    const online = isOnlineItem(t.code) && it.status !== "dispensado";
    if (online) onlineItems++;
    const choice = pickProvider(subjectFromRows(it, t, parties, assets), "emissao");
    const issue = certRequests.find((r) => r.deal_item_id === it.id && r.mode === "emissao") ?? null;
    certs[it.id] = {
      online: isOnlineItem(t.code),
      source: choice.ok ? { ok: true, name: choice.provider.name } : { ok: false, reason: choice.reason },
      issue,
    };
    if (issue?.status === "aguardando_pagamento") {
      const p = it.party_id ? parties.find((x) => x.id === it.party_id) : undefined;
      const a = it.asset_id ? assets.find((x) => x.id === it.asset_id) : undefined;
      boletos.push({
        id: issue.id,
        label: `${t.code} · ${t.title}${p ? ` — ${partyLabel(p)}` : a ? ` — ${assetLabel(a)}` : ""}`,
        line: issue.boleto_line,
        url: issue.boleto_url,
        due: issue.boleto_due,
        costCents: issue.cost_cents,
      });
    }
  }
  const latestIssues = Object.values(certs).map((c) => c.issue).filter((i) => i !== null);
  const online = {
    qualified: assets.length > 0 && parties.length > 0,
    onlineItems,
    previewed: summary.previewed,
    positives: summary.previewPositive,
    openFindings: findings.filter((f) => !f.resolved).length,
    issueOpen: latestIssues.filter((i) => i.status === "aguardando_pagamento" || i.status === "pendente").length,
    issueDone: latestIssues.filter((i) => i.status === "concluido").length,
    aiEnabled: ai.aiEnabled,
    reportSigned: (versionRows ?? []).some((v) => v.status === "assinado"),
  };
  const itemOptions = sections.flatMap((s) =>
    s.entries.map((e) => ({ id: e.id, label: `${e.code} · ${e.title}${e.subject ? ` (${e.subject})` : ""}` })),
  );

  return (
    <div className="mt-2 space-y-8">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{deal.title}</h1>
          <p className="mt-1 text-sm text-subtle">
            {DEAL_KIND_LABEL[deal.kind]} · {orgName} · valor {formatBRL(deal.price)} · criado em {formatDate(deal.created_at)}
          </p>
          {extra && <p className="mt-1 text-sm">Etapa: <strong>{STAGE_LABEL[extra.stage]}</strong></p>}
          {deal.notes && <p className="mt-2 max-w-3xl whitespace-pre-line text-sm">{deal.notes}</p>}
          <div className="mt-3">
            <DealPeople
              dealId={deal.id}
              assigneeId={extra?.assignee_id ?? null}
              clientId={extra?.client_id ?? null}
              staff={people.filter((p) => p.role !== "cliente")}
              clients={people.filter((p) => p.role === "cliente")}
            />
          </div>
        </div>
        <DealActions dealId={deal.id} status={deal.status} />
      </section>

      {stale && <StaleBanner s={stale} href={`/negocios/${deal.id}/relatorio`} />}

      <OnlineCertificates dealId={deal.id} summary={online} boletos={boletos} />

      <div className="grid gap-6 lg:grid-cols-2">
        <AssetsSection dealId={deal.id} dealKind={deal.kind} assets={assets} />
        <PartiesSection dealId={deal.id} dealKind={deal.kind} parties={parties} />
      </div>

      <FindingsSection dealId={deal.id} findings={findings} itemOptions={itemOptions} />

      <ChecklistView dealId={deal.id} sections={sections} summary={summary} itemOptions={itemOptions} ai={ai} certs={certs} />

      <ExtraDocuments dealId={deal.id} docs={unassignedDocuments(documents, today)} itemOptions={itemOptions} ai={ai} />
    </div>
  );
}
