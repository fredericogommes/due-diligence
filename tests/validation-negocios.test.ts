import { describe, expect, it } from "vitest";
import { formatDocument } from "@/lib/domain";
import { assetSchema, dealSchema, isValidCpf, partySchema } from "@/lib/validation";

const DEAL = "11111111-1111-4111-8111-111111111111";
const ORG = "22222222-2222-4222-8222-222222222222";

describe("isValidCpf", () => {
  it("aceita CPF válido e recusa inválido", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224724")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("123")).toBe(false);
  });
});

describe("dealSchema", () => {
  it("converte o valor em formato brasileiro", () => {
    const r = dealSchema.parse({ orgId: ORG, kind: "compra_venda_imovel", title: "Apto", price: "1.250.000,50", notes: "" });
    expect(r.price).toBe(1250000.5);
    expect(r.notes).toBeUndefined();
  });
  it("aceita ponto decimal e valor vazio", () => {
    expect(dealSchema.parse({ orgId: ORG, kind: "cessao_cotas", title: "AME", price: "900000.00" }).price).toBe(900000);
    expect(dealSchema.parse({ orgId: ORG, kind: "cessao_cotas", title: "AME", price: "" }).price).toBeUndefined();
  });
  it("recusa valor negativo, tipo desconhecido e título curto", () => {
    expect(dealSchema.safeParse({ orgId: ORG, kind: "cessao_cotas", title: "AME", price: "-1" }).success).toBe(false);
    expect(dealSchema.safeParse({ orgId: ORG, kind: "permuta", title: "AME" }).success).toBe(false);
    expect(dealSchema.safeParse({ orgId: ORG, kind: "cessao_cotas", title: "A" }).success).toBe(false);
  });
});

describe("partySchema", () => {
  const base = { dealId: DEAL, kind: "pf", role: "vendedor", name: "João" };
  it("valida CPF para PF e CNPJ para PJ", () => {
    expect(partySchema.parse({ ...base, document: "529.982.247-25" }).document).toBe("52998224725");
    expect(partySchema.safeParse({ ...base, document: "49.960.745/0001-91" }).success).toBe(false);
    expect(partySchema.safeParse({ ...base, kind: "pj", document: "49.960.745/0001-91" }).success).toBe(true);
  });
  it("documento vazio vira undefined", () => {
    expect(partySchema.parse({ ...base, document: "" }).document).toBeUndefined();
  });
  it("regime de bens só para casado ou união estável; estado civil só PF", () => {
    expect(partySchema.safeParse({ ...base, maritalStatus: "casado", propertyRegime: "comunhao_parcial" }).success).toBe(true);
    expect(partySchema.safeParse({ ...base, maritalStatus: "solteiro", propertyRegime: "comunhao_parcial" }).success).toBe(false);
    expect(partySchema.safeParse({ ...base, kind: "pj", maritalStatus: "casado" }).success).toBe(false);
    expect(partySchema.parse({ ...base, maritalStatus: "", propertyRegime: "" }).maritalStatus).toBeUndefined();
  });
});

describe("assetSchema", () => {
  it("imóvel guarda matrícula e descarta CNPJ", () => {
    const r = assetSchema.parse({ dealId: DEAL, kind: "imovel", description: "Apto 101", matricula: "12.345", cns: "12.345-6", cnpj: "49960745000191", uf: "RJ" });
    expect(r).toMatchObject({ matricula: "12.345", cns: "123456", cnpj: undefined, uf: "RJ" });
  });
  it("empresa guarda CNPJ e descarta matrícula", () => {
    const r = assetSchema.parse({ dealId: DEAL, kind: "empresa", description: "AME", matricula: "1", cnpj: "49.960.745/0001-91" });
    expect(r).toMatchObject({ matricula: undefined, cnpj: "49960745000191" });
  });
  it("recusa CNS com tamanho errado e UF inválida", () => {
    expect(assetSchema.safeParse({ dealId: DEAL, kind: "imovel", description: "X1", cns: "123" }).success).toBe(false);
    expect(assetSchema.safeParse({ dealId: DEAL, kind: "imovel", description: "X1", uf: "XX" }).success).toBe(false);
  });
});

describe("formatDocument", () => {
  it("formata CPF e CNPJ", () => {
    expect(formatDocument("52998224725")).toBe("529.982.247-25");
    expect(formatDocument("49960745000191")).toBe("49.960.745/0001-91");
  });
});
