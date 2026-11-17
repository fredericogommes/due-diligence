/**
 * De onde vem a IA: chave direta da Anthropic ou Vercel AI Gateway.
 *
 * - ANTHROPIC_API_KEY: chama a API da Anthropic diretamente.
 * - AI_GATEWAY_API_KEY, ou VERCEL_OIDC_TOKEN (presente sozinho nos deploys da
 *   Vercel) com AI_GATEWAY_ENABLED=1: chama pelo AI Gateway, com os nomes de
 *   modelo "anthropic/...". O token OIDC sempre existe na Vercel, por isso
 *   ele só liga a IA quando AI_GATEWAY_ENABLED=1 (o plano grátis do Gateway
 *   não dá acesso aos modelos da Anthropic).
 *
 * A chave direta tem preferência quando as duas existem.
 */
import Anthropic from "@anthropic-ai/sdk";

export const GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh";
export const DIRECT_DEFAULT_MODEL = "claude-opus-5-5";
export const GATEWAY_DEFAULT_MODEL = "anthropic/claude-opus-5.5";

export type AiConfig = {
  via: "anthropic" | "gateway";
  apiKey: string;
  baseURL?: string;
  model: string;
};

type Env = Record<string, string | undefined>;

export function aiConfig(env: Env = process.env): AiConfig | null {
  const direct = env.ANTHROPIC_API_KEY?.trim();
  if (direct) return { via: "anthropic", apiKey: direct, model: env.ANTHROPIC_MODEL || DIRECT_DEFAULT_MODEL };
  const oidc = env.AI_GATEWAY_ENABLED === "1" ? env.VERCEL_OIDC_TOKEN?.trim() : undefined;
  const gateway = env.AI_GATEWAY_API_KEY?.trim() || oidc;
  if (gateway) {
    return { via: "gateway", apiKey: gateway, baseURL: GATEWAY_BASE_URL, model: env.AI_GATEWAY_MODEL || GATEWAY_DEFAULT_MODEL };
  }
  return null;
}

export function aiEnabled(env: Env = process.env): boolean {
  return aiConfig(env) !== null;
}

export function createAiClient(cfg: AiConfig): Anthropic {
  return new Anthropic({ apiKey: cfg.apiKey, baseURL: cfg.baseURL });
}
