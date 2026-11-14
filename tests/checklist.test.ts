import { describe, expect, it } from "vitest";
import { buildChecklist, summarize, unassignedDocuments } from "@/lib/checklist/build";
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
    expect(s).toEqual({ faltante: 2, parcial: 1, completo: 1, dispensado: 0, total: 4, considered: 4, vencidos: 0, previewed: 0, previewPositive: 0 });
  });
});

describe("documentos no checklist", () => {
  const templates = [{ ...t("t1", "VPF-03", "Vendedor", 10, "parte_pf"), validity_days: 180 }];
  const doc = (id: string, item: string | null, issued: string | null, expires: string | null) => ({
    id, org_id: "o", deal_id: "d", deal_item_id: item, storage_path: `o/d/${id}`, file_name: `${id}.pdf`,
    mime_type: "application/pdf", size_bytes: 1, sha256: null, doc_type: null, issuer: null,
    issued_at: issued, expires_at: expires, result: "negativa" as const, source: "upload" as const, is_preview: false, notes: null, created_at: "",
  });

  it("anexa documentos ao item, calcula validade e avisa item completo com tudo vencido", () => {
    const items = [i("i1", "t1", "completo", "p1"), i("i2", "t1", "completo", "p2")];
    const parties = [{ id: "p1", name: "A", role: "vendedor" as const }, { id: "p2", name: "B", role: "vendedor" as const }];
    const docs = [
      doc("d1", "i1", "2026-01-01", null), // 180 dias → 2026-06-30, vencida
      doc("d2", "i2", "2026-01-01", null),
      doc("d3", "i2", "2026-10-01", null), // válida até 2027-03-30
      doc("d4", null, null, null),
    ];
    const sections = buildChecklist(items, templates, parties, [], docs, "2026-11-11");
    const [a, b] = sections[0].entries;
    expect(a.validity).toBe("vencida");
    expect(a.expiredWarning).toBe(true);
    expect(b.documents.map((d) => d.id)).toEqual(["d2", "d3"]);
    expect(b.validity).toBe("valida");
    expect(b.expiredWarning).toBe(false);
    expect(summarize(sections).vencidos).toBe(1);
    expect(unassignedDocuments(docs, "2026-11-11").map((d) => d.id)).toEqual(["d4"]);
  });
});

describe("versões de documentos", () => {
  it("mostra só a versão mais recente, com número e histórico", async () => {
    const { latestVersions } = await import("@/lib/checklist/build");
    const base = { org_id: "o", deal_id: "d", deal_item_id: "i", storage_path: "p", file_name: "f.pdf", mime_type: "application/pdf", size_bytes: 1, sha256: null, doc_type: null, issuer: null, issued_at: null, expires_at: null, result: "negativa" as const, source: "upload" as const, is_preview: false, notes: null, created_at: "" };
    const v1 = { ...base, id: "v1", supersedes_id: null };
    const v2 = { ...base, id: "v2", supersedes_id: "v1" };
    const v3 = { ...base, id: "v3", supersedes_id: "v2" };
    const solo = { ...base, id: "s" };
    const out = latestVersions([v1, v3, v2, solo]);
    expect(out.map((d) => [d.id, d.version, d.history.map((h) => h.id)])).toEqual([["v3", 3, ["v2", "v1"]], ["s", 1, []]]);
  });
});
