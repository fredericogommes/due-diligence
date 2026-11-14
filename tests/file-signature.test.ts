import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { checkUploadedFile, detectMime } from "@/lib/file-signature";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...Buffer.from(p, "latin1")] : p)));
const PDF = bytes("%PDF-1.4\n", "conteudo sintetico");
const PNG = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "png");
const JPG = bytes([0xff, 0xd8, 0xff, 0xe0], "jpg");
const WEBP = bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 ");
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

describe("detectMime", () => {
  it("reconhece os tipos aceitos pelos primeiros bytes", () => {
    expect(detectMime(PDF)).toBe("application/pdf");
    expect(detectMime(PNG)).toBe("image/png");
    expect(detectMime(JPG)).toBe("image/jpeg");
    expect(detectMime(WEBP)).toBe("image/webp");
  });
  it("não reconhece executável, HTML ou texto, mesmo com nome .pdf", () => {
    expect(detectMime(bytes("MZ", [0x90, 0]))).toBeNull();
    expect(detectMime(bytes("<html><script>"))).toBeNull();
    expect(detectMime(bytes(" %PDF-1.4"))).toBeNull();
    expect(detectMime(bytes("RIFF", [0, 0, 0, 0], "WAVE"))).toBeNull();
  });
});

describe("checkUploadedFile", () => {
  const MAX = 1024;
  it("aceita o arquivo íntegro e devolve tipo, tamanho e hash calculados no servidor", async () => {
    const r = await checkUploadedFile(PDF, { mimeType: "application/pdf", sizeBytes: PDF.byteLength, sha256: sha(PDF) }, MAX);
    expect(r).toEqual({ ok: true, mime: "application/pdf", sha256: sha(PDF), size: PDF.byteLength });
  });
  it("sem hash do navegador, calcula mesmo assim", async () => {
    const r = await checkUploadedFile(PNG, { mimeType: "image/png", sizeBytes: PNG.byteLength }, MAX);
    expect(r.ok && r.sha256).toBe(sha(PNG));
  });
  it("recusa tipo declarado diferente do conteúdo (HTML disfarçado de PDF)", async () => {
    const html = bytes("<html>");
    expect((await checkUploadedFile(html, { mimeType: "application/pdf", sizeBytes: html.byteLength }, MAX)).ok).toBe(false);
    const r = await checkUploadedFile(PNG, { mimeType: "application/pdf", sizeBytes: PNG.byteLength }, MAX);
    expect(r).toEqual({ ok: false, reason: "O conteúdo do arquivo não corresponde à extensão/tipo informado." });
  });
  it("recusa arquivo alterado no envio, tamanho divergente, vazio e acima do limite", async () => {
    expect((await checkUploadedFile(PDF, { mimeType: "application/pdf", sizeBytes: PDF.byteLength, sha256: "0".repeat(64) }, MAX)).ok).toBe(false);
    expect((await checkUploadedFile(PDF, { mimeType: "application/pdf", sizeBytes: 1 }, MAX)).ok).toBe(false);
    expect((await checkUploadedFile(new Uint8Array(), { mimeType: "application/pdf", sizeBytes: 0 }, MAX)).ok).toBe(false);
    const big = new Uint8Array(MAX + 1); big.set(PDF);
    expect(await checkUploadedFile(big, { mimeType: "application/pdf", sizeBytes: big.byteLength }, MAX)).toEqual({ ok: false, reason: "Arquivo maior que o limite." });
  });
});
