/** Checklists por segmento (M16): padrão continua o mesmo; modelo escolhido é respeitado. Dados sintéticos. */
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb, createUser } from "./harness";

const OWNER = "00000000-0000-0000-0000-0000000016a1";
let db: PGlite;
let org: string;

beforeAll(async () => {
  db = await createTestDb();
  await createUser(db, OWNER, "Dono");
  org = await asUser(db, OWNER, async (q) => (await q<{ id: string }>("select public.create_organization('Escritório') as id"))[0].id, { commit: true });
}, 60_000);

const tpl = (code: string) => asUser(db, OWNER, async (q) => (await q<{ id: string }>("select id from public.checklist_templates where code = $1", [code]))[0].id);

describe("modelos por segmento", () => {
  it("existem os modelos novos e o padrão de cada tipo continua o mesmo", async () => {
    const rows = await asUser(db, OWNER, (q) => q<{ code: string; is_default: boolean }>("select code, is_default from public.checklist_templates order by code"));
    expect(rows).toEqual([
      { code: "IMV-COMERCIAL-v1", is_default: false },
      { code: "IMV-CV-v1", is_default: true },
      { code: "IMV-RURAL-v1", is_default: false },
      { code: "IMV-TERRENO-v1", is_default: false },
      { code: "TETTU-COTAS-v1", is_default: true },
    ]);
    const def = await asUser(db, OWNER, async (q) => {
      const [d] = await q<{ template_id: string }>("insert into public.deals (org_id, kind, title) values ($1, 'compra_venda_imovel', 'Padrão') returning template_id", [org]);
      return d.template_id;
    });
    expect(def).toBe(await tpl("IMV-CV-v1"));
  });

  it("negócio rural gera itens rurais e não traz IPTU/condomínio/habite-se; matrícula mantém o código da consulta online", async () => {
    const codes = await asUser(db, OWNER, async (q) => {
      const [d] = await q<{ id: string }>("insert into public.deals (org_id, kind, title, template_id) values ($1, 'compra_venda_imovel', 'Fazenda', $2) returning id", [org, await tpl("IMV-RURAL-v1")]);
      await q("insert into public.assets (deal_id, kind, description) values ($1, 'imovel', 'Fazenda Boa Vista')", [d.id]);
      return (await q<{ code: string }>("select ti.code from public.deal_items di join public.template_items ti on ti.id = di.template_item_id where di.deal_id = $1 order by ti.code", [d.id])).map((r) => r.code);
    });
    expect(codes).toEqual(expect.arrayContaining(["IMV-01", "IMV-03", "RUR-01", "RUR-02", "RUR-03", "RUR-05"]));
    expect(codes).not.toEqual(expect.arrayContaining(["IMV-02"]));
    expect(codes.some((c) => c === "IMV-04" || c === "IMV-05")).toBe(false);
  });

  it("modelo de outro tipo de negócio é recusado", async () => {
    await expect(asUser(db, OWNER, async (q) => q("insert into public.deals (org_id, kind, title, template_id) values ($1, 'cessao_cotas', 'X Y', $2)", [org, await tpl("IMV-RURAL-v1")]))).rejects.toThrow(/incompatível/);
  });
});
