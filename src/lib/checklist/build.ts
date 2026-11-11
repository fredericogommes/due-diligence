/**
 * Monta a visão do checklist de um negócio a partir das linhas do banco:
 * junta item do negócio + item do modelo + parte/bem, ordena e agrupa por seção.
 * Função pura — testada em tests/checklist.test.ts.
 */
import type { AssetRow, DealItemRow, PartyRow, TemplateItemRow } from "@/lib/db-types";
import { ASSET_KIND_LABEL, PARTY_ROLE_LABEL, type ItemStatus } from "@/lib/domain";

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
};

export type ChecklistSection = { name: string; entries: ChecklistEntry[] };

export type ChecklistSummary = Record<ItemStatus, number> & { total: number; considered: number };

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
): ChecklistSection[] {
  const tpl = new Map(templateItems.map((t) => [t.id, t]));
  const party = new Map(parties.map((p) => [p.id, p]));
  const asset = new Map(assets.map((a) => [a.id, a]));

  const entries: ChecklistEntry[] = [];
  for (const it of items) {
    const t = tpl.get(it.template_item_id);
    if (!t) continue;
    const p = it.party_id ? party.get(it.party_id) : undefined;
    const a = it.asset_id ? asset.get(it.asset_id) : undefined;
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
  const s: ChecklistSummary = { faltante: 0, parcial: 0, completo: 0, dispensado: 0, total: 0, considered: 0 };
  for (const sec of sections) {
    for (const e of sec.entries) {
      s[e.status]++;
      s.total++;
    }
  }
  s.considered = s.total - s.dispensado;
  return s;
}
