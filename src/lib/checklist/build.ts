/**
 * Monta a visão do checklist de um negócio a partir das linhas do banco:
 * junta item do negócio + item do modelo + parte/bem, ordena e agrupa por seção.
 * Função pura — testada em tests/checklist.test.ts.
 */
import type { AssetRow, DealItemRow, DocumentRow, PartyRow, TemplateItemRow } from "@/lib/db-types";
import { ASSET_KIND_LABEL, PARTY_ROLE_LABEL, type ItemStatus } from "@/lib/domain";
import { bestValidity, computeValidity, type Validity, type ValidityState } from "./validity";

/** Documento como aparece na tela: a versão mais recente, com as anteriores em `history` (mais nova primeiro). */
export type DocView = DocumentRow & { validity: Validity; version?: number; history?: DocumentRow[] };

/**
 * Agrupa cadeias de versões (supersedes_id) e devolve só a versão mais recente
 * de cada uma, com número da versão e histórico. Documentos sem cadeia ficam como estão.
 */
export function latestVersions(documents: DocumentRow[]): (DocumentRow & { version: number; history: DocumentRow[] })[] {
  const byId = new Map(documents.map((d) => [d.id, d]));
  const superseded = new Set(documents.map((d) => d.supersedes_id).filter((x): x is string => Boolean(x)));
  return documents
    .filter((d) => !superseded.has(d.id))
    .map((d) => {
      const history: DocumentRow[] = [];
      let prev = d.supersedes_id ? byId.get(d.supersedes_id) : undefined;
      while (prev && history.length < 100) {
        history.push(prev);
        prev = prev.supersedes_id ? byId.get(prev.supersedes_id) : undefined;
      }
      return { ...d, version: history.length + 1, history };
    });
}

export type ChecklistEntry = {
  id: string;
  code: string;
  section: string;
  title: string;
  description: string | null;
  required: boolean;
  validityDays: number | null;
  status: ItemStatus;
  notes: string | null;
  /** Para quem/qual bem o item vale ("João Silva — Vendedor"); null se vale para o negócio. */
  subject: string | null;
  partyId: string | null;
  assetId: string | null;
  sortOrder: number;
  /** Documentos oficiais/anexados (sem as visualizações). */
  documents: DocView[];
  /** Visualização mais recente da consulta prévia (sem valor oficial), se houver. */
  preview: DocView | null;
  /** Melhor validade entre os documentos do item (basta um válido). null = sem documento. */
  validity: ValidityState | null;
  /** Item marcado como completo/parcial cujos documentos estão todos vencidos. */
  expiredWarning: boolean;
};

export type ChecklistSection = { name: string; entries: ChecklistEntry[] };

export type ChecklistSummary = Record<ItemStatus, number> & {
  total: number;
  considered: number;
  vencidos: number;
  /** Itens com visualização na consulta prévia, e quantas deram positivo. */
  previewed: number;
  previewPositive: number;
};

export function partyLabel(p: Pick<PartyRow, "name" | "role">): string {
  return `${p.name} — ${PARTY_ROLE_LABEL[p.role]}`;
}

export function assetLabel(a: Pick<AssetRow, "description" | "kind">): string {
  return `${ASSET_KIND_LABEL[a.kind]}: ${a.description}`;
}

export function buildChecklist(
  items: DealItemRow[],
  templateItems: TemplateItemRow[],
  parties: Pick<PartyRow, "id" | "name" | "role">[],
  assets: Pick<AssetRow, "id" | "description" | "kind">[],
  documents: DocumentRow[] = [],
  today = "1970-01-01",
): ChecklistSection[] {
  const tpl = new Map(templateItems.map((t) => [t.id, t]));
  const docsByItem = new Map<string, ReturnType<typeof latestVersions>>();
  for (const d of latestVersions(documents)) {
    if (!d.deal_item_id) continue;
    docsByItem.set(d.deal_item_id, [...(docsByItem.get(d.deal_item_id) ?? []), d]);
  }
  const party = new Map(parties.map((p) => [p.id, p]));
  const asset = new Map(assets.map((a) => [a.id, a]));

  const entries: ChecklistEntry[] = [];
  for (const it of items) {
    const t = tpl.get(it.template_item_id);
    if (!t) continue;
    const p = it.party_id ? party.get(it.party_id) : undefined;
    const a = it.asset_id ? asset.get(it.asset_id) : undefined;
    const all = docsByItem.get(it.id) ?? [];
    const latestPreview = all.filter((d) => d.is_preview).sort((x, y) => y.created_at.localeCompare(x.created_at))[0];
    const preview: DocView | null = latestPreview ? { ...latestPreview, validity: computeValidity(latestPreview, null, today) } : null;
    const docs: DocView[] = all.filter((d) => !d.is_preview).map((d) => ({
      ...d,
      validity: computeValidity(d, t.validity_days, today),
    }));
    const validity = bestValidity(docs.map((d) => d.validity.state));
    entries.push({
      id: it.id,
      code: t.code,
      section: t.section,
      title: t.title,
      description: t.description,
      required: t.required,
      validityDays: t.validity_days,
      status: it.status,
      notes: it.notes,
      subject: p ? partyLabel(p) : a ? assetLabel(a) : null,
      partyId: it.party_id,
      assetId: it.asset_id,
      sortOrder: t.sort_order,
      documents: docs,
      preview,
      validity,
      expiredWarning: validity === "vencida" && (it.status === "completo" || it.status === "parcial"),
    });
  }

  entries.sort(
    (x, y) =>
      x.sortOrder - y.sortOrder ||
      (x.subject ?? "").localeCompare(y.subject ?? "", "pt-BR") ||
      x.code.localeCompare(y.code),
  );

  const sections: ChecklistSection[] = [];
  for (const e of entries) {
    let s = sections.find((x) => x.name === e.section);
    if (!s) {
      s = { name: e.section, entries: [] };
      sections.push(s);
    }
    s.entries.push(e);
  }
  return sections;
}

/** Contagem por status. "considered" exclui os dispensados. */
export function summarize(sections: ChecklistSection[]): ChecklistSummary {
  const s: ChecklistSummary = { faltante: 0, parcial: 0, completo: 0, dispensado: 0, total: 0, considered: 0, vencidos: 0, previewed: 0, previewPositive: 0 };
  for (const sec of sections) {
    for (const e of sec.entries) {
      s[e.status]++;
      s.total++;
      if (e.expiredWarning) s.vencidos++;
      if (e.preview) {
        s.previewed++;
        if (e.preview.result === "positiva") s.previewPositive++;
      }
    }
  }
  s.considered = s.total - s.dispensado;
  return s;
}

/** Documentos que não estão ligados a nenhum item ("fora do checklist"). */
export function unassignedDocuments(documents: DocumentRow[], today: string): DocView[] {
  return latestVersions(documents)
    .filter((d) => !d.deal_item_id)
    .map((d) => ({ ...d, validity: computeValidity(d, null, today) }));
}
