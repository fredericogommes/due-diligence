import { describe, expect, it } from "vitest";
import { isPublicPath, safeNextPath } from "@/lib/routes";
import { isValidCnpj, organizationSchema, signUpSchema } from "@/lib/validation";

describe("isValidCnpj", () => {
  it("aceita CNPJ válido com ou sem pontuação", () => {
    expect(isValidCnpj("49.960.745/0001-91")).toBe(true); // AME, do checklist
    expect(isValidCnpj("11222333000181")).toBe(true);
  });
  it("recusa dígito errado, tamanho errado e sequência repetida", () => {
    expect(isValidCnpj("49.960.745/0001-90")).toBe(false);
    expect(isValidCnpj("1122233300018")).toBe(false);
    expect(isValidCnpj("11111111111111")).toBe(false);
  });
});

describe("organizationSchema", () => {
  it("normaliza o CNPJ para só dígitos", () => {
    const r = organizationSchema.parse({ name: "  TETTU  ", cnpj: "49.960.745/0001-91" });
    expect(r).toEqual({ name: "TETTU", cnpj: "49960745000191" });
  });
  it("CNPJ é opcional", () => {
    expect(organizationSchema.safeParse({ name: "TETTU", cnpj: "" }).success).toBe(true);
  });
  it("recusa nome curto e CNPJ inválido", () => {
    expect(organizationSchema.safeParse({ name: "T" }).success).toBe(false);
    expect(organizationSchema.safeParse({ name: "TETTU", cnpj: "123" }).success).toBe(false);
  });
});

describe("signUpSchema", () => {
  it("exige e-mail, senha de 8+ e nome", () => {
    expect(signUpSchema.safeParse({ email: "a@b.com", password: "12345678", fullName: "Ana" }).success).toBe(true);
    expect(signUpSchema.safeParse({ email: "a@b", password: "12345678", fullName: "Ana" }).success).toBe(false);
    expect(signUpSchema.safeParse({ email: "a@b.com", password: "123", fullName: "Ana" }).success).toBe(false);
  });
});

describe("rotas", () => {
  it("só login e auth são públicas", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/auth/confirm")).toBe(true);
    expect(isPublicPath("/macedo-keenan")).toBe(true);
    expect(isPublicPath("/macedo-keenanx")).toBe(false);
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/loginx")).toBe(false);
    expect(isPublicPath("/negocios")).toBe(false);
  });
  it("safeNextPath bloqueia redirecionamento externo", () => {
    expect(safeNextPath("/negocios")).toBe("/negocios");
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("/\\evil.com")).toBe("/");
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });
});
