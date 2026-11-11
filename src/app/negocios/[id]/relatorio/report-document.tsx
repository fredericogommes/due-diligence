import {
  ASSET_KIND_LABEL, DEAL_KIND_LABEL, formatBRL, formatDate, formatDocument, ITEM_STATUS_LABEL, MARITAL_STATUS_LABEL,
  PARTY_ROLE_LABEL, PROPERTY_REGIME_LABEL, type ItemStatus,
} from "@/lib/domain";
import { SEVERITY_LABEL } from "@/lib/findings";
import { CONCLUSION_LABEL, CONCLUSION_TEXT, type Conclusion, type ReportModel } from "@/lib/report/build";
import type { OpinionData } from "./opinion-editor";

const STATUS_CLASS: Record<ItemStatus, string> = {
  completo: "text-ok",
  parcial: "text-warn",
  faltante: "text-danger",
  dispensado: "text-subtle",
};

const CONCLUSION_CLASS: Record<Conclusion, string> = {
  viavel: "border-ok bg-ok/10",
  viavel_com_ressalvas: "border-warn bg-warn/10",
  incompleta: "border-danger bg-danger/5",
  inviavel: "border-danger bg-danger/10",
};

/** O documento do relatório (tela e impressão). */
export function ReportDocument({ report: r, conclusion, opinion }: { report: ReportModel; conclusion: Conclusion; opinion: OpinionData | null }) {
  return (
    <article className="report rounded-xl border border-line bg-white p-4 text-[13px] sm:p-8 leading-relaxed text-[#1f2433] print:rounded-none print:border-0 print:p-0">
      <header className="mb-6 border-b-2 border-[#5b3fa0] pb-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#b7791f]">{r.orgName}</p>
        <h1 className="mt-1 text-xl font-bold text-[#16264d]">RELATÓRIO PRELIMINAR DE DUE DILIGENCE</h1>
        <p className="text-sm italic text-[#5c6378]">{r.dealTitle}</p>
      </header>

      <table className="mb-6 w-full border-collapse text-sm">
        <tbody>
          <Meta label="Negócio" value={`${DEAL_KIND_LABEL[r.dealKind]}${r.price ? ` — ${formatBRL(r.price)}` : ""}`} />
          {r.assets.length > 0 && (
            <Meta
              label="Bens"
              value={r.assets
                .map((a) => `${ASSET_KIND_LABEL[a.kind]}: ${a.description}${a.matricula ? `, matrícula ${a.matricula}` : ""}${a.cartorio ? ` (${a.cartorio})` : ""}${a.cnpj ? `, CNPJ ${formatDocument(a.cnpj)}` : ""}`)
                .join("; ")}
            />
          )}
          {r.parties.length > 0 && (
            <Meta
              label="Partes"
              value={r.parties
                .map((p) => `${p.name} (${PARTY_ROLE_LABEL[p.role]}${p.document ? `, ${formatDocument(p.document)}` : ""}${p.marital_status ? `, ${MARITAL_STATUS_LABEL[p.marital_status].toLowerCase()}` : ""}${p.property_regime ? `, ${PROPERTY_REGIME_LABEL[p.property_regime].toLowerCase()}` : ""})`)
                .join("; ")}
            />
          )}
          <Meta label="Base de análise" value="Checklist documental do negócio confrontado com as visualizações da consulta prévia e com os documentos e certidões anexados" />
          <Meta label="Data" value={formatDate(r.date)} />
        </tbody>
      </table>

      <H2 n={1}>Resumo executivo</H2>
      <p className="mb-2">{r.executiveSummary}</p>
      {r.attention.length > 0 && (
        <>
          <p className="font-semibold">Pontos de maior atenção:</p>
          <ul className="mb-4 list-disc pl-6">
            {r.attention.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </>
      )}

      {r.sections.map((sec, i) => (
        <section key={sec.name} className="mb-5 break-inside-auto">
          <H2 n={i + 2}>{sec.name}</H2>
          <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full min-w-[34rem] border-collapse text-xs print:min-w-0">
            <thead>
              <tr className="bg-[#5b3fa0] text-left text-white">
                <th className="w-16 border border-[#d9dce6] px-2 py-1.5">Ref.</th>
                <th className="w-1/3 border border-[#d9dce6] px-2 py-1.5">Documento</th>
                <th className="w-24 border border-[#d9dce6] px-2 py-1.5">Status</th>
                <th className="border border-[#d9dce6] px-2 py-1.5">Observação da análise</th>
              </tr>
            </thead>
            <tbody>
              {sec.rows.map((row, j) => (
                <tr key={`${row.code}-${j}`} className="break-inside-avoid align-top odd:bg-[#f6f4fb]">
                  <td className="border border-[#d9dce6] px-2 py-1.5 font-semibold text-[#5b3fa0]">{row.code}</td>
                  <td className="border border-[#d9dce6] px-2 py-1.5">
                    {row.title}
                    {!row.required && <span className="text-[#5c6378]"> (se aplicável)</span>}
                    {row.subject && <div className="text-[11px] text-[#5c6378]">{row.subject}</div>}
                  </td>
                  <td className={`border border-[#d9dce6] px-2 py-1.5 font-bold uppercase ${STATUS_CLASS[row.status]}`}>
                    {ITEM_STATUS_LABEL[row.status]}
                    {row.expired && <div className="text-[10px] text-danger">doc. vencido</div>}
                  </td>
                  <td className="border border-[#d9dce6] px-2 py-1.5">{row.observation}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>
      ))}

      {r.findings.length > 0 && (
        <section className="mb-5">
          <H2 n={r.sections.length + 2}>Riscos e apontamentos em aberto</H2>
          <ul className="space-y-1.5">
            {r.findings.map((f) => (
              <li key={f.id} className="break-inside-avoid">
                <strong>[{SEVERITY_LABEL[f.severity]}]</strong> {f.title}
                {f.description && <span>: {f.description}</span>}
                {f.evidence && <span className="italic text-[#5c6378]"> (“{f.evidence}”)</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {r.extraDocuments.length > 0 && (
        <section className="mb-5">
          <H2 n={r.sections.length + (r.findings.length ? 3 : 2)}>Documentos adicionais (fora do checklist)</H2>
          <ul className="list-disc pl-6">
            {r.extraDocuments.map((d, i) => <li key={i}><strong>{d.name}</strong>: {d.description}</li>)}
          </ul>
        </section>
      )}

      <section className="break-inside-avoid">
        <H2>Parecer</H2>
        {opinion?.opinion && <p className="mb-3 whitespace-pre-line">{opinion.opinion}</p>}
        {r.recommendations.length > 0 && (
          <>
            <p className="font-semibold">Recomendações:</p>
            <ul className="mb-4 list-disc pl-6">
              {r.recommendations.map((x, i) => <li key={i}>{x}</li>)}
            </ul>
          </>
        )}
        <div className={`mb-6 rounded border-l-4 p-3 ${CONCLUSION_CLASS[conclusion]}`}>
          <p>
            Conclusão: <strong>{CONCLUSION_LABEL[conclusion]}</strong>. {CONCLUSION_TEXT[conclusion]}
          </p>
        </div>

        <div className="mt-10 text-center">
          <div className="mx-auto mb-1 w-72 border-t border-[#16264d]" />
          <p className="font-semibold">{opinion?.signer_name || "Responsável técnico"}</p>
          {opinion?.signer_registration && <p className="text-xs">{opinion.signer_registration}</p>}
          <p className="text-xs text-[#5c6378]">{r.orgName}</p>
        </div>
      </section>

      <footer className="mt-8 border-t border-[#d9dce6] pt-3 text-[10px] text-[#5c6378]">
        Relatório preliminar gerado em {formatDate(r.date)} a partir dos documentos anexados ao sistema, com apoio de leitura
        automatizada. Não substitui a conferência dos documentos originais nem o parecer jurídico assinado pelo responsável.
      </footer>
    </article>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <th className="w-24 border border-[#d9dce6] bg-[#f3f0fa] px-2 py-2 text-left align-top font-semibold text-[#5b3fa0] sm:w-40 sm:px-3">{label}</th>
      <td className="border border-[#d9dce6] px-3 py-2">{value}</td>
    </tr>
  );
}

function H2({ n, children }: { n?: number; children: React.ReactNode }) {
  return (
    <h2 className="mb-2 mt-5 border-b border-[#5b3fa0] pb-1 text-base font-bold text-[#5b3fa0] break-after-avoid">
      {n ? `${n}. ` : ""}
      {children}
    </h2>
  );
}
