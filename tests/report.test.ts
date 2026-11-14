import { describe, expect, it } from "vitest";
import type { DealItemRow, DealRow, DocumentRow, FindingRow, TemplateItemRow } from "@/lib/db-types";
import { buildReport, suggestConclusion } from "@/lib/report/build";

const deal: DealRow = {
  id: "d", org_id: "o", template_id: "t", kind: "cessao_cotas", title: "AME", status: "em_analise",
  price: "900000.00", notes: null, created_at: "", updated_at: "",
};
const tpl = (id: string, code: string, section: string, sort: number, required = true, validity: number | null = null): TemplateItemRow => ({
  id, code, section, title: `T ${code}`, description: null, scope: "negocio", validity_days: validity, required, sort_order: sort,
});
const item = (id: string, t: string, status: DealItemRow["status"], notes: string | null = null): DealItemRow => ({
  id, deal_id: "d", template_item_id: t, party_id: null, asset_id: null, status, notes, updated_at: "",
});
const finding = (severity: FindingRow["severity"], resolved = false): FindingRow => ({
  id: severity + resolved, deal_id: "d", deal_item_id: null, document_id: null, analysis_id: null, severity,
  title: `Risco ${severity}`, description: "desc", evidence: null, source: "manual", resolved, created_at: "",
});
const doc = (id: string, itemId: string | null, issued: string | null): DocumentRow => ({
  id, org_id: "o", deal_id: "d", deal_item_id: itemId, storage_path: "p", file_name: `${id}.pdf`, mime_type: "application/pdf",
  size_bytes: 1, sha256: null, doc_type: `Doc ${id}`, issuer: null, issued_at: issued, expires_at: null, result: "negativa",
  source: "upload", is_preview: false, notes: null, created_at: "",
});

const templateItems = [
  tpl("t1", "SOC-01", "Societário", 10),
  tpl("t2", "SOC-02", "Societário", 20, true, 30),
  tpl("t3", "OPR-01", "Imóvel", 30),
  tpl("t4", "OPR-02", "Imóvel", 40, false),
];

describe("suggestConclusion", () => {
  const counts = { total: 4, completo: 4, parcial: 0, faltante: 0, dispensado: 0, vencidos: 0 };
  it("crítico em aberto → inviável", () => expect(suggestConclusion(counts, [finding("critico")], 0)).toBe("inviavel"));
  it("obrigatório faltante ou vencido → incompleta", () => {
    expect(suggestConclusion(counts, [], 1)).toBe("incompleta");
    expect(suggestConclusion({ ...counts, vencidos: 1 }, [], 0)).toBe("incompleta");
  });
  it("parcial ou risco alto/médio → com ressalvas", () => {
    expect(suggestConclusion({ ...counts, parcial: 1 }, [], 0)).toBe("viavel_com_ressalvas");
    expect(suggestConclusion(counts, [finding("medio")], 0)).toBe("viavel_com_ressalvas");
  });
  it("tudo certo e só riscos baixos → viável", () => expect(suggestConclusion(counts, [finding("baixo")], 0)).toBe("viavel"));
});

describe("buildReport", () => {
  const input = {
    deal, orgName: "TETTU", parties: [], assets: [],
    items: [item("i1", "t1", "completo"), item("i2", "t2", "completo"), item("i3", "t3", "faltante", "Só autodeclaração de uso"), item("i4", "t4", "dispensado")],
    templateItems,
    documents: [doc("a", "i1", "2026-10-01"), doc("b", "i2", "2026-09-01"), doc("c", null, null)],
    latestAnalysis: {},
    findings: [finding("alto"), finding("critico", true)],
  };

  it("monta resumo executivo no formato do parecer", () => {
    const r = buildReport(input, "2026-11-11");
    expect(r.executiveSummary).toBe(
      "Dos 3 itens documentais considerados, 2 estão integralmente atendidos, 0 atendidos apenas parcialmente e 1 não foi localizado (1 dispensado por não se aplicar). 1 item atendido depende de documento vencido. Há 1 risco ou apontamento em aberto.",
    );
    expect(r.counts).toEqual({ total: 4, completo: 2, parcial: 0, faltante: 1, dispensado: 1, vencidos: 1 });
  });

  it("conclusão incompleta, pontos de atenção e recomendações", () => {
    const r = buildReport(input, "2026-11-11");
    expect(r.suggestedConclusion).toBe("incompleta");
    expect(r.attention).toEqual(["ALTO — Risco alto: desc", "Faltante — OPR-01 T OPR-01"]);
    expect(r.recommendations[0]).toMatch(/1 faltante, 0 parciais/);
    expect(r.recommendations.some((x) => /reemissão/.test(x))).toBe(true);
    expect(r.findings.map((f) => f.severity)).toEqual(["alto"]); // resolvido fica fora
  });

  it("tabela por seção com observações e documentos fora do checklist", () => {
    const r = buildReport(input, "2026-11-11");
    expect(r.sections.map((s) => s.name)).toEqual(["Societário", "Imóvel"]);
    const soc02 = r.sections[0].rows[1];
    expect(soc02.expired).toBe(true);
    expect(soc02.observation).toMatch(/VENCIDO em 01\/10\/2026/);
    expect(r.sections[1].rows[0].observation).toBe("Só autodeclaração de uso Nenhum documento localizado.");
    expect(r.extraDocuments).toEqual([{ name: "Doc c", description: "negativa" }]);
  });

  it("negócio sem itens explica o que fazer", () => {
    const r = buildReport({ ...input, items: [], documents: [], findings: [] }, "2026-11-11");
    expect(r.executiveSummary).toMatch(/cadastre os bens e as partes/);
    expect(r.suggestedConclusion).toBe("viavel");
  });
});

describe("relatório preliminar com consulta prévia", () => {
  const preview = (id: string, itemId: string, result: DocumentRow["result"]): DocumentRow => ({
    ...doc(id, itemId, "2026-11-10"), source: "api", is_preview: true, result, doc_type: `Visualização ${id}`,
  });
  const input = {
    deal, orgName: "TETTU", parties: [], assets: [],
    items: [item("i1", "t1", "faltante"), item("i2", "t2", "faltante"), item("i3", "t3", "faltante")],
    templateItems,
    documents: [preview("v1", "i1", "negativa"), preview("v2", "i2", "positiva")],
    latestAnalysis: {},
    findings: [finding("alto")],
  };

  it("visualização conta como consultado: não vira 'não localizado' nem documento oficial", () => {
    const r = buildReport(input, "2026-11-11");
    const rows = r.sections.flatMap((s) => s.rows);
    expect(rows.find((x) => x.code === "SOC-01")!.observation).toBe(
      "Visualização (consulta prévia em 10/11/2026): nada consta. Certidão oficial ainda não emitida.",
    );
    expect(rows.find((x) => x.code === "SOC-02")!.observation).toMatch(/CONSTA REGISTRO/);
    expect(r.attention.filter((a) => a.startsWith("Faltante"))).toEqual(["Faltante — OPR-01 T OPR-01"]);
    expect(r.executiveSummary).toContain("Na consulta prévia, 2 certidões foram visualizadas, 1 com registro.");
    expect(r.recommendations.some((x) => x.includes("não substituem as certidões oficiais"))).toBe(true);
  });
});

it("resumo separa itens só com visualização dos não localizados", () => {
  const r = buildReport({
    deal, orgName: "X", parties: [], assets: [], templateItems, latestAnalysis: {}, findings: [],
    items: [item("i1", "t1", "faltante"), item("i3", "t3", "faltante")],
    documents: [{ ...doc("v1", "i1", "2026-11-10"), is_preview: true, source: "api" }],
  }, "2026-11-11");
  expect(r.executiveSummary).toBe(
    "Dos 2 itens documentais considerados, 0 estão integralmente atendidos, 0 atendidos apenas parcialmente, 1 não foi localizado e 1 tem apenas a visualização da consulta prévia. Na consulta prévia, 1 certidão foi visualizada, sem registros.",
  );
});

describe("fontes consultadas e limitações", () => {
  it("lista as fontes pela natureza e explica os limites, inclusive que ausência de registro não é ausência de risco", () => {
    const preview = { ...doc("v1", "i1", "2026-11-10"), source: "api" as const, is_preview: true, issuer: "Provedor simulado", doc_type: "Matrícula (visualização)" };
    const oficial = { ...doc("o1", "i2", "2026-11-12"), source: "api" as const, issuer: "1º RI", doc_type: "Matrícula" };
    const r = buildReport({
      deal, orgName: "X", parties: [], assets: [], templateItems, latestAnalysis: {},
      items: [item("i1", "t1", "faltante"), item("i2", "t2", "completo")],
      documents: [preview, oficial, doc("a1", null, null)],
      findings: [{ ...finding("alto"), status: "proposto" }],
    }, "2026-11-14");
    expect(r.sources!.map((s) => s.kind)).toEqual(["certidao_oficial", "documento_anexado", "visualizacao"]);
    expect(r.limitations!.join(" ")).toMatch(/ausência de registro numa consulta não comprova ausência de risco/i);
    expect(r.limitations!.join(" ")).toMatch(/FICTÍCIOS/);
    expect(r.limitations!.join(" ")).toMatch(/1 apontamento foi sugerido automaticamente/);
    expect(r.limitations!.join(" ")).toMatch(/Visualizações da consulta prévia não têm valor de certidão/);
  });
});
