/** Regras de arquivos de documentos (compartilhadas por cliente e servidor). */

export const DOCUMENTS_BUCKET = "documentos";
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
export const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export type AllowedMime = (typeof ALLOWED_MIME)[number];

export const DOC_RESULTS = ["negativa", "positiva", "positiva_efeito_negativa", "nao_se_aplica", "indeterminado"] as const;
export type DocResult = (typeof DOC_RESULTS)[number];
export const DOC_RESULT_LABEL: Record<DocResult, string> = {
  negativa: "Negativa",
  positiva: "Positiva (há apontamentos)",
  positiva_efeito_negativa: "Positiva com efeito de negativa",
  nao_se_aplica: "Não é certidão",
  indeterminado: "Não analisado",
};

export function isAllowedMime(mime: string): mime is AllowedMime {
  return (ALLOWED_MIME as readonly string[]).includes(mime);
}

/** Nome de arquivo seguro para o Storage: sem acentos, sem barras, até 120 caracteres, mantém a extensão. */
export function sanitizeFileName(name: string): string {
  const base = (name.split(/[\\/]/).pop() ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");
  const dot = base.lastIndexOf(".");
  const stem = (dot > 0 ? base.slice(0, dot) : base).replace(/[^A-Za-z0-9._-]+/g, "_").replace(/_+/g, "_").replace(/^[._]+|[._]+$/g, "");
  const ext = dot > 0 ? base.slice(dot + 1).replace(/[^A-Za-z0-9]/g, "").toLowerCase().slice(0, 8) : "";
  const safeStem = (stem || "arquivo").slice(0, 110);
  return ext ? `${safeStem}.${ext}` : safeStem;
}

/** Caminho no bucket: <org>/<negócio>/<id>-<nome>. A RLS do Storage usa o primeiro segmento. */
export function buildStoragePath(orgId: string, dealId: string, id: string, fileName: string): string {
  return `${orgId}/${dealId}/${id}-${sanitizeFileName(fileName)}`;
}

/** Confere se o caminho pertence à pasta do negócio (defesa em profundidade no servidor). */
export function isPathInDeal(path: string, orgId: string, dealId: string): boolean {
  const prefix = `${orgId}/${dealId}/`;
  return path.startsWith(prefix) && path.length > prefix.length && !path.slice(prefix.length).includes("/") && !path.includes("..");
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
