import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { todaySaoPaulo } from "@/lib/checklist/validity";
import { loadDeal } from "@/lib/deals/load";
import { buildReport } from "@/lib/report/build";
import { formatDateTime } from "@/lib/audit";
import { canSignReports, type MemberRole } from "@/lib/members";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";
import { OpinionEditor, type OpinionData } from "./opinion-editor";
import { VersionsPanel, type VersionItem } from "./versions-panel";
import { StaleBanner } from "@/components/stale-banner";
import { staleSince } from "@/lib/report/staleness";
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
  const userId = await getCurrentUserId();
  const [{ data: opinion }, { data: versions }, { data: membership }, { data: profiles }] = await Promise.all([
    supabase
      .from("deal_opinions")
      .select("conclusion, opinion, signer_name, signer_registration")
      .eq("deal_id", id)
      .maybeSingle<OpinionData>(),
    supabase
      .from("report_versions")
      .select("id, version, status, conclusion, created_by, created_at, reviewed_by, reviewed_at, signed_by, signed_at")
      .eq("deal_id", id)
      .order("version", { ascending: false })
      .returns<VersionRow[]>(),
    supabase.from("memberships").select("role, legal_reviewer").eq("org_id", data.deal.org_id).eq("user_id", userId ?? "").maybeSingle<{ role: MemberRole; legal_reviewer: boolean }>(),
    supabase.from("profiles").select("id, full_name").returns<{ id: string; full_name: string | null }[]>(),
  ]);
  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "Sem nome"]));
  const who = (uid: string | null) => (uid ? (names.get(uid) ?? "ex-membro") : "—");
  const versionItems: VersionItem[] = (versions ?? []).map((v) => ({
    id: v.id,
    version: v.version,
    status: v.status,
    conclusion: v.conclusion,
    createdBy: who(v.created_by),
    createdLabel: formatDateTime(v.created_at),
    reviewedLabel: v.reviewed_at ? `por ${who(v.reviewed_by)} em ${formatDateTime(v.reviewed_at)}` : null,
    signedLabel: v.signed_at ? `por ${who(v.signed_by)} em ${formatDateTime(v.signed_at)}` : null,
  }));

  const stale = staleSince(versions ?? [], data);
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

      {stale && <div className="mb-4"><StaleBanner s={stale} /></div>}
      <div className="mb-6 print:hidden">
        <VersionsPanel dealId={id} versions={versionItems} canSign={canSignReports(membership)} />
      </div>

      <p className="mb-2 text-xs text-subtle print:hidden">Abaixo, o relatório com os dados de agora (ainda não congelado numa versão).</p>
      <ReportDocument report={report} conclusion={conclusion} opinion={opinion ?? null} showScope />
    </div>
  );
}

type VersionRow = Omit<VersionItem, "createdBy" | "createdLabel" | "reviewedLabel" | "signedLabel"> & {
  created_by: string | null;
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  signed_by: string | null;
  signed_at: string | null;
};
