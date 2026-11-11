import { describe, expect, it } from "vitest";
import { bestValidity, computeValidity, todaySaoPaulo, worstValidity } from "@/lib/checklist/validity";

describe("computeValidity", () => {
  const today = "2026-11-11";

  it("usa a validade impressa quando existe", () => {
    expect(computeValidity({ issued_at: "2026-10-01", expires_at: "2026-12-01" }, 30, today)).toEqual({
      state: "valida", until: "2026-12-01", daysLeft: 20, basis: "impressa",
    });
  });

  it("sem validade impressa, usa emissão + prazo de referência", () => {
    // 2026-10-01 + 30 dias = 2026-10-31 → vencida há 11 dias
    expect(computeValidity({ issued_at: "2026-10-01", expires_at: null }, 30, today)).toEqual({
      state: "vencida", until: "2026-10-31", daysLeft: -11, basis: "referencia",
    });
  });

  it("avisa quando faltam 7 dias ou menos, e vence no dia seguinte ao limite", () => {
    expect(computeValidity({ issued_at: null, expires_at: "2026-11-18" }, null, today).state).toBe("a_vencer");
    expect(computeValidity({ issued_at: null, expires_at: "2026-11-19" }, null, today).state).toBe("valida");
    expect(computeValidity({ issued_at: null, expires_at: "2026-11-11" }, null, today).state).toBe("a_vencer");
    expect(computeValidity({ issued_at: null, expires_at: "2026-11-10" }, null, today).state).toBe("vencida");
  });

  it("sem datas ou sem prazo de referência → sem_data", () => {
    expect(computeValidity({ issued_at: null, expires_at: null }, 30, today).state).toBe("sem_data");
    expect(computeValidity({ issued_at: "2026-10-01", expires_at: null }, null, today).state).toBe("sem_data");
  });

  it("atravessa troca de ano e mês curto", () => {
    expect(computeValidity({ issued_at: "2026-12-15", expires_at: null }, 180, today).until).toBe("2027-06-13");
    expect(computeValidity({ issued_at: "2028-02-28", expires_at: null }, 1, today).until).toBe("2028-02-29");
  });
});

describe("agregação", () => {
  it("pior e melhor estado", () => {
    expect(worstValidity(["valida", "vencida", "sem_data"])).toBe("vencida");
    expect(bestValidity(["vencida", "valida"])).toBe("valida");
    expect(worstValidity([])).toBeNull();
  });
});

describe("todaySaoPaulo", () => {
  it("usa o fuso de São Paulo (01:00 UTC ainda é o dia anterior)", () => {
    expect(todaySaoPaulo(new Date("2026-11-12T01:00:00Z"))).toBe("2026-11-11");
    expect(todaySaoPaulo(new Date("2026-11-12T04:00:00Z"))).toBe("2026-11-12");
  });
});
