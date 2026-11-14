/** Tipos e rótulos do domínio (espelham os enums do banco). */

export const DEAL_KINDS = ["compra_venda_imovel", "cessao_cotas"] as const;
export type DealKind = (typeof DEAL_KINDS)[number];
export const DEAL_KIND_LABEL: Record<DealKind, string> = {
  compra_venda_imovel: "Compra e venda de imóvel",
  cessao_cotas: "Cessão de cotas / trespasse",
};

export const DEAL_STATUSES = ["rascunho", "em_analise", "concluido", "cancelado"] as const;
export type DealStatus = (typeof DEAL_STATUSES)[number];
export const DEAL_STATUS_LABEL: Record<DealStatus, string> = {
  rascunho: "Rascunho",
  em_analise: "Em análise",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export const PARTY_KINDS = ["pf", "pj"] as const;
export type PartyKind = (typeof PARTY_KINDS)[number];
export const PARTY_KIND_LABEL: Record<PartyKind, string> = { pf: "Pessoa física", pj: "Pessoa jurídica" };

export const PARTY_ROLES = [
  "vendedor", "comprador", "conjuge", "cedente", "cessionario", "socio", "empresa_alvo", "procurador", "outro",
] as const;
export type PartyRole = (typeof PARTY_ROLES)[number];
export const PARTY_ROLE_LABEL: Record<PartyRole, string> = {
  vendedor: "Vendedor",
  comprador: "Comprador",
  conjuge: "Cônjuge do vendedor",
  cedente: "Cedente",
  cessionario: "Cessionário",
  socio: "Sócio",
  empresa_alvo: "Empresa alvo",
  procurador: "Procurador",
  outro: "Outro",
};

export const MARITAL_STATUSES = ["solteiro", "casado", "uniao_estavel", "divorciado", "viuvo", "separado"] as const;
export type MaritalStatus = (typeof MARITAL_STATUSES)[number];
export const MARITAL_STATUS_LABEL: Record<MaritalStatus, string> = {
  solteiro: "Solteiro(a)",
  casado: "Casado(a)",
  uniao_estavel: "União estável",
  divorciado: "Divorciado(a)",
  viuvo: "Viúvo(a)",
  separado: "Separado(a)",
};

export const PROPERTY_REGIMES = [
  "comunhao_parcial", "comunhao_universal", "separacao_total", "separacao_obrigatoria", "participacao_final_aquestos",
] as const;
export type PropertyRegime = (typeof PROPERTY_REGIMES)[number];
export const PROPERTY_REGIME_LABEL: Record<PropertyRegime, string> = {
  comunhao_parcial: "Comunhão parcial",
  comunhao_universal: "Comunhão universal",
  separacao_total: "Separação total",
  separacao_obrigatoria: "Separação obrigatória",
  participacao_final_aquestos: "Participação final nos aquestos",
};

export const ASSET_KINDS = ["imovel", "empresa"] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];
export const ASSET_KIND_LABEL: Record<AssetKind, string> = { imovel: "Imóvel", empresa: "Empresa" };

export const ITEM_STATUSES = ["faltante", "parcial", "completo", "dispensado"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];
export const ITEM_STATUS_LABEL: Record<ItemStatus, string> = {
  faltante: "Faltante",
  parcial: "Parcial",
  completo: "Completo",
  dispensado: "Dispensado",
};

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

/** Formata CPF (11) ou CNPJ (14) para exibição. */
export function formatDocument(doc: string | null | undefined): string {
  if (!doc) return "";
  if (doc.length === 11) return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (doc.length === 14) return doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return doc;
}

export function formatBRL(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Valor curto para indicadores: "R$ 28,7 mi", "R$ 640 mil". */
export function formatCompactBRL(value: number): string {
  const abs = Math.abs(value);
  const fmt = (n: number, unit: string) => `R$ ${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${unit}`;
  if (abs >= 1e9) return fmt(value / 1e9, "bi");
  if (abs >= 1e6) return fmt(value / 1e6, "mi");
  if (abs >= 1e3) return fmt(value / 1e3, "mil");
  return formatBRL(value);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value.length === 10 ? `${value}T12:00:00` : value) : value;
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}
