/**
 * Tipo real do arquivo pela assinatura dos primeiros bytes ("magic bytes"),
 * em vez de confiar no MIME declarado pelo navegador (MK-01 §3/M04, gate G04).
 * Só reconhece os tipos aceitos pelo sistema; o resto devolve null.
 */
import type { AllowedMime } from "./documents";

const startsWith = (b: Uint8Array, sig: number[], offset = 0) => sig.every((v, i) => b[offset + i] === v);

export function detectMime(bytes: Uint8Array): AllowedMime | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp"; // RIFF....WEBP
  return null;
}

export type FileCheck =
  | { ok: true; mime: AllowedMime; sha256: string; size: number }
  | { ok: false; reason: string };

/**
 * Confere o arquivo recebido: tamanho, tipo real igual ao declarado e, se o
 * navegador enviou um hash, que ele bate com o calculado aqui.
 */
export async function checkUploadedFile(
  bytes: Uint8Array,
  declared: { mimeType: string; sizeBytes: number; sha256?: string | null },
  maxBytes: number,
): Promise<FileCheck> {
  if (bytes.byteLength === 0) return { ok: false, reason: "Arquivo vazio." };
  if (bytes.byteLength > maxBytes) return { ok: false, reason: "Arquivo maior que o limite." };
  if (bytes.byteLength !== declared.sizeBytes) return { ok: false, reason: "O tamanho do arquivo não confere com o enviado." };
  const mime = detectMime(bytes);
  if (!mime) return { ok: false, reason: "Tipo de arquivo não reconhecido (use PDF, JPG, PNG ou WEBP)." };
  if (mime !== declared.mimeType) return { ok: false, reason: "O conteúdo do arquivo não corresponde à extensão/tipo informado." };
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  const sha256 = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  if (declared.sha256 && declared.sha256 !== sha256) return { ok: false, reason: "O arquivo foi alterado no envio (hash diferente)." };
  return { ok: true, mime, sha256, size: bytes.byteLength };
}
