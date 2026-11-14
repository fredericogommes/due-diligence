/** Formatos das linhas lidas do Supabase (mantidos à mão, alinhados às migrações). */
import type {
  AssetKind, DealKind, DealStatus, ItemStatus, MaritalStatus, PartyKind, PartyRole, PropertyRegime,
} from "./domain";

export type ItemScope = "negocio" | "parte_pf" | "parte_pj" | "imovel" | "empresa";

export type DealRow = {
  id: string;
  org_id: string;
  template_id: string | null;
  kind: DealKind;
  title: string;
  status: DealStatus;
  price: string | number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PartyRow = {
  id: string;
  deal_id: string;
  kind: PartyKind;
  role: PartyRole;
  name: string;
  document: string | null;
  marital_status: MaritalStatus | null;
  property_regime: PropertyRegime | null;
  notes: string | null;
  created_at?: string;
};

export type AssetRow = {
  id: string;
  deal_id: string;
  kind: AssetKind;
  description: string;
  matricula: string | null;
  cartorio: string | null;
  cns: string | null;
  inscricao_iptu: string | null;
  address: string | null;
  municipio: string | null;
  uf: string | null;
  cnpj: string | null;
  created_at?: string;
};

export type TemplateItemRow = {
  id: string;
  code: string;
  section: string;
  title: string;
  description: string | null;
  scope: ItemScope;
  validity_days: number | null;
  required: boolean;
  sort_order: number;
};

export type DealItemRow = {
  id: string;
  deal_id: string;
  template_item_id: string;
  party_id: string | null;
  asset_id: string | null;
  status: ItemStatus;
  notes: string | null;
  updated_at: string;
};

export type DealProgressRow = {
  deal_id: string;
  total: number;
  completos: number;
  parciais: number;
  faltantes: number;
  dispensados: number;
};

export type DocumentRow = {
  id: string;
  org_id: string;
  deal_id: string;
  deal_item_id: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  sha256: string | null;
  doc_type: string | null;
  issuer: string | null;
  issued_at: string | null;
  expires_at: string | null;
  result: import("./documents").DocResult;
  source: "upload" | "api";
  /** Visualização obtida na consulta prévia (sem valor oficial). */
  is_preview: boolean;
  /** Versão anterior que este documento substitui (M14). */
  supersedes_id?: string | null;
  notes: string | null;
  created_at: string;
};

export type FindingSeverity = "critico" | "alto" | "medio" | "baixo";

export type AnalysisRow = {
  id: string;
  deal_id: string;
  document_id: string;
  status: "pendente" | "concluida" | "erro";
  model: string | null;
  output: import("./analysis/schema").Extraction | null;
  error: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: string;
};

export type FindingRow = {
  id: string;
  deal_id: string;
  deal_item_id: string | null;
  document_id: string | null;
  analysis_id: string | null;
  severity: FindingSeverity;
  title: string;
  description: string | null;
  evidence: string | null;
  source: "ia" | "manual" | "consulta";
  resolved: boolean;
  /** Estado do achado (M13). Opcional para dados de demonstração antigos. */
  status?: import("./findings").FindingStatus;
  resolution_note?: string | null;
  created_at: string;
};

export type CertificateRequestRow = {
  id: string;
  deal_id: string;
  deal_item_id: string;
  provider: string;
  mode: "visualizacao" | "emissao";
  status: "pendente" | "aguardando_pagamento" | "concluido" | "erro";
  protocol: string | null;
  cost_cents: number | null;
  document_id: string | null;
  error: string | null;
  boleto_url: string | null;
  boleto_line: string | null;
  boleto_due: string | null;
  created_at: string;
};
