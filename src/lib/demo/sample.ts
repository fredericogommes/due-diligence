/**
 * Dados fictícios para a página de demonstração do relatório (só em desenvolvimento).
 * Nomes, CPFs e matrícula inventados.
 */
import type { ReportInput } from "@/lib/report/build";
import type { DealItemRow, DocumentRow, TemplateItemRow } from "@/lib/db-types";

const T = (id: string, code: string, section: string, title: string, sort: number, scope: TemplateItemRow["scope"], validity: number | null = null, required = true): TemplateItemRow => ({
  id, code, section, title, description: null, scope, validity_days: validity, required, sort_order: sort,
});

const templateItems: TemplateItemRow[] = [
  T("t1", "IMV-01", "Imóvel", "Certidão de inteiro teor da matrícula", 10, "imovel", 30),
  T("t2", "IMV-02", "Imóvel", "Certidão negativa de débitos de IPTU", 20, "imovel"),
  T("t3", "IMV-03", "Imóvel", "Título aquisitivo anterior", 30, "imovel"),
  T("t4", "IMV-04", "Imóvel", "Declaração de quitação condominial", 40, "imovel", null, false),
  T("t5", "VPF-01", "Vendedor pessoa física", "Documento de identidade e CPF", 110, "parte_pf"),
  T("t6", "VPF-03", "Vendedor pessoa física", "CND conjunta federal (RFB/PGFN)", 130, "parte_pf", 180),
  T("t7", "VPF-04", "Vendedor pessoa física", "Certidão negativa de débitos trabalhistas (CNDT)", 140, "parte_pf", 180),
  T("t8", "VPF-05", "Vendedor pessoa física", "Distribuidor da Justiça Estadual", 150, "parte_pf", 30),
  T("t9", "CMP-01", "Comprador", "Documento de identificação", 310, "parte_pf"),
];

const I = (id: string, t: string, status: DealItemRow["status"], party: string | null, asset: string | null, notes: string | null = null): DealItemRow => ({
  id, deal_id: "demo", template_item_id: t, party_id: party, asset_id: asset, status, notes, updated_at: "",
});

const D = (id: string, item: string | null, docType: string, issued: string | null, expires: string | null, result: DocumentRow["result"]): DocumentRow => ({
  id, org_id: "o", deal_id: "demo", deal_item_id: item, storage_path: "", file_name: `${id}.pdf`, mime_type: "application/pdf",
  size_bytes: 200_000, sha256: null, doc_type: docType, issuer: null, issued_at: issued, expires_at: expires, result,
  source: "upload", notes: null, created_at: "",
});

export function demoReportInput(): ReportInput {
  return {
    deal: {
      id: "demo", org_id: "o", template_id: "t", kind: "compra_venda_imovel", title: "Apto 302 – Rua das Acácias, 150 (exemplo)",
      status: "em_analise", price: "780000.00", notes: null, created_at: "2026-11-01", updated_at: "2026-11-01",
    },
    orgName: "Escritório Exemplo",
    parties: [
      { id: "p1", deal_id: "demo", kind: "pf", role: "vendedor", name: "Carlos Exemplo da Silva", document: "52998224725", marital_status: "casado", property_regime: "comunhao_parcial", notes: null },
      { id: "p2", deal_id: "demo", kind: "pf", role: "conjuge", name: "Marina Exemplo da Silva", document: null, marital_status: "casado", property_regime: "comunhao_parcial", notes: null },
      { id: "p3", deal_id: "demo", kind: "pf", role: "comprador", name: "Paula Compradora", document: null, marital_status: null, property_regime: null, notes: null },
    ],
    assets: [
      { id: "a1", deal_id: "demo", kind: "imovel", description: "Apto 302, Bloco B", matricula: "45.678", cartorio: "1º RI de Volta Redonda", cns: null, inscricao_iptu: "01.02.003", address: "Rua das Acácias, 150", municipio: "Volta Redonda", uf: "RJ", cnpj: null },
    ],
    items: [
      I("i1", "t1", "parcial", null, "a1", "Matrícula com hipoteca R.7 sem averbação de cancelamento."),
      I("i2", "t2", "completo", null, "a1"),
      I("i3", "t3", "faltante", null, "a1"),
      I("i4", "t4", "dispensado", null, "a1", "Imóvel não está em condomínio edilício com administradora."),
      I("i5", "t5", "completo", "p1", null),
      I("i6", "t6", "completo", "p1", null),
      I("i7", "t7", "completo", "p1", null),
      I("i8", "t8", "faltante", "p1", null),
      I("i9", "t5", "faltante", "p2", null),
      I("i10", "t6", "faltante", "p2", null),
      I("i11", "t7", "faltante", "p2", null),
      I("i12", "t8", "faltante", "p2", null),
      I("i13", "t9", "completo", "p3", null),
    ],
    templateItems,
    documents: [
      D("matricula", "i1", "Certidão de inteiro teor com ônus reais", "2026-11-03", null, "positiva"),
      D("iptu", "i2", "Certidão de situação fiscal imobiliária", "2026-10-20", "2026-12-31", "negativa"),
      D("rg", "i5", "CNH", null, null, "nao_se_aplica"),
      D("cnd", "i6", "CND federal", "2026-04-02", "2026-09-29", "negativa"),
      D("cndt", "i7", "CNDT", "2026-10-15", "2027-04-13", "negativa"),
      D("rg-comp", "i13", "RG e CPF", null, null, "nao_se_aplica"),
      D("planta", null, "Planta aprovada pela prefeitura", "2019-05-10", null, "nao_se_aplica"),
    ],
    latestAnalysis: {},
    findings: [
      { id: "f1", deal_id: "demo", deal_item_id: "i1", document_id: "matricula", analysis_id: null, severity: "alto", title: "Hipoteca em favor do Banco Exemplo S.A. (R.7)", description: "Ônus vigente; exigir termo de quitação e averbação do cancelamento antes ou na escritura.", evidence: "R.7/45.678 — HIPOTECA…", source: "ia", resolved: false, created_at: "" },
      { id: "f2", deal_id: "demo", deal_item_id: null, document_id: null, analysis_id: null, severity: "medio", title: "Cônjuge do vendedor sem documentação", description: "Regime de comunhão parcial: cônjuge precisa anuir e apresentar certidões.", evidence: null, source: "manual", resolved: false, created_at: "" },
    ],
  };
}
