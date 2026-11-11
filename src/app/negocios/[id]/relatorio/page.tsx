import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { todaySaoPaulo } from "@/lib/checklist/validity";
import { loadDeal } from "@/lib/deals/load";
import { buildReport } from "@/lib/report/build";
import { createClient } from "@/lib/supabase/server";
import { OpinionEditor, type OpinionData } from "./opinion-editor";
import { PrintButton } from "./print-button";
import { ReportDocument } from "./report-document";

export const metadata: Metadata = { title: "Relatório preliminar · Due Diligence" };

export default function ReportPage({ params }: PageProps<"/negocios/[id]/relatorio">) {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-subtle">Montando o relatório…</p>}>
      <Report params={params} />
    </Suspense>
  );
}

async function Report({ params }: { params: PageProps<"/negocios/[id]/relatorio">["params"] }) {
  const { id } = await params;
  const data = await loadDeal(id);
  if (!data) notFound();
  const supabase = await createClient();
  const { data: opinion } = await supabase
    .from("deal_opinions")
    .select("conclusion, opinion, signer_name, signer_registration")
    .eq("deal_id", id)
    .maybeSingle<OpinionData>();

  const report = buildReport(data, todaySaoPaulo());
  const conclusion = opinion?.conclusion ?? report.suggestedConclusion;

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 print:max-w-none print:px-0 print:py-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/negocios/${id}`} className="text-sm text-subtle hover:text-brand">← Voltar ao negócio</Link>
        <PrintButton />
      </div>

      <div className="mb-6 print:hidden">
        <OpinionEditor dealId={id} suggested={report.suggestedConclusion} opinion={opinion ?? null} />
      </div>

      <ReportDocument report={report} conclusion={conclusion} opinion={opinion ?? null} />
    </div>
  );
}
