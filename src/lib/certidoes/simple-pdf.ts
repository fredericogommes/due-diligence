/**
 * Gera um PDF de texto simples (A4, Helvetica, WinAnsi) sem dependências.
 * Usado pelo provedor simulado de certidões.
 */

const WIN_ANSI_EXTRA: Record<string, number> = { "—": 0x97, "–": 0x96, "“": 0x93, "”": 0x94, "º": 0xba, "ª": 0xaa, "•": 0x95 };

/** Converte texto para bytes WinAnsi e escapa para string literal PDF. */
function pdfString(text: string): string {
  let out = "";
  for (const ch of text) {
    let code = ch.codePointAt(0)!;
    if (WIN_ANSI_EXTRA[ch] !== undefined) code = WIN_ANSI_EXTRA[ch];
    else if (code > 0xff) code = 0x3f; // "?"
    if (code === 0x28 || code === 0x29 || code === 0x5c) out += `\\${String.fromCharCode(code)}`;
    else if (code < 0x20 || code > 0x7e) out += `\\${code.toString(8).padStart(3, "0")}`;
    else out += String.fromCharCode(code);
  }
  return `(${out})`;
}

/** Quebra linhas longas (aprox. 95 caracteres em corpo 10). */
function wrap(line: string, width = 95): string[] {
  if (line.length <= width) return [line];
  const words = line.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > width) {
      if (cur) lines.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}

export function simplePdf(title: string, body: string[]): Uint8Array {
  const lines = body.flatMap((l) => wrap(l));
  const ops = ["BT", "/F2 14 Tf", "56 790 Td", `${pdfString(title)} Tj`, "/F1 10 Tf", "0 -28 Td", "14 TL"];
  for (const l of lines.slice(0, 50)) ops.push(`${pdfString(l)} '`);
  ops.push("ET");
  const content = ops.join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) pdf += `${String(o).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  // Todos os caracteres já estão em 0x00–0xFF: 1 byte cada.
  return Uint8Array.from(pdf, (c) => c.charCodeAt(0));
}
