import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PrintButton } from "@/app/negocios/[id]/relatorio/print-button";
import { ReportDocument } from "@/app/negocios/[id]/relatorio/report-document";
import { formatDateTime } from "@/lib/audit";
import type { ReportSnapshot } from "@/lib/report/build";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Relatório preliminar · Due Diligence" };

export default function ClientReportPage({ params }: PageProps<"/minhas-solicitacoes/[id]">) {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-subtle">Abrindo o relatório…</p>}>
      <ClientReport params={params} />
    </Suspense>
  );
}

async function ClientReport({ params }: { params: PageProps<"/minhas-solicitacoes/[id]">["params"] }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc("client_signed_report", { p_deal: id });
  const v = (data as { version: number; signed_at: string; snapshot: ReportSnapshot }[] | null)?.[0];
  if (!v) notFound();
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 print:max-w-none print:px-0 print:py-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/minhas-solicitacoes" className="text-sm text-subtle hover:text-brand">← Minhas solicitações</Link>
        <PrintButton />
      </div>
      <p className="mb-4 rounded-md border border-ok px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-ok">
        Versão {v.version} · assinada em {formatDateTime(v.signed_at)}
      </p>
      <ReportDocument report={v.snapshot.report} conclusion={v.snapshot.conclusion} opinion={v.snapshot.opinion} showScope />
    </div>
  );
}
