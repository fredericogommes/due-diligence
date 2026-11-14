/**
 * Indicadores do painel de gestão a partir das linhas do quadro. Funções puras —
 * testadas em tests/gestao.test.ts.
 */
import { STAGES, stageAging, taskOwner, type Aging, type BoardRow, type Stage, type TaskOwner } from "./board";

export type ManagedOrder = BoardRow & { owner: TaskOwner; aging: Aging };

export function enrich(rows: BoardRow[], now: string): ManagedOrder[] {
  return rows.map((r) => ({ ...r, owner: taskOwner(r), aging: stageAging(r.stage, r.stage_changed_at, now) }));
}

export type Kpis = {
  active: number;
  needHuman: number;
  overdue: number;
  withClient: number;
  done: number;
  activeValue: number;
  seriousRisks: number;
};

export function kpis(orders: ManagedOrder[]): Kpis {
  const active = orders.filter((o) => o.stage !== "concluido");
  return {
    active: active.length,
    needHuman: active.filter((o) => o.owner.who === "humano").length,
    overdue: active.filter((o) => o.aging.state === "atrasado").length,
    withClient: active.filter((o) => o.owner.who === "cliente").length,
    done: orders.length - active.length,
    activeValue: active.reduce((sum, o) => sum + (Number(o.price) || 0), 0),
    seriousRisks: active.reduce((sum, o) => sum + o.serious_findings, 0),
  };
}

export function byStage(orders: ManagedOrder[]): { stage: Stage; count: number; overdue: number }[] {
  return STAGES.map((stage) => {
    const inStage = orders.filter((o) => o.stage === stage);
    return { stage, count: inStage.length, overdue: inStage.filter((o) => o.aging.state === "atrasado").length };
  });
}

/** Segunda-feira (UTC) da semana de `iso`, como AAAA-MM-DD. */
export function weekStart(iso: string): string {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

/** Pedidos criados por semana nas últimas `weeks` semanas (inclui semanas sem pedido). */
export function createdPerWeek(orders: Pick<BoardRow, "created_at">[], now: string, weeks = 8): { week: string; count: number }[] {
  const last = weekStart(now);
  const out: { week: string; count: number }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(`${last}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 7 * i);
    out.push({ week: d.toISOString().slice(0, 10), count: 0 });
  }
  for (const o of orders) {
    const w = out.find((x) => x.week === weekStart(o.created_at));
    if (w) w.count++;
  }
  return out;
}

export type Workload = { assigneeId: string | null; active: number; needHuman: number; overdue: number };

/** Carga por responsável (pedidos ativos), "sem responsável" por último. */
export function workload(orders: ManagedOrder[]): Workload[] {
  const map = new Map<string | null, Workload>();
  for (const o of orders) {
    if (o.stage === "concluido") continue;
    const w = map.get(o.assignee_id) ?? { assigneeId: o.assignee_id, active: 0, needHuman: 0, overdue: 0 };
    w.active++;
    if (o.owner.who === "humano") w.needHuman++;
    if (o.aging.state === "atrasado") w.overdue++;
    map.set(o.assignee_id, w);
  }
  return [...map.values()].sort((a, b) => (a.assigneeId === null ? 1 : b.assigneeId === null ? -1 : b.active - a.active));
}

/** O que precisa de alguém agora: atrasados primeiro, depois os que esperam humano, mais antigos na etapa antes. */
export function attention(orders: ManagedOrder[], limit = 6): ManagedOrder[] {
  const rank = (o: ManagedOrder) => (o.aging.state === "atrasado" ? 0 : o.owner.who === "humano" ? 1 : 2);
  return orders
    .filter((o) => o.stage !== "concluido" && (o.aging.state === "atrasado" || o.owner.who === "humano"))
    .sort((a, b) => rank(a) - rank(b) || b.aging.days - a.aging.days)
    .slice(0, limit);
}
