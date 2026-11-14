import { describe, expect, it } from "vitest";
import type { BoardRow } from "@/lib/board";
import { formatCompactBRL } from "@/lib/domain";
import { attention, byStage, createdPerWeek, enrich, kpis, weekStart, workload } from "@/lib/gestao";

const NOW = "2026-11-13T12:00:00Z";
const row = (id: string, p: Partial<BoardRow>): BoardRow => ({
  id, org_id: "o", title: id, kind: "compra_venda_imovel", price: "100000.00", status: "rascunho", stage: "qualificacao",
  assignee_id: null, client_id: null, created_at: "2026-11-10T10:00:00Z", updated_at: NOW, parties: 0, assets: 0, previews: 0,
  open_findings: 0, serious_findings: 0, awaiting_payment: 0, issuing: 0, issued: 0, signed_version: null, stage_changed_at: NOW, ...p,
});

const orders = enrich(
  [
    row("a", { stage: "qualificacao", stage_changed_at: "2026-11-05T10:00:00Z", assignee_id: "u1" }), // atrasado, humano
    row("b", { stage: "analise", serious_findings: 2, assignee_id: "u1" }), // humano
    row("c", { stage: "emissao", awaiting_payment: 3, price: "250000" }), // cliente
    row("d", { stage: "concluido", price: "999999", created_at: "2026-09-01T10:00:00Z" }),
  ],
  NOW,
);

describe("gestão", () => {
  it("indicadores contam só os ativos", () => {
    expect(kpis(orders)).toEqual({ active: 3, needHuman: 2, overdue: 1, withClient: 1, done: 1, activeValue: 450000, seriousRisks: 2 });
  });

  it("por etapa, com atrasados", () => {
    expect(byStage(orders).map((s) => [s.stage, s.count, s.overdue])).toEqual([
      ["qualificacao", 1, 1], ["consulta", 0, 0], ["analise", 1, 0], ["emissao", 1, 0], ["concluido", 1, 0],
    ]);
  });

  it("semanas começam na segunda e incluem semanas vazias", () => {
    expect(weekStart("2026-11-13T12:00:00Z")).toBe("2026-11-09");
    expect(weekStart("2026-11-09T00:00:00Z")).toBe("2026-11-09");
    const w = createdPerWeek(orders, NOW, 3);
    expect(w).toEqual([{ week: "2026-10-26", count: 0 }, { week: "2026-11-02", count: 0 }, { week: "2026-11-09", count: 3 }]);
  });

  it("carga por responsável, sem responsável por último", () => {
    expect(workload(orders)).toEqual([
      { assigneeId: "u1", active: 2, needHuman: 2, overdue: 1 },
      { assigneeId: null, active: 1, needHuman: 0, overdue: 0 },
    ]);
  });

  it("atenção: atrasados primeiro", () => {
    expect(attention(orders).map((o) => o.id)).toEqual(["a", "b"]);
  });
});


describe("formatCompactBRL", () => {
  it("abrevia milhões e milhares", () => {
    expect(formatCompactBRL(28_680_000)).toBe("R$ 28,7 mi");
    expect(formatCompactBRL(640_000)).toBe("R$ 640 mil");
    expect(formatCompactBRL(1_500_000_000)).toBe("R$ 1,5 bi");
  });
});
