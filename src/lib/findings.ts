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
