/**
 * Modelo do relatório preliminar (formato do parecer de análise documental TETTU):
 * resumo executivo, pontos de atenção, tabela por seção, documentos fora do
 * checklist, conclusão sugerida e recomendações. Função pura.
 */
import { buildChecklist, summarize, unassignedDocuments, type ChecklistEntry, type DocView } from "@/lib/checklist/build";
import { VALIDITY_LABEL } from "@/lib/checklist/validity";
import type { AnalysisRow, AssetRow, DealItemRow, DealRow, DocumentRow, FindingRow, PartyRow, TemplateItemRow } from "@/lib/db-types";
import { DOC_RESULT_LABEL } from "@/lib/documents";
import { formatDate, type ItemStatus } from "@/lib/domain";
import { sortBySeverity } from "@/lib/findings";

export type Conclusion = "viavel" | "viavel_com_ressalvas" | "incompleta" | "inviavel";

export const CONCLUSION_LABEL: Record<Conclusion, string> = {
  viavel: "VIÁVEL",
  viavel_com_ressalvas: "VIÁVEL COM RESSALVAS",
  incompleta: "INCOMPLETA",
  inviavel: "NÃO RECOMENDADA",
};

export const CONCLUSION_TEXT: Record<Conclusion, string> = {
  viavel:
    "A documentação analisada atende ao checklist e não foram identificados riscos relevantes em aberto. Do ponto de vista documental, o negócio pode prosseguir.",
  viavel_com_ressalvas:
    "A documentação é suficiente para prosseguir, mas há pontos que devem ser tratados no instrumento definitivo (declarações e garantias, retenções, condições).",
  incompleta:
    "A documentação apresentada é insuficiente para a conclusão segura da due diligence. Não é recomendável assinar o instrumento definitivo sem as devidas ressalvas contratuais cobrindo os itens em aberto.",
  inviavel:
    "Foram identificados riscos críticos que, enquanto não sanados, desaconselham a realização do negócio nas condições atuais.",
};

export type ReportRow = {
  code: string;
  title: string;
  subject: string | null;
  status: ItemStatus;
  required: boolean;
  observation: string;
  expired: boolean;
};

export type ReportSection = { name: string; rows: ReportRow[] };

export type ReportModel = {
  dealTitle: string;
  dealKind: DealRow["kind"];
  orgName: string;
  price: DealRow["price"];
  date: string;
  parties: PartyRow[];
  assets: AssetRow[];
  counts: { total: number; completo: number; parcial: number; faltante: number; dispensado: number; vencidos: number };
  executiveSummary: string;
  attention: string[];
  sections: ReportSection[];
  extraDocuments: { name: string; description: string }[];
  findings: FindingRow[];
  suggestedConclusion: Conclusion;
  recommendations: string[];
};

/** O que uma versão do relatório guarda (congelado no momento em que foi salva). */
export type ReportSnapshot = {
  report: ReportModel;
  conclusion: Conclusion;
  opinion: { conclusion: Conclusion | null; opinion: string | null; signer_name: string | null; signer_registration: string | null } | null;
};

export type ReportInput = {
  deal: DealRow;
  orgName: string;
  parties: PartyRow[];
  assets: AssetRow[];
  items: DealItemRow[];
  templateItems: TemplateItemRow[];
  documents: DocumentRow[];
  latestAnalysis: Record<string, AnalysisRow>;
  findings: FindingRow[];
};

function docLine(d: DocView, analyses: Record<string, AnalysisRow>, withName = true): string {
  const parts = withName ? [d.doc_type ?? d.file_name] : [];
  if (d.issued_at) parts.push(`emissão em ${formatDate(d.issued_at)}`);
  if (d.result !== "indeterminado" && d.result !== "nao_se_aplica") parts.push(DOC_RESULT_LABEL[d.result].toLowerCase());
  if (d.validity.state === "vencida" && d.validity.until) parts.push(`VENCIDO em ${formatDate(d.validity.until)}`);
  else if (d.validity.state !== "sem_data") parts.push(VALIDITY_LABEL[d.validity.state].toLowerCase());
  const a = analyses[d.id];
  const summary = a?.status === "concluida" && a.output ? a.output.summary : "";
  return [parts.join(", "), summary].filter(Boolean).join(" — ") || "sem dados de emissão";
}

function observation(e: ChecklistEntry, analyses: Record<string, AnalysisRow>): string {
  const lines: string[] = [];
  if (e.notes) lines.push(e.notes);
  if (e.documents.length) lines.push(`Documentos: ${e.documents.map((d) => docLine(d, analyses)).join("; ")}.`);
  else if (e.status !== "dispensado") lines.push("Nenhum documento localizado.");
  if (e.expiredWarning) lines.push("Atenção: documento vencido — solicitar versão atualizada.");
  return lines.join(" ");
}

export function suggestConclusion(
  counts: ReportModel["counts"],
  openFindings: FindingRow[],
  requiredMissing: number,
): Conclusion {
  if (openFindings.some((f) => f.severity === "critico")) return "inviavel";
  if (requiredMissing > 0 || counts.vencidos > 0) return "incompleta";
  if (counts.parcial > 0 || openFindings.some((f) => f.severity === "alto" || f.severity === "medio")) return "viavel_com_ressalvas";
  return "viavel";
}

export function buildReport(input: ReportInput, today: string): ReportModel {
  const sections = buildChecklist(input.items, input.templateItems, input.parties, input.assets, input.documents, today);
  const s = summarize(sections);
  const counts = { total: s.total, completo: s.completo, parcial: s.parcial, faltante: s.faltante, dispensado: s.dispensado, vencidos: s.vencidos };
  const entries = sections.flatMap((x) => x.entries);
  const openFindings = sortBySeverity(input.findings.filter((f) => !f.resolved));
  const requiredMissing = entries.filter((e) => e.required && e.status === "faltante");
  const conclusion = suggestConclusion(counts, openFindings, requiredMissing.length);

  const considered = s.total - s.dispensado;
  const pl = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const executiveSummary =
    considered === 0
      ? "Ainda não há itens de checklist para este negócio: cadastre os bens e as partes para gerar a lista de documentos."
      : `Dos ${pl(considered, "item documental considerado", "itens documentais considerados")}, ` +
        `${pl(s.completo, "está integralmente atendido", "estão integralmente atendidos")}, ` +
        `${pl(s.parcial, "atendido apenas parcialmente", "atendidos apenas parcialmente")} e ` +
        `${pl(s.faltante, "não foi localizado", "não foram localizados")}` +
        (s.dispensado ? ` (${pl(s.dispensado, "dispensado por não se aplicar", "dispensados por não se aplicarem")})` : "") +
        "." +
        (s.vencidos ? ` ${s.vencidos === 1 ? "1 item atendido depende de documento vencido" : `${s.vencidos} itens atendidos dependem de documentos vencidos`}.` : "") +
        (openFindings.length ? ` Há ${pl(openFindings.length, "risco ou apontamento em aberto", "riscos ou apontamentos em aberto")}.` : "");

  const attention = [
    ...openFindings.filter((f) => f.severity === "critico" || f.severity === "alto").map((f) => `${f.severity === "critico" ? "CRÍTICO" : "ALTO"} — ${f.title}${f.description ? `: ${f.description}` : ""}`),
    ...requiredMissing.slice(0, 10).map((e) => `Faltante — ${e.code} ${e.title}${e.subject ? ` (${e.subject})` : ""}`),
  ];
  if (requiredMissing.length > 10) attention.push(`… e mais ${requiredMissing.length - 10} itens obrigatórios faltantes.`);

  const recommendations: string[] = [];
  if (requiredMissing.length || s.parcial) {
    recommendations.push(
      `Formalizar pedido complementar de documentos à parte vendedora (${pl(requiredMissing.length, "faltante", "faltantes")}, ${pl(s.parcial, "parcial", "parciais")}), com prazo de 10 a 15 dias úteis.`,
    );
  }
  if (s.vencidos) recommendations.push("Solicitar a reemissão das certidões vencidas antes da assinatura.");
  for (const f of openFindings.filter((x) => x.severity === "critico" || x.severity === "alto")) {
    recommendations.push(`Tratar no instrumento: ${f.title} (exigir baixa/cancelamento, garantia, retenção de preço ou condição suspensiva).`);
  }
  if (conclusion !== "viavel") {
    recommendations.push("Incluir no contrato declarações e garantias, cláusula de indenização e condições suspensivas cobrindo os itens em aberto.");
  }

  return {
    dealTitle: input.deal.title,
    dealKind: input.deal.kind,
    orgName: input.orgName,
    price: input.deal.price,
    date: today,
    parties: input.parties,
    assets: input.assets,
    counts,
    executiveSummary,
    attention,
    sections: sections.map((sec) => ({
      name: sec.name,
      rows: sec.entries.map((e) => ({
        code: e.code,
        title: e.title,
        subject: e.subject,
        status: e.status,
        required: e.required,
        observation: observation(e, input.latestAnalysis),
        expired: e.expiredWarning,
      })),
    })),
    extraDocuments: unassignedDocuments(input.documents, today).map((d) => ({
      name: d.doc_type ?? d.file_name,
      description: docLine(d, input.latestAnalysis, false),
    })),
    findings: openFindings,
    suggestedConclusion: conclusion,
    recommendations,
  };
}
