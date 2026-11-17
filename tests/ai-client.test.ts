import { describe, expect, it, vi } from "vitest";
import { aiConfig, aiEnabled, GATEWAY_BASE_URL } from "@/lib/analysis/client";
import { extractDocument, type MessagesClient } from "@/lib/analysis/extract";

describe("aiConfig", () => {
  it("sem credencial, IA desligada", () => {
    expect(aiConfig({})).toBeNull();
    expect(aiEnabled({ ANTHROPIC_API_KEY: "  " })).toBe(false);
  });
  it("chave da Anthropic tem preferência e usa o nome de modelo direto", () => {
    expect(aiConfig({ ANTHROPIC_API_KEY: "k", VERCEL_OIDC_TOKEN: "t" })).toEqual({ via: "anthropic", apiKey: "k", model: "claude-opus-5-5" });
  });
  it("AI Gateway por chave própria ou pelo token OIDC da Vercel", () => {
    expect(aiConfig({ VERCEL_OIDC_TOKEN: "t" })).toBeNull(); // token da Vercel sozinho não liga a IA
    expect(aiConfig({ VERCEL_OIDC_TOKEN: "t", AI_GATEWAY_ENABLED: "1" })).toEqual({ via: "gateway", apiKey: "t", baseURL: GATEWAY_BASE_URL, model: "anthropic/claude-opus-5.5" });
    expect(aiConfig({ AI_GATEWAY_API_KEY: "g", VERCEL_OIDC_TOKEN: "t", AI_GATEWAY_MODEL: "anthropic/claude-sonnet-5.5" }))
      .toMatchObject({ apiKey: "g", model: "anthropic/claude-sonnet-5.5" });
  });
});

describe("extractDocument pelo Gateway", () => {
  it("não envia o fallback do servidor da Anthropic", async () => {
    const parse = vi.fn(async () => ({ stop_reason: "end_turn", parsed_output: null, usage: { input_tokens: 1, output_tokens: 1 } }));
    const client = { beta: { messages: { parse } } } as unknown as MessagesClient;
    await extractDocument(client, { fileBase64: "JVBERi0=", mimeType: "application/pdf", fileName: "x.pdf", item: null, today: "2026-11-16" },
      "anthropic/claude-opus-5.5", { serverFallback: false });
    const body = (parse.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(body.betas).toBeUndefined();
    expect(body.fallbacks).toBeUndefined();
    expect(body.model).toBe("anthropic/claude-opus-5.5");
  });
});
