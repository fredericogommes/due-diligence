import { OWNER_LABEL, type Aging, type TaskOwner } from "@/lib/board";

const OWNER_STYLE: Record<TaskOwner["who"], string> = {
  ia: "bg-brand/10 text-brand ring-brand/20",
  humano: "bg-warn/10 text-warn ring-warn/25",
  cliente: "bg-ok/10 text-ok ring-ok/25",
  ninguem: "bg-muted text-subtle ring-line",
};

/** Com quem está a tarefa (IA, humano, cliente). */
export function OwnerBadge({ owner }: { owner: TaskOwner }) {
  return (
    <span title={owner.reason} className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${OWNER_STYLE[owner.who]}`}>
      {OWNER_LABEL[owner.who]}
    </span>
  );
}

const AGING_STYLE: Record<Aging["state"], string> = {
  no_prazo: "text-subtle",
  atencao: "text-warn",
  atrasado: "font-semibold text-danger",
};

/** Tempo na etapa contra o prazo-alvo; o texto diz o estado (não só a cor). */
export function AgingBadge({ aging }: { aging: Aging }) {
  const days = aging.days === 0 ? "hoje" : aging.days === 1 ? "1 dia" : `${aging.days} dias`;
  const label = aging.sla == null ? days : aging.state === "atrasado" ? `${days} · atrasado` : aging.state === "atencao" ? `${days} · perto do prazo` : `${days} de ${aging.sla}`;
  return (
    <span title={aging.sla == null ? "Sem prazo nesta etapa" : `Prazo da etapa: ${aging.sla} dia(s)`} className={`whitespace-nowrap text-xs tabular-nums ${AGING_STYLE[aging.state]}`}>
      {aging.state === "atrasado" && <span aria-hidden>● </span>}
      {label}
    </span>
  );
}
