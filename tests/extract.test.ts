import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { extractDocument, type MessagesClient } from "@/lib/analysis/extract";
import { normalizeDate, type Extraction } from "@/lib/analysis/schema";

const sample: Extraction = {
  doc_type: "Certidão de inteiro teor da matrícula",
  issuer: "2º RI de Volta Redonda",
  subject_name: "Apto 101",
  subject_document: "12345",
  issued_at: "2026-11-01",
  expires_at: "31/12/2026",
  result: "positiva",
  findings: [{ severity: "alto", title: "Hipoteca em favor do Banco X", description: "R.5 sem cancelamento", evidence: "R.5/12345" }],
  matches_item: true,
  mismatch_reason: null,
  suggested_status: "completo",
  summary: "Matrícula com hipoteca vigente.",
  confidence: "alta",
};

function fakeClient(impl: () => unknown): { client: MessagesClient; parse: ReturnType<typeof vi.fn> } {
  const parse = vi.fn(async () => impl());
  return { client: { beta: { messages: { parse } } } as unknown as MessagesClient, parse };
}

const input = {
  fileBase64: "JVBERi0=",
  mimeType: "application/pdf" as const,
  fileName: "matricula.pdf",
  item: { code: "IMV-01", title: "Certidão de inteiro teor da matrícula", description: null, subject: "Imóvel: Apto 101", expectedDocument: "12345", dealKind: "compra_venda_imovel" },
  today: "2026-11-11",
};

describe("extractDocument", () => {
  it("envia PDF como bloco document, com fallback e saída estruturada, e normaliza datas", async () => {
    const { client, parse } = fakeClient(() => ({
      stop_reason: "end_turn", parsed_output: sample, model: "claude-opus-5-5", usage: { input_tokens: 1000, output_tokens: 200 },
    }));
    const r = await extractDocument(client, input);
    expect(r).toMatchObject({ ok: true, inputTokens: 1000, outputTokens: 200 });
    if (r.ok) {
      expect(r.data.issued_at).toBe("2026-11-01");
      expect(r.data.expires_at).toBeNull(); // formato inválido descartado
    }
    const params = parse.mock.calls[0][0];
    expect(params.model).toBe("claude-opus-5-5");
    expect(params.fallbacks).toBe("default");
    expect(params.betas).toContain("server-side-fallback-2026-07-01");
    expect(params.messages[0].content[0]).toMatchObject({ type: "document", source: { media_type: "application/pdf" } });
    expect(params.messages[0].content[1].text).toContain("IMV-01");
    expect(params.messages[0].content[1].text).toContain("Apto 101");
    expect(params.thinking).toBeUndefined();
  });

  it("imagem vai como bloco image", async () => {
    const { client, parse } = fakeClient(() => ({ stop_reason: "end_turn", parsed_output: sample, usage: { input_tokens: 1, output_tokens: 1 } }));
    await extractDocument(client, { ...input, mimeType: "image/png", item: null });
    expect(parse.mock.calls[0][0].messages[0].content[0]).toMatchObject({ type: "image", source: { media_type: "image/png" } });
  });

  it("trata recusa, corte e saída vazia", async () => {
    for (const [stop, parsed, msg] of [
      ["refusal", null, /recusou/],
      ["max_tokens", null, /cortada/],
      ["end_turn", null, /formato esperado/],
    ] as const) {
      const { client } = fakeClient(() => ({ stop_reason: stop, parsed_output: parsed, usage: { input_tokens: 1, output_tokens: 1 } }));
      const r = await extractDocument(client, input);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(msg);
    }
  });

  it("traduz erros da API", async () => {
    const { client } = fakeClient(() => {
      throw new Anthropic.RateLimitError(429, undefined, "rate", new Headers());
    });
    const r = await extractDocument(client, input);
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/Limite/) });
  });
});

describe("normalizeDate", () => {
  it("aceita só datas reais AAAA-MM-DD", () => {
    expect(normalizeDate("2026-02-28")).toBe("2026-02-28");
    expect(normalizeDate("2026-02-30")).toBeNull();
    expect(normalizeDate("28/02/2026")).toBeNull();
    expect(normalizeDate(null)).toBeNull();
  });
});
