import type { FindingSeverity } from "./db-types";

export const SEVERITIES: FindingSeverity[] = ["critico", "alto", "medio", "baixo"];

export const SEVERITY_LABEL: Record<FindingSeverity, string> = {
  critico: "Crítico",
  alto: "Alto",
  medio: "Médio",
  baixo: "Baixo",
};

export const SEVERITY_STYLE: Record<FindingSeverity, string> = {
  critico: "bg-danger text-white",
  alto: "bg-danger/15 text-danger",
  medio: "bg-warn/15 text-warn",
  baixo: "bg-muted text-subtle",
};

export function sortBySeverity<T extends { severity: FindingSeverity }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity));
}

/** Estados do achado (MK-01 §3), espelhando o trigger findings_status (M13). */
export const FINDING_STATUSES = ["proposto", "confirmado", "mitigado", "aceito", "resolvido", "descartado"] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];
export const CLOSED_STATUSES: FindingStatus[] = ["mitigado", "aceito", "resolvido", "descartado"];

export const FINDING_STATUS_LABEL: Record<FindingStatus, string> = {
  proposto: "Proposto",
  confirmado: "Confirmado",
  mitigado: "Mitigado",
  aceito: "Risco aceito",
  resolvido: "Resolvido",
  descartado: "Descartado",
};

/** Para onde um achado pode ir a partir do estado atual. */
export function nextFindingStatuses(status: FindingStatus): FindingStatus[] {
  if (status === "proposto") return ["confirmado", "descartado"];
  if (status === "confirmado") return ["resolvido", "mitigado", "aceito", "descartado"];
  return ["confirmado"]; // reabrir
}

export function findingStatusOf(f: { status?: FindingStatus; resolved: boolean; source: string }): FindingStatus {
  return f.status ?? (f.resolved ? "resolvido" : f.source === "manual" ? "confirmado" : "proposto");
}

/** O banco só deixa apagar proposta não revisada ou manual ainda confirmado (o resto se descarta com justificativa). */
export function canDeleteFinding(f: { status?: FindingStatus; resolved: boolean; source: string }): boolean {
  const st = findingStatusOf(f);
  return st === "proposto" || (f.source === "manual" && st === "confirmado");
}
