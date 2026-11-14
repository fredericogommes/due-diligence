/** Tradução das linhas do log de auditoria para frases legíveis. Função pura. */

export type AuditRow = {
  id: number;
  org_id: string;
  deal_id: string | null;
  actor_id: string | null;
  table_name: string;
  record_id: string | null;
  action: "insert" | "update" | "delete" | "download";
  changed_fields: string[] | null;
  created_at: string;
};

const ENTITY: Record<string, { singular: string; gender: "m" | "f" }> = {
  organizations: { singular: "organização", gender: "f" },
  memberships: { singular: "membro", gender: "m" },
  invitations: { singular: "convite", gender: "m" },
  deals: { singular: "negócio", gender: "m" },
  parties: { singular: "parte", gender: "f" },
  assets: { singular: "bem", gender: "m" },
  deal_items: { singular: "item do checklist", gender: "m" },
  documents: { singular: "documento", gender: "m" },
  document_analyses: { singular: "leitura por IA", gender: "f" },
  findings: { singular: "risco/apontamento", gender: "m" },
  deal_opinions: { singular: "parecer", gender: "m" },
  certificate_requests: { singular: "pedido de certidão", gender: "m" },
  report_versions: { singular: "versão do relatório", gender: "f" },
};

const FIELD: Record<string, string> = {
  name: "nome",
  title: "título",
  status: "status",
  notes: "observações",
  role: "papel",
  kind: "tipo",
  price: "valor",
  document: "CPF/CNPJ",
  marital_status: "estado civil",
  property_regime: "regime de bens",
  description: "descrição",
  matricula: "matrícula",
  cartorio: "cartório",
  cns: "CNS",
  inscricao_iptu: "inscrição de IPTU",
  address: "endereço",
  municipio: "município",
  uf: "UF",
  cnpj: "CNPJ",
  deal_item_id: "item vinculado",
  doc_type: "tipo de documento",
  issuer: "emissor",
  issued_at: "data de emissão",
  expires_at: "validade",
  result: "resultado",
  severity: "gravidade",
  resolved: "resolvido",
  resolved_at: "resolvido",
  conclusion: "conclusão",
  opinion: "texto do parecer",
  signer_name: "responsável",
  signer_registration: "registro profissional",
  protocol: "protocolo",
  stage: "etapa",
  legal_reviewer: "permissão de revisor jurídico",
  assignee_id: "responsável",
  client_id: "cliente",
  boleto_url: "boleto",
  boleto_line: "boleto",
  boleto_due: "boleto",
  mode: "tipo de pedido",
  is_preview: "visualização",
  cost_cents: "custo",
  document_id: "documento",
  provider: "provedor",
  request: "dados do pedido",
  response: "resposta",
  error: "erro",
  evidence: "evidência",
  accepted_at: "aceite",
  accepted_by: "aceite",
  reviewed_at: "revisão",
  reviewed_by: "revisão",
  signed_at: "assinatura",
  signed_by: "assinatura",
};

const VERB: Record<AuditRow["action"], { m: string; f: string }> = {
  insert: { m: "incluiu o", f: "incluiu a" },
  update: { m: "alterou o", f: "alterou a" },
  delete: { m: "excluiu o", f: "excluiu a" },
  download: { m: "abriu o", f: "abriu a" },
};

/** Frase do evento, sem o nome de quem fez (ex.: "alterou a parte (nome, CPF/CNPJ)"). */
export function describeAudit(row: Pick<AuditRow, "table_name" | "action" | "changed_fields">): string {
  if (row.table_name === "memberships") {
    if (row.action === "insert") return "adicionou um membro";
    if (row.action === "delete") return "removeu um membro";
    return "mudou o papel de um membro";
  }
  if (row.table_name === "invitations") {
    if (row.action === "insert") return "enviou um convite";
    if (row.action === "delete") return "cancelou um convite";
    return "aceitou um convite";
  }
  if (row.table_name === "report_versions" && row.action === "update") {
    const f = row.changed_fields ?? [];
    if (f.includes("signed_at")) return "assinou uma versão do relatório";
    if (f.includes("reviewed_at")) return "revisou uma versão do relatório";
  }
  if (row.table_name === "report_versions" && row.action === "insert") return "salvou uma versão do relatório";
  if (row.table_name === "document_analyses") return "leu um documento com IA";

  const entity = ENTITY[row.table_name] ?? { singular: row.table_name, gender: "m" as const };
  let text = `${VERB[row.action][entity.gender]} ${entity.singular}`;
  if (row.action === "update" && row.changed_fields?.length) {
    const fields = [...new Set(row.changed_fields.map((f) => FIELD[f] ?? f))];
    text += ` (${fields.join(", ")})`;
  }
  return text;
}

/** Data e hora no fuso de São Paulo, ex.: "11/11/2026 14:05". */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
