import { describe, expect, it } from "vitest";
import { nextStage, stageAging, taskOwner } from "@/lib/board";

const base = {
  stage: "qualificacao" as const, parties: 0, assets: 0, previews: 0, open_findings: 0, serious_findings: 0,
  awaiting_payment: 0, issuing: 0, issued: 0, signed_version: null,
};

describe("nextStage", () => {
  it("avança conforme o que já aconteceu, várias etapas de uma vez se preciso", () => {
    expect(nextStage(base)).toBe("qualificacao");
    expect(nextStage({ ...base, parties: 1 })).toBe("qualificacao");
    expect(nextStage({ ...base, parties: 1, assets: 1 })).toBe("consulta");
    expect(nextStage({ ...base, parties: 1, assets: 1, previews: 5 })).toBe("analise");
    expect(nextStage({ ...base, stage: "analise", awaiting_payment: 3 })).toBe("emissao");
    expect(nextStage({ ...base, stage: "emissao", issued: 3 })).toBe("concluido");
    expect(nextStage({ ...base, stage: "emissao", issued: 3, issuing: 1 })).toBe("emissao");
  });

  it("nunca volta sozinho", () => {
    expect(nextStage({ ...base, stage: "analise" })).toBe("analise");
    expect(nextStage({ ...base, stage: "concluido" })).toBe("concluido");
  });
});

describe("taskOwner", () => {
  it("qualificação é humana e diz o que falta", () => {
    expect(taskOwner(base)).toEqual({ who: "humano", reason: "Cadastrar o objeto (bem) e as partes" });
  });
  it("consulta prévia é da IA", () => {
    expect(taskOwner({ ...base, stage: "consulta" }).who).toBe("ia");
  });
  it("análise: riscos sérios ou relatório sem assinatura pedem humano; assinado vai ao cliente", () => {
    expect(taskOwner({ ...base, stage: "analise", serious_findings: 2 })).toEqual({ who: "humano", reason: "Revisar 2 riscos altos/críticos" });
    expect(taskOwner({ ...base, stage: "analise" }).reason).toMatch(/assinar/);
    expect(taskOwner({ ...base, stage: "analise", signed_version: 1 }).who).toBe("cliente");
  });
  it("emissão: boleto é com o cliente; emissão em andamento com a IA", () => {
    expect(taskOwner({ ...base, stage: "emissao", awaiting_payment: 1 })).toEqual({ who: "cliente", reason: "Pagar 1 boleto" });
    expect(taskOwner({ ...base, stage: "emissao", issuing: 2 }).who).toBe("ia");
  });
});


describe("stageAging", () => {
  const now = "2026-11-13T12:00:00Z";
  it("no prazo, atenção e atrasado conforme o prazo da etapa", () => {
    expect(stageAging("analise", "2026-11-13T08:00:00Z", now)).toEqual({ days: 0, sla: 3, state: "no_prazo" });
    expect(stageAging("analise", "2026-11-10T11:00:00Z", now)).toEqual({ days: 3, sla: 3, state: "atencao" });
    expect(stageAging("analise", "2026-11-09T11:00:00Z", now)).toEqual({ days: 4, sla: 3, state: "atrasado" });
    expect(stageAging("consulta", "2026-11-11T11:00:00Z", now).state).toBe("atrasado");
    expect(stageAging("concluido", "2026-01-01T00:00:00Z", now).state).toBe("no_prazo");
  });
});
