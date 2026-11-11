import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { formatDateTime } from "@/lib/audit";
import { REPORT_STATUS_LABEL, type ReportStatus } from "@/lib/members";
import type { ReportSnapshot } from "@/lib/report/build";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "../../print-button";
import { ReportDocument } from "../../report-document";

export const metadata: Metadata = { title: "Versão do relatório · Due Diligence" };

export default function ReportVersionPage({ params }: PageProps<"/negocios/[id]/relatorio/versoes/[version]">) {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-subtle">Abrindo a versão…</p>}>
      <ReportVersion params={params} />
    </Suspense>
  );
}

type VersionRow = {
  version: number;
  status: ReportStatus;
  snapshot: ReportSnapshot;
  created_at: string;
  signed_at: string | null;
  signed_by: string | null;
};

async function ReportVersion({ params }: { params: PageProps<"/negocios/[id]/relatorio/versoes/[version]">["params"] }) {
  const { id, version } = await params;
  const n = Number(version);
  if (!/^[0-9a-f-]{36}$/i.test(id) || !Number.isInteger(n) || n < 1) notFound();
  const supabase = await createClient();
  const { data: v } = await supabase
    .from("report_versions")
    .select("version, status, snapshot, created_at, signed_at, signed_by")
    .eq("deal_id", id)
    .eq("version", n)
    .maybeSingle<VersionRow>();
  if (!v) notFound();

  let signer: string | null = null;
  if (v.signed_by) {
    const { data: p } = await supabase.from("profiles").select("full_name").eq("id", v.signed_by).maybeSingle<{ full_name: string | null }>();
    signer = p?.full_name ?? null;
  }

  const stamp =
    v.status === "assinado" && v.signed_at
      ? `Versão ${v.version} · assinada${signer ? ` por ${signer}` : ""} em ${formatDateTime(v.signed_at)}`
      : `Versão ${v.version} · ${REPORT_STATUS_LABEL[v.status].toUpperCase()} · salva em ${formatDateTime(v.created_at)}`;

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 print:max-w-none print:px-0 print:py-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/negocios/${id}/relatorio`} className="text-sm text-subtle hover:text-brand">← Voltar ao relatório</Link>
        <PrintButton />
      </div>
      <p className={`mb-4 rounded-md border px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide ${v.status === "assinado" ? "border-ok text-ok" : "border-warn text-warn"}`}>
        {stamp}
      </p>
      <ReportDocument report={v.snapshot.report} conclusion={v.snapshot.conclusion} opinion={v.snapshot.opinion} />
    </div>
  );
}
