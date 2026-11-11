import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { todaySaoPaulo } from "@/lib/checklist/validity";
import { demoReportInput } from "@/lib/demo/sample";
import { buildReport } from "@/lib/report/build";
import { PrintButton } from "@/app/negocios/[id]/relatorio/print-button";
import { ReportDocument } from "@/app/negocios/[id]/relatorio/report-document";

export const metadata: Metadata = { title: "Relatório de exemplo · Due Diligence" };

/** Demonstração do relatório com dados fictícios. Só existe em desenvolvimento. */
export default function DemoReportPage() {
  return (
    <Suspense>
      <Demo />
    </Suspense>
  );
}

async function Demo() {
  await connection();
  if (process.env.NODE_ENV === "production") notFound();
  const report = buildReport(demoReportInput(), todaySaoPaulo());
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 print:max-w-none print:p-0">
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-subtle">Exemplo com dados fictícios (só em desenvolvimento).</p>
        <PrintButton />
      </div>
      <ReportDocument
        report={report}
        conclusion={report.suggestedConclusion}
        opinion={{ conclusion: null, opinion: null, signer_name: "Fulana de Tal", signer_registration: "OAB/RJ 000.000" }}
      />
    </div>
  );
}
