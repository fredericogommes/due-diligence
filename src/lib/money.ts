/**
 * Máscara de valor em reais para campos de formulário: os dígitos digitados
 * entram pela direita como centavos e o texto sai já com pontos e vírgula.
 * "125000000" → "1.250.000,00"; "" → "".
 */
export function maskBRL(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 15);
  if (!digits || /^0+$/.test(digits)) return "";
  const padded = digits.padStart(3, "0");
  const int = padded.slice(0, -2).replace(/^0+(?=\d)/, "");
  const cents = padded.slice(-2);
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${cents}`;
}
