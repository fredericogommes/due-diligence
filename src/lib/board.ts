/**
 * Etapas do negócio (colunas do kanban) e "com quem está a tarefa".
 * Funções puras — testadas em tests/board.test.ts.
 */

export const STAGES = ["qualificacao", "consulta", "analise", "emissao", "concluido"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  qualificacao: "Qualificação",
  consulta: "Consulta prévia",
  analise: "Análise e relatório",
  emissao: "Certidões oficiais",
  concluido: "Concluído",
};

/** Como o cliente vê cada etapa (linguagem simples). */
export const CLIENT_STAGE_LABEL: Record<Stage, string> = {
  qualificacao: "Solicitação recebida",
  consulta: "Consultando certidões",
  analise: "Em análise",
  emissao: "Emissão das certidões oficiais",
  concluido: "Concluída",
};

export type BoardRow = {
  id: string;
  org_id: string;
  title: string;
  kind: "compra_venda_imovel" | "cessao_cotas";
  price: string | number | null;
  status: string;
  stage: Stage;
  assignee_id: string | null;
  client_id: string | null;
  created_at: string;
  updated_at: string;
  parties: number;
  assets: number;
  previews: number;
  open_findings: number;
  serious_findings: number;
  awaiting_payment: number;
  issuing: number;
  issued: number;
  signed_version: number | null;
};

type Counts = Pick<BoardRow, "stage" | "parties" | "assets" | "previews" | "awaiting_payment" | "issuing" | "issued">;

/**
 * Para onde a etapa avança sozinha com o que já aconteceu. Só anda para a
 * frente; voltar é decisão humana (arrastando no quadro).
 */
export function nextStage(r: Counts): Stage {
  let s = r.stage;
  if (s === "qualificacao" && r.parties > 0 && r.assets > 0) s = "consulta";
  if (s === "consulta" && r.previews > 0) s = "analise";
  if (s === "analise" && r.awaiting_payment + r.issuing + r.issued > 0) s = "emissao";
  if (s === "emissao" && r.issued > 0 && r.awaiting_payment === 0 && r.issuing === 0) s = "concluido";
  return s;
}

export type TaskOwner = { who: "ia" | "humano" | "cliente" | "ninguem"; reason: string };

export const OWNER_LABEL: Record<TaskOwner["who"], string> = {
  ia: "IA",
  humano: "Humano",
  cliente: "Cliente",
  ninguem: "—",
};

/** Com quem está a tarefa agora, e o que falta fazer. */
export function taskOwner(r: Omit<BoardRow, "id" | "org_id" | "title" | "kind" | "price" | "status" | "assignee_id" | "client_id" | "created_at" | "updated_at">): TaskOwner {
  switch (r.stage) {
    case "qualificacao": {
      const missing = [r.assets ? null : "o objeto (bem)", r.parties ? null : "as partes"].filter(Boolean);
      return { who: "humano", reason: missing.length ? `Cadastrar ${missing.join(" e ")}` : "Conferir a qualificação" };
    }
    case "consulta":
      return r.previews ? { who: "humano", reason: "Conferir a consulta prévia" } : { who: "ia", reason: "Consultando as certidões e lendo com IA" };
    case "analise":
      if (r.serious_findings) return { who: "humano", reason: `Revisar ${r.serious_findings} ${r.serious_findings === 1 ? "risco alto/crítico" : "riscos altos/críticos"}` };
      if (!r.signed_version) return { who: "humano", reason: "Revisar e assinar o relatório preliminar" };
      return { who: "cliente", reason: "Relatório entregue: aguardando decisão de seguir com o negócio" };
    case "emissao":
      if (r.awaiting_payment) return { who: "cliente", reason: `Pagar ${r.awaiting_payment} ${r.awaiting_payment === 1 ? "boleto" : "boletos"}` };
      if (r.issuing) return { who: "ia", reason: "Acompanhando a emissão das certidões" };
      return { who: "humano", reason: "Conferir as certidões oficiais" };
    case "concluido":
      return { who: "ninguem", reason: "Concluído" };
  }
}
