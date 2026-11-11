/**
 * Validade de documentos/certidões.
 * Regra: vale a data de validade impressa (expires_at). Sem ela, usa a emissão
 * + prazo de referência do item do modelo (validity_days). Sem nada, "sem_data".
 */

export type ValidityState = "valida" | "a_vencer" | "vencida" | "sem_data";

export const VALIDITY_LABEL: Record<ValidityState, string> = {
  valida: "Válida",
  a_vencer: "Vence em breve",
  vencida: "Vencida",
  sem_data: "Sem data",
};

/** Dias de antecedência para avisar que vai vencer. */
export const EXPIRING_SOON_DAYS = 7;

export type Validity = { state: ValidityState; until: string | null; daysLeft: number | null; basis: "impressa" | "referencia" | null };

const DAY = 86_400_000;

/** "AAAA-MM-DD" → dias desde a época (UTC), sem fuso. */
function toDay(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY;
}

function fromDay(day: number): string {
  return new Date(day * DAY).toISOString().slice(0, 10);
}

/** Data de hoje em São Paulo, "AAAA-MM-DD". */
export function todaySaoPaulo(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
}

export function computeValidity(
  doc: { issued_at: string | null; expires_at: string | null },
  validityDays: number | null,
  today: string,
): Validity {
  let until: number | null = null;
  let basis: Validity["basis"] = null;
  if (doc.expires_at) {
    until = toDay(doc.expires_at);
    basis = "impressa";
  } else if (doc.issued_at && validityDays) {
    until = toDay(doc.issued_at) + validityDays;
    basis = "referencia";
  }
  if (until === null) return { state: "sem_data", until: null, daysLeft: null, basis: null };

  const daysLeft = until - toDay(today);
  const state: ValidityState = daysLeft < 0 ? "vencida" : daysLeft <= EXPIRING_SOON_DAYS ? "a_vencer" : "valida";
  return { state, until: fromDay(until), daysLeft, basis };
}

/** Pior estado entre vários documentos (para o item): vencida > a_vencer > sem_data > valida. */
export function worstValidity(states: ValidityState[]): ValidityState | null {
  if (!states.length) return null;
  const order: ValidityState[] = ["vencida", "a_vencer", "sem_data", "valida"];
  return order.find((s) => states.includes(s)) ?? null;
}

/** Melhor estado (para o item com vários documentos, basta um válido). */
export function bestValidity(states: ValidityState[]): ValidityState | null {
  if (!states.length) return null;
  const order: ValidityState[] = ["valida", "a_vencer", "sem_data", "vencida"];
  return order.find((s) => states.includes(s)) ?? null;
}
