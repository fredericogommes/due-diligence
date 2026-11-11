import { describe, expect, it } from "vitest";
import { maskBRL } from "@/lib/money";

describe("maskBRL", () => {
  it("formata como centavos à medida que se digita", () => {
    expect(maskBRL("1")).toBe("0,01");
    expect(maskBRL("12")).toBe("0,12");
    expect(maskBRL("123")).toBe("1,23");
    expect(maskBRL("125000000")).toBe("1.250.000,00");
  });
  it("aceita texto já formatado ou colado com R$", () => {
    expect(maskBRL("R$ 1.250.000,00")).toBe("1.250.000,00");
    expect(maskBRL("850.000,005")).toBe("8.500.000,05");
  });
  it("vazio ou zeros viram vazio", () => {
    expect(maskBRL("")).toBe("");
    expect(maskBRL("000")).toBe("");
    expect(maskBRL("abc")).toBe("");
  });
});
