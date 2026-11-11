import { describe, expect, it } from "vitest";
import { buildFindings, mergeDocumentMeta } from "@/lib/analysis/findings";
import type { Extraction } from "@/lib/analysis/schema";

const out: Extraction = {
  doc_type: "CND federal", issuer: "RFB/PGFN", subject_name: "João", subject_document: "52998224725",
  issued_at: "2026-11-01", expires_at: "2027-04-30", result: "negativa",
  findings: [{ severity: "baixo", title: "  ", description: "x", evidence: null }],
  matches_item: false, mismatch_reason: "CPF diferente do vendedor", suggested_status: "faltante", summary: "s", confidence: "alta",
};
const ref = { dealId: "d", documentId: "doc", itemId: "i", analysisId: "a" };

describe("buildFindings", () => {
  it("gera apontamentos e um extra quando o documento não corresponde ao item", () => {
    const rows = buildFindings(out, ref);
    expect(rows).toHaveLength(2);
    expect(rows[0].title).toBe("Apontamento");
    expect(rows[1]).toMatchObject({ severity: "medio", description: "CPF diferente do vendedor", deal_item_id: "i", source: "ia" });
  });
  it("sem item não acusa divergência", () => {
    expect(buildFindings(out, { ...ref, itemId: null })).toHaveLength(1);
  });
});

describe("mergeDocumentMeta", () => {
  const empty = { doc_type: null, issuer: null, issued_at: null, expires_at: null, result: "indeterminado" as const };
  it("preenche lacunas com a leitura", () => {
    expect(mergeDocumentMeta(empty, out)).toEqual({
      doc_type: "CND federal", issuer: "RFB/PGFN", issued_at: "2026-11-01", expires_at: "2027-04-30", result: "negativa",
    });
  });
  it("mantém o que o usuário informou", () => {
    const doc = { doc_type: "Meu tipo", issuer: "X", issued_at: "2026-10-01", expires_at: null, result: "positiva" as const };
    expect(mergeDocumentMeta(doc, out)).toMatchObject({ doc_type: "Meu tipo", issued_at: "2026-10-01", expires_at: "2027-04-30", result: "positiva" });
  });
  it("descarta validade da IA anterior à emissão informada", () => {
    const doc = { ...empty, issued_at: "2027-06-01" };
    expect(mergeDocumentMeta(doc, out).expires_at).toBeNull();
  });
});
