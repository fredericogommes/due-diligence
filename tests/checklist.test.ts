import { describe, expect, it } from "vitest";
import { buildChecklist, summarize } from "@/lib/checklist/build";
import type { DealItemRow, TemplateItemRow } from "@/lib/db-types";

const t = (id: string, code: string, section: string, sort: number, scope: TemplateItemRow["scope"] = "negocio"): TemplateItemRow => ({
  id, code, section, title: `Título ${code}`, description: null, scope, validity_days: null, required: true, sort_order: sort,
});
const i = (id: string, tid: string, status: DealItemRow["status"], party: string | null = null, asset: string | null = null): DealItemRow => ({
  id, deal_id: "d", template_item_id: tid, party_id: party, asset_id: asset, status, notes: null, updated_at: "",
});

describe("buildChecklist", () => {
  const templates = [
    t("t1", "IMV-01", "Imóvel", 10, "imovel"),
    t("t2", "VPF-01", "Vendedor pessoa física", 110, "parte_pf"),
    t("t3", "VPF-02", "Vendedor pessoa física", 120, "parte_pf"),
  ];
  const parties = [
    { id: "p1", name: "Maria", role: "conjuge" as const },
    { id: "p2", name: "João", role: "vendedor" as const },
  ];
  const assets = [{ id: "a1", description: "Apto 101", kind: "imovel" as const }];
  const items = [
    i("i4", "t3", "faltante", "p1"),
    i("i1", "t2", "completo", "p1"),
    i("i2", "t2", "parcial", "p2"),
    i("i3", "t1", "faltante", null, "a1"),
    i("i5", "inexistente", "faltante"),
  ];

  it("agrupa por seção na ordem do modelo e ordena por item e sujeito", () => {
    const sections = buildChecklist(items, templates, parties, assets);
    expect(sections.map((s) => s.name)).toEqual(["Imóvel", "Vendedor pessoa física"]);
    expect(sections[1].entries.map((e) => `${e.code}:${e.subject}`)).toEqual([
      "VPF-01:João — Vendedor",
      "VPF-01:Maria — Cônjuge do vendedor",
      "VPF-02:Maria — Cônjuge do vendedor",
    ]);
    expect(sections[0].entries[0].subject).toBe("Imóvel: Apto 101");
  });

  it("ignora item cujo modelo não foi carregado e resume por status", () => {
    const s = summarize(buildChecklist(items, templates, parties, assets));
    expect(s).toEqual({ faltante: 2, parcial: 1, completo: 1, dispensado: 0, total: 4, considered: 4 });
  });
});
