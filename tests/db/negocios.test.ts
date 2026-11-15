import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb, createUser } from "./harness";

const ANA = "00000000-0000-0000-0000-0000000000a1";
const CAIO = "00000000-0000-0000-0000-0000000000c1";

let db: PGlite;
let orgA: string;

type Q = Parameters<Parameters<typeof asUser>[2]>[0];

async function newDeal(q: Q, kind = "compra_venda_imovel", org = orgA): Promise<string> {
  const [d] = await q<{ id: string }>(
    "insert into public.deals (org_id, kind, title) values ($1, $2, 'Apto 101') returning id",
    [org, kind],
  );
  return d.id;
}

async function itemCodes(q: Q, dealId: string): Promise<string[]> {
  const rows = await q<{ code: string }>(
    `select ti.code from public.deal_items di join public.template_items ti on ti.id = di.template_item_id
     where di.deal_id = $1 order by ti.sort_order, ti.code`,
    [dealId],
  );
  return rows.map((r) => r.code);
}

beforeAll(async () => {
  db = await createTestDb();
  await createUser(db, ANA, "Ana");
  await createUser(db, CAIO, "Caio");
  orgA = await asUser(db, ANA, async (q) => (await q<{ id: string }>("select public.create_organization('Org A') as id"))[0].id, { commit: true });
  await asUser(db, CAIO, (q) => q("select public.create_organization('Org B')"), { commit: true });
}, 60_000);

describe("modelos", () => {
  it("existem os modelos com os itens esperados (urbano, cotas e os de segmento da M16)", async () => {
    const rows = await asUser(db, ANA, (q) =>
      q<{ code: string; n: number }>(
        "select t.code, count(i.*)::int as n from public.checklist_templates t join public.template_items i on i.template_id = t.id group by t.code order by t.code",
      ),
    );
    expect(rows).toEqual([
      { code: "IMV-COMERCIAL-v1", n: 28 },
      { code: "IMV-CV-v1", n: 25 },
      { code: "IMV-RURAL-v1", n: 28 },
      { code: "IMV-TERRENO-v1", n: 27 },
      { code: "TETTU-COTAS-v1", n: 35 },
    ]);
  });
});

describe("geração do checklist", () => {
  it("negócio de imóvel sem partes nem bens não tem itens", async () => {
    await asUser(db, ANA, async (q) => {
      const deal = await newDeal(q);
      expect(await itemCodes(q, deal)).toEqual([]);
    });
  });

  it("cessão de cotas recebe os 35 itens TETTU na criação", async () => {
    await asUser(db, ANA, async (q) => {
      const deal = await newDeal(q, "cessao_cotas");
      const codes = await itemCodes(q, deal);
      expect(codes).toHaveLength(35);
      expect(codes[0]).toBe("SOC-01");
      expect(codes.at(-1)).toBe("FIN-03");
    });
  });

  it("imóvel gera itens IMV; vendedor PF e cônjuge geram VPF cada; comprador gera CMP", async () => {
    await asUser(db, ANA, async (q) => {
      const deal = await newDeal(q);
      await q("insert into public.assets (deal_id, kind, description, matricula) values ($1, 'imovel', 'Apto 101', '12345')", [deal]);
      await q("insert into public.parties (deal_id, kind, role, name) values ($1, 'pf', 'vendedor', 'João')", [deal]);
      await q("insert into public.parties (deal_id, kind, role, name) values ($1, 'pf', 'conjuge', 'Maria')", [deal]);
      await q("insert into public.parties (deal_id, kind, role, name) values ($1, 'pf', 'comprador', 'Pedro')", [deal]);
      const codes = await itemCodes(q, deal);
      expect(codes.filter((c) => c.startsWith("IMV"))).toHaveLength(6);
      expect(codes.filter((c) => c.startsWith("VPF"))).toHaveLength(16);
      expect(codes.filter((c) => c.startsWith("CMP"))).toEqual(["CMP-01"]);
      expect(codes.filter((c) => c.startsWith("VPJ"))).toHaveLength(0);
    });
  });

  it("trocar o papel da parte troca os itens dela", async () => {
    await asUser(db, ANA, async (q) => {
      const deal = await newDeal(q);
      const [p] = await q<{ id: string }>(
        "insert into public.parties (deal_id, kind, role, name) values ($1, 'pf', 'comprador', 'Pedro') returning id",
        [deal],
      );
      expect(await itemCodes(q, deal)).toEqual(["CMP-01"]);
      await q("update public.parties set role = 'vendedor' where id = $1", [p.id]);
      const codes = await itemCodes(q, deal);
      expect(codes).not.toContain("CMP-01");
      expect(codes.filter((c) => c.startsWith("VPF"))).toHaveLength(8);
    });
  });

  it("apagar a parte apaga os itens dela", async () => {
    await asUser(db, ANA, async (q) => {
      const deal = await newDeal(q);
      const [p] = await q<{ id: string }>(
        "insert into public.parties (deal_id, kind, role, name) values ($1, 'pj', 'vendedor', 'Construtora X') returning id",
        [deal],
      );
      expect((await itemCodes(q, deal)).filter((c) => c.startsWith("VPJ"))).toHaveLength(8);
      await q("delete from public.parties where id = $1", [p.id]);
      expect(await itemCodes(q, deal)).toEqual([]);
    });
  });

  it("modelo incompatível com o tipo é recusado e tipo não pode mudar", async () => {
    await asUser(db, ANA, async (q) => {
      const [t] = await q<{ id: string }>("select id from public.checklist_templates where code = 'TETTU-COTAS-v1'");
      await expect(
        q("insert into public.deals (org_id, kind, template_id, title) values ($1, 'compra_venda_imovel', $2, 'X')", [orgA, t.id]),
      ).rejects.toThrow(/incompatível/);
    });
    await asUser(db, ANA, async (q) => {
      const deal = await newDeal(q);
      await expect(q("update public.deals set kind = 'cessao_cotas' where id = $1", [deal])).rejects.toThrow(/não podem ser alterados/);
    });
  });

  it("status e observação do item podem ser atualizados", async () => {
    await asUser(db, ANA, async (q) => {
      const deal = await newDeal(q, "cessao_cotas");
      const rows = await q(
        "update public.deal_items set status = 'completo', notes = 'ok' where deal_id = $1 returning status",
        [deal],
      );
      expect(rows).toHaveLength(35);
    });
  });
});

describe("isolamento", () => {
  it("outra organização não vê nem altera o negócio, as partes e os itens", async () => {
    const deal = await asUser(db, ANA, async (q) => {
      const d = await newDeal(q, "cessao_cotas");
      await q("insert into public.parties (deal_id, kind, role, name) values ($1, 'pf', 'socio', 'Sócio')", [d]);
      return d;
    }, { commit: true });

    await asUser(db, CAIO, async (q) => {
      expect(await q("select id from public.deals where id = $1", [deal])).toHaveLength(0);
      expect(await q("select id from public.parties where deal_id = $1", [deal])).toHaveLength(0);
      expect(await q("select id from public.deal_items where deal_id = $1", [deal])).toHaveLength(0);
      expect(await q("update public.deal_items set status = 'completo' where deal_id = $1 returning id", [deal])).toHaveLength(0);
    });
  });

  it("não consegue criar parte em negócio alheio nem negócio em organização alheia", async () => {
    const deal = await asUser(db, ANA, (q) => newDeal(q), { commit: true });
    await expect(
      asUser(db, CAIO, (q) => q("insert into public.parties (deal_id, kind, role, name) values ($1, 'pf', 'vendedor', 'Intruso')", [deal])),
    ).rejects.toThrow();
    await expect(asUser(db, CAIO, (q) => newDeal(q, "compra_venda_imovel", orgA))).rejects.toThrow();
  });

  it("usuário não insere item de checklist manualmente", async () => {
    await expect(
      asUser(db, ANA, async (q) => {
        const deal = await newDeal(q);
        const [ti] = await q<{ id: string }>("select id from public.template_items limit 1");
        await q("insert into public.deal_items (deal_id, template_item_id) values ($1, $2)", [deal, ti.id]);
      }),
    ).rejects.toThrow();
  });
});

