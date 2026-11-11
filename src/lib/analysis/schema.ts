/**
 * Formato da leitura de um documento pela IA (saída estruturada).
 * Mantido simples: campos anuláveis em vez de opcionais, datas como "AAAA-MM-DD".
 */
import { z } from "zod";

export const extractionSchema = z.object({
  doc_type: z.string().describe("Tipo do documento, ex.: 'Certidão de inteiro teor da matrícula com ônus reais'."),
  issuer: z.string().nullable().describe("Órgão ou cartório emissor."),
  subject_name: z.string().nullable().describe("Nome da pessoa/empresa ou identificação do imóvel a que o documento se refere."),
  subject_document: z.string().nullable().describe("CPF, CNPJ ou matrícula, só dígitos quando for CPF/CNPJ."),
  issued_at: z.string().nullable().describe("Data de emissão no formato AAAA-MM-DD, ou null."),
  expires_at: z.string().nullable().describe("Data de validade impressa no formato AAAA-MM-DD, ou null se não houver."),
  result: z
    .enum(["negativa", "positiva", "positiva_efeito_negativa", "nao_se_aplica", "indeterminado"])
    .describe("Resultado da certidão. 'nao_se_aplica' quando não for certidão (contrato, declaração etc.)."),
  findings: z
    .array(
      z.object({
        severity: z.enum(["critico", "alto", "medio", "baixo"]),
        title: z.string().describe("Resumo curto do apontamento."),
        description: z.string().describe("O que o documento mostra e por que importa para o negócio."),
        evidence: z.string().nullable().describe("Trecho curto do documento que sustenta o apontamento."),
      }),
    )
    .describe("Ônus, ações, débitos, protestos, divergências ou outras ressalvas. Lista vazia se não houver."),
  matches_item: z.boolean().describe("O documento corresponde ao item do checklist e à pessoa/bem esperados?"),
  mismatch_reason: z.string().nullable().describe("Se não corresponde, por quê (outra pessoa, outro tipo de certidão, comarca errada...)."),
  suggested_status: z.enum(["completo", "parcial", "faltante"]).describe("Status sugerido para o item do checklist."),
  summary: z.string().describe("Resumo em 1–3 frases, em português, para o relatório."),
  confidence: z.enum(["alta", "media", "baixa"]).describe("Confiança na leitura (baixa se ilegível ou cortado)."),
});

export type Extraction = z.infer<typeof extractionSchema>;

/** Normaliza datas vindas da IA: só aceita AAAA-MM-DD válida. */
export function normalizeDate(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : value;
}
