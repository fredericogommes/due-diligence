/** Converte a leitura da IA em linhas de apontamento e mescla metadados do documento. Funções puras. */
import type { DocumentRow } from "@/lib/db-types";
import type { Extraction } from "./schema";

export type FindingInsert = {
  deal_id: string;
  document_id: string;
  deal_item_id: string | null;
  analysis_id: string;
  severity: "critico" | "alto" | "medio" | "baixo";
  title: string;
  description: string;
  evidence: string | null;
  source: "ia";
};

export function buildFindings(
  out: Extraction,
  ref: { dealId: string; documentId: string; itemId: string | null; analysisId: string },
): FindingInsert[] {
  const base = { deal_id: ref.dealId, document_id: ref.documentId, deal_item_id: ref.itemId, analysis_id: ref.analysisId, source: "ia" as const };
  const rows: FindingInsert[] = out.findings.map((f) => ({
    ...base,
    severity: f.severity,
    title: f.title.trim().slice(0, 300) || "Apontamento",
    description: f.description.slice(0, 4000),
    evidence: f.evidence?.slice(0, 2000) ?? null,
  }));
  if (!out.matches_item && ref.itemId) {
    rows.push({
      ...base,
      severity: "medio",
      title: "Documento não corresponde ao item do checklist",
      description: (out.mismatch_reason ?? "A leitura indica que o documento não atende ao item.").slice(0, 4000),
      evidence: null,
    });
  }
  return rows;
}

/** Metadados finais: o que o usuário já informou prevalece; a IA só preenche lacunas. */
export function mergeDocumentMeta(
  doc: Pick<DocumentRow, "doc_type" | "issuer" | "issued_at" | "expires_at" | "result">,
  out: Extraction,
): Pick<DocumentRow, "doc_type" | "issuer" | "issued_at" | "expires_at" | "result"> {
  const issued = doc.issued_at ?? out.issued_at;
  let expires = doc.expires_at ?? out.expires_at;
  if (expires && issued && expires < issued) expires = doc.expires_at; // não grava validade anterior à emissão
  return {
    doc_type: doc.doc_type ?? out.doc_type,
    issuer: doc.issuer ?? out.issuer,
    issued_at: issued,
    expires_at: expires,
    result: doc.result === "indeterminado" ? out.result : doc.result,
  };
}
