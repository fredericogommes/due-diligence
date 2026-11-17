/**
 * Lê uma certidão/documento com o Claude e devolve campos estruturados.
 * O cliente é injetável para os testes (sem chamada real à API).
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { extractionSchema, normalizeDate, type Extraction } from "./schema";

import { DIRECT_DEFAULT_MODEL } from "./client";

export const DEFAULT_MODEL = DIRECT_DEFAULT_MODEL;

export type ItemContext = {
  code: string;
  title: string;
  description: string | null;
  /** Pessoa ou bem esperado ("João Silva — Vendedor", "Imóvel: Apto 101"). */
  subject: string | null;
  /** CPF/CNPJ ou matrícula esperados, se conhecidos. */
  expectedDocument: string | null;
  dealKind: string;
} | null;

export type ExtractInput = {
  fileBase64: string;
  mimeType: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
  fileName: string;
  item: ItemContext;
  today: string;
};

export type ExtractResult =
  | { ok: true; data: Extraction; model: string; inputTokens: number; outputTokens: number }
  | { ok: false; error: string; model: string };

/** Só o que usamos do SDK — facilita o dublê nos testes. */
export type MessagesClient = { beta: { messages: Pick<Anthropic["beta"]["messages"], "parse"> } };

const SYSTEM = `Você é um analista jurídico brasileiro que faz due diligence imobiliária e societária.
Leia o documento enviado (certidão, contrato, declaração, laudo) e extraia os dados pedidos com fidelidade ao texto.
Regras:
- Não invente: se um dado não aparece no documento, use null.
- Datas sempre no formato AAAA-MM-DD.
- "positiva" quando a certidão aponta ações, débitos, protestos, ônus ou restrições; "positiva_efeito_negativa" quando o próprio documento diz que tem efeito de negativa.
- Em matrícula de imóvel, registre como apontamento cada ônus vigente (hipoteca, alienação fiduciária, penhora, usufruto, indisponibilidade, ação reipersecutória) e diga se foi cancelado.
- Gravidade: critico = impede ou ameaça o negócio; alto = exige garantia ou condição; medio = exige esclarecimento; baixo = registro.
- Compare o documento com o item do checklist e com a pessoa/bem esperados; se não corresponder, explique em mismatch_reason.
- suggested_status: completo se o documento atende ao item; parcial se atende só em parte (ex.: falta uma comarca, um sócio, está ilegível ou vencido); faltante se não atende.
- Escreva em português do Brasil.`;

function itemText(item: ItemContext, today: string): string {
  if (!item) return `Documento enviado sem item do checklist. Data de hoje: ${today}.`;
  return [
    `Item do checklist: ${item.code} — ${item.title}.`,
    item.description ? `Descrição do item: ${item.description}` : null,
    item.subject ? `Refere-se a: ${item.subject}.` : null,
    item.expectedDocument ? `Documento/identificação esperada: ${item.expectedDocument}.` : null,
    `Tipo de negócio: ${item.dealKind}. Data de hoje: ${today}.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export type ExtractOptions = {
  /** Fallback de modelo feito pela própria Anthropic. Desligado no AI Gateway, que tem o seu. */
  serverFallback?: boolean;
};

export async function extractDocument(
  client: MessagesClient,
  input: ExtractInput,
  model = DEFAULT_MODEL,
  { serverFallback = true }: ExtractOptions = {},
): Promise<ExtractResult> {
  const fileBlock: Anthropic.Beta.BetaContentBlockParam =
    input.mimeType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: input.fileBase64 }, title: input.fileName }
      : { type: "image", source: { type: "base64", media_type: input.mimeType, data: input.fileBase64 } };

  try {
    const response = await client.beta.messages.parse({
      model,
      max_tokens: 16000,
      ...(serverFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      output_config: { effort: "medium", format: betaZodOutputFormat(extractionSchema) },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [fileBlock, { type: "text", text: `${itemText(input.item, input.today)}\n\nExtraia os dados do documento.` }],
        },
      ],
    });

    if (response.stop_reason === "refusal") return { ok: false, error: "A IA recusou a leitura deste documento.", model };
    if (response.stop_reason === "max_tokens") return { ok: false, error: "A resposta da IA foi cortada. Tente de novo.", model };
    const parsed = response.parsed_output;
    if (!parsed) return { ok: false, error: "A IA não devolveu dados no formato esperado.", model };

    return {
      ok: true,
      data: { ...parsed, issued_at: normalizeDate(parsed.issued_at), expires_at: normalizeDate(parsed.expires_at) },
      model: response.model ?? model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return { ok: false, error: "Credencial da IA inválida ou expirada.", model };
    if (err instanceof Anthropic.PermissionDeniedError) {
      return { ok: false, error: "Acesso à IA negado. No AI Gateway, confira se há cartão cadastrado na Vercel.", model };
    }
    if (err instanceof Anthropic.RateLimitError) return { ok: false, error: "Limite de uso da IA atingido. Tente em alguns minutos.", model };
    if (err instanceof Anthropic.BadRequestError) return { ok: false, error: "A IA não aceitou o arquivo (tamanho ou formato).", model };
    if (err instanceof Anthropic.APIError) return { ok: false, error: `Falha na IA (${err.status ?? "rede"}).`, model };
    return { ok: false, error: "Falha inesperada na leitura.", model };
  }
}
