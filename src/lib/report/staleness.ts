/**
 * Evidência nova depois de uma versão revisada/assinada (MK-01 §3: "documento
 * material novo invalida a aprovação corrente e exige nova revisão").
 * A assinatura continua válida para o retrato que congelou; o que muda é que
 * esse retrato deixou de refletir o negócio. Função pura — tests/staleness.test.ts.
 */

/** Linha com data de criação (sem data = anterior a qualquer versão). */
export type Stamped = { created_at?: string };

export type Staleness = {
  /** Versão de referência (a mais recente revisada ou assinada). */
  version: number;
  status: "revisado" | "assinado";
  documents: number;
  findings: number;
  parties: number;
  assets: number;
  total: number;
};

type VersionLike = { version: number; status: string; created_at: string };

/** Mudanças depois do retrato da última versão revisada/assinada; null se nada mudou ou não há versão aprovada. */
export function staleSince(
  versions: VersionLike[],
  evidence: { documents: Stamped[]; findings: Stamped[]; parties: Stamped[]; assets: Stamped[] },
): Staleness | null {
  const approved = versions
    .filter((v) => v.status === "assinado" || v.status === "revisado")
    .sort((a, b) => b.version - a.version)[0];
  if (!approved) return null;
  const after = (rows: Stamped[]) => rows.filter((r) => r.created_at && Date.parse(r.created_at) > Date.parse(approved.created_at)).length;
  const s = {
    version: approved.version,
    status: approved.status as "revisado" | "assinado",
    documents: after(evidence.documents),
    findings: after(evidence.findings),
    parties: after(evidence.parties),
    assets: after(evidence.assets),
  };
  const total = s.documents + s.findings + s.parties + s.assets;
  return total ? { ...s, total } : null;
}

/** Frase curta: "2 documentos e 1 apontamento". */
export function describeStaleness(s: Staleness): string {
  const parts: string[] = [];
  const pl = (n: number, one: string, many: string) => (n ? `${n} ${n === 1 ? one : many}` : null);
  for (const p of [pl(s.documents, "documento", "documentos"), pl(s.findings, "apontamento", "apontamentos"), pl(s.parties, "parte", "partes"), pl(s.assets, "bem", "bens")]) if (p) parts.push(p);
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} e ${parts.at(-1)}` : parts[0] ?? "";
}
