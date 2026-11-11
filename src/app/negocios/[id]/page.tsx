import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { buildChecklist, summarize } from "@/lib/checklist/build";
import { loadDeal } from "@/lib/deals/load";
import { DEAL_KIND_LABEL, formatBRL, formatDate } from "@/lib/domain";
import { AssetsSection } from "./assets-section";
import { ChecklistView } from "./checklist-view";
import { DealActions } from "./deal-actions";
import { PartiesSection } from "./parties-section";

export const metadata: Metadata = { title: "Negócio · Due Diligence" };

export default function DealPage({ params }: PageProps<"/negocios/[id]">) {
  return (
    <>
      <AppHeader current="negocios" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Link href="/negocios" className="text-sm text-subtle hover:text-brand">← Negócios</Link>
        <Suspense fallback={<p className="mt-4 text-sm text-subtle">Carregando…</p>}>
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
  const { deal, parties, assets, items, templateItems, orgName } = data;
  const sections = buildChecklist(items, templateItems, parties, assets);
  const summary = summarize(sections);

  return (
    <div className="mt-2 space-y-8">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">{deal.title}</h1>
          <p className="mt-1 text-sm text-subtle">
            {DEAL_KIND_LABEL[deal.kind]} · {orgName} · valor {formatBRL(deal.price)} · criado em {formatDate(deal.created_at)}
          </p>
          {deal.notes && <p className="mt-2 max-w-3xl whitespace-pre-line text-sm">{deal.notes}</p>}
        </div>
        <DealActions dealId={deal.id} status={deal.status} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <AssetsSection dealId={deal.id} dealKind={deal.kind} assets={assets} />
        <PartiesSection dealId={deal.id} dealKind={deal.kind} parties={parties} />
      </div>

      <ChecklistView dealId={deal.id} sections={sections} summary={summary} />
    </div>
  );
}
