import { describe, expect, it } from "vitest";
import { buildStoragePath, formatBytes, isAllowedMime, isPathInDeal, sanitizeFileName } from "@/lib/documents";

const ORG = "11111111-1111-4111-8111-111111111111";
const DEAL = "22222222-2222-4222-8222-222222222222";

describe("sanitizeFileName", () => {
  it("remove acentos, espaços e barras e mantém a extensão", () => {
    expect(sanitizeFileName("Certidão Ônus Reais (matrícula 123).PDF")).toBe("Certidao_Onus_Reais_matricula_123.pdf");
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("C:\\docs\\cnd.pdf")).toBe("cnd.pdf");
    expect(sanitizeFileName(".pdf")).toBe("pdf");
    expect(sanitizeFileName("")).toBe("arquivo");
  });
  it("limita o tamanho", () => {
    expect(sanitizeFileName(`${"a".repeat(300)}.pdf`)).toHaveLength(114);
  });
});

describe("caminhos", () => {
  it("monta e reconhece o caminho do negócio", () => {
    const p = buildStoragePath(ORG, DEAL, "abc", "CND federal.pdf");
    expect(p).toBe(`${ORG}/${DEAL}/abc-CND_federal.pdf`);
    expect(isPathInDeal(p, ORG, DEAL)).toBe(true);
  });
  it("recusa caminho de outro negócio, subpastas e ..", () => {
    expect(isPathInDeal(`${ORG}/outro/abc.pdf`, ORG, DEAL)).toBe(false);
    expect(isPathInDeal(`${ORG}/${DEAL}/x/abc.pdf`, ORG, DEAL)).toBe(false);
    expect(isPathInDeal(`${ORG}/${DEAL}/..abc.pdf`, ORG, DEAL)).toBe(false);
    expect(isPathInDeal(`${ORG}/${DEAL}/`, ORG, DEAL)).toBe(false);
  });
});

describe("outros", () => {
  it("tipos permitidos", () => {
    expect(isAllowedMime("application/pdf")).toBe(true);
    expect(isAllowedMime("application/zip")).toBe(false);
  });
  it("formata bytes", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});
