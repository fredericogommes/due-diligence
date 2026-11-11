import { formatBRL, formatDate } from "@/lib/domain";
import type { CertificateRequestRow } from "@/lib/db-types";

export type CertRequestView = Pick<
  CertificateRequestRow,
  "id" | "provider" | "mode" | "status" | "protocol" | "error" | "cost_cents" | "boleto_url" | "boleto_line" | "boleto_due" | "created_at"
>;

/** Situação online do item: de onde vem a certidão e o pedido de emissão mais recente. */
export type CertInfo = {
  /** Fonte que atende o item, ou o motivo de não haver (ex.: documento fornecido pelas partes). */
  source: { ok: true; name: string } | { ok: false; reason: string };
  online: boolean;
  issue: CertRequestView | null;
};

export const ISSUE_STATUS_LABEL: Record<CertRequestView["status"], string> = {
  pendente: "Emissão em andamento",
  aguardando_pagamento: "Aguardando pagamento do boleto",
  concluido: "Certidão oficial recebida",
  erro: "Pedido de emissão falhou",
};

export function ItemOnlineStatus({ info }: { info: CertInfo }) {
  if (!info.online) return <p className="mt-1 text-xs text-subtle">Documento fornecido pelas partes: anexe abaixo.</p>;
  const i = info.issue;
  return (
    <div className="mt-1 space-y-0.5 text-xs">
      <p className="text-subtle">
        Certidão online · {info.source.ok ? `fonte: ${info.source.name}` : <span className="text-warn">{info.source.reason}</span>}
      </p>
      {i && (
        <p className={i.status === "erro" ? "text-danger" : i.status === "concluido" ? "text-ok" : "text-warn"}>
          {ISSUE_STATUS_LABEL[i.status]}
          {i.protocol && ` · protocolo ${i.protocol}`}
          {i.status === "aguardando_pagamento" && i.cost_cents != null && ` · ${formatBRL(i.cost_cents / 100)}`}
          {i.status === "aguardando_pagamento" && i.boleto_due && ` · vence ${formatDate(i.boleto_due)}`}
          {i.status === "erro" && i.error && ` · ${i.error}`}
        </p>
      )}
    </div>
  );
}
