import { afterEach, describe, expect, it, vi } from "vitest";
import { providerOptions, registroImoveisProvider, simulatedProvider } from "@/lib/certidoes/providers";
import { simplePdf } from "@/lib/certidoes/simple-pdf";

const latin1 = (b: Uint8Array) => Array.from(b, (c) => String.fromCharCode(c)).join("");

describe("simplePdf", () => {
  it("gera PDF válido com xref apontando para os objetos", () => {
    const text = latin1(simplePdf("CERTIDÃO (teste)", ["Linha com acento: ação — º", "x".repeat(200)]));
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    const startxref = Number(text.match(/startxref\n(\d+)/)![1]);
    expect(text.slice(startxref, startxref + 4)).toBe("xref");
    const offsets = [...text.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    offsets.forEach((o, i) => expect(text.slice(o, o + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`));
    expect(text).toContain("\\(teste\\)"); // parênteses escapados
    expect(text).toContain("\\303"); // Ã em WinAnsi (octal)
  });

  it("o /Length bate com o tamanho do stream", () => {
    const text = latin1(simplePdf("T", ["a", "b"]));
    const len = Number(text.match(/\/Length (\d+)/)![1]);
    const start = text.indexOf("stream\n") + 7;
    const end = text.indexOf("\nendstream");
    expect(end - start).toBe(len);
  });
});

describe("provedores", () => {
  afterEach(() => vi.unstubAllEnvs());
  const imovel = { itemCode: "IMV-01", itemTitle: "Matrícula", asset: { description: "Apto", matricula: null, cartorio: null, cns: null, municipio: null, uf: null } };

  it("simulado gera certidão negativa em PDF com validade de 30 dias", async () => {
    const r = await simulatedProvider.request({ itemCode: "VPF-03", itemTitle: "CND federal", party: { name: "João", document: "52998224725" } }, "2026-11-11");
    expect(r.status).toBe("concluido");
    if (r.status === "concluido") {
      expect(r.meta).toMatchObject({ issuedAt: "2026-11-11", expiresAt: "2026-12-11", result: "negativa" });
      expect(latin1(r.file.bytes)).toContain("52998224725");
    }
  });

  it("simulado fica desligado em produção, salvo CERTIDOES_SIMULADO=1", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(simulatedProvider.availability().available).toBe(false);
    vi.stubEnv("CERTIDOES_SIMULADO", "1");
    expect(simulatedProvider.availability().available).toBe(true);
  });

  it("registro de imóveis só atende matrícula, lista o que falta e explica a indisponibilidade", () => {
    vi.stubEnv("REGISTRO_IMOVEIS_API_KEY", "");
    const opts = providerOptions(imovel);
    const ri = opts.find((o) => o.id === "registro-imoveis")!;
    expect(ri.available).toBe(false);
    expect(ri.reason).toMatch(/chave de API/);
    expect(ri.missing).toEqual(["número da matrícula", "cartório (CNS ou nome)", "UF"]);
    expect(registroImoveisProvider.supports("VPF-03")).toBe(false);
    expect(providerOptions({ itemCode: "VPF-03", itemTitle: "x" }).map((o) => o.id)).toEqual(["simulado"]);
  });
});
