import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb, createUser } from "./harness";

const ANA = "00000000-0000-0000-0000-0000000000a2";
const CAIO = "00000000-0000-0000-0000-0000000000c2";

let db: PGlite;
let orgA: string;
let dealA: string;
let itemA: string;
let dealA2: string;
let itemA2: string;

const doc = (path: string, item: string | null = null, deal = dealA) =>
  [
    "insert into public.documents (deal_id, deal_item_id, storage_path, file_name, mime_type, size_bytes) values ($1, $2, $3, 'c.pdf', 'application/pdf', 1000) returning id",
    [deal, item, path],
  ] as const;

beforeAll(async () => {
  db = await createTestDb();
  await createUser(db, ANA);
  await createUser(db, CAIO);
  await asUser(db, ANA, async (q) => {
    orgA = (await q<{ id: string }>("select public.create_organization('Org A') as id"))[0].id;
    dealA = (await q<{ id: string }>("insert into public.deals (org_id, kind, title) values ($1, 'cessao_cotas', 'AME') returning id", [orgA]))[0].id;
    dealA2 = (await q<{ id: string }>("insert into public.deals (org_id, kind, title) values ($1, 'cessao_cotas', 'Outro') returning id", [orgA]))[0].id;
    itemA = (await q<{ id: string }>("select id from public.deal_items where deal_id = $1 limit 1", [dealA]))[0].id;
    itemA2 = (await q<{ id: string }>("select id from public.deal_items where deal_id = $1 limit 1", [dealA2]))[0].id;
  }, { commit: true });
  await asUser(db, CAIO, (q) => q("select public.create_organization('Org C')"), { commit: true });
}, 60_000);

describe("documentos", () => {
  it("bucket privado criado", async () => {
    const r = await db.query<{ public: boolean }>("select public from storage.buckets where id = 'documentos'");
    expect(r.rows).toEqual([{ public: false }]);
  });

  it("membro registra documento ligado a item do mesmo negócio", async () => {
    const rows = await asUser(db, ANA, (q) => q(...doc(`${orgA}/${dealA}/x-c.pdf`, itemA)));
    expect(rows).toHaveLength(1);
  });

  it("recusa item de outro negócio e caminho fora da pasta do negócio", async () => {
    await expect(asUser(db, ANA, (q) => q(...doc(`${orgA}/${dealA}/y.pdf`, itemA2)))).rejects.toThrow(/não pertence/);
    await expect(asUser(db, ANA, (q) => q(...doc(`${orgA}/${dealA2}/y.pdf`)))).rejects.toThrow(/fora da pasta/);
  });

  it("documento continua ligado ao item quando outras partes mudam", async () => {
    await asUser(db, ANA, async (q) => {
      const [d] = await q<{ id: string }>(...doc(`${orgA}/${dealA}/z.pdf`, itemA));
      await q("delete from public.parties where deal_id = $1", [dealA]); // não afeta
      expect(await q("select deal_item_id from public.documents where id = $1", [d.id])).toEqual([{ deal_item_id: itemA }]);
    });
  });

  it("outra organização não vê nem registra documentos do negócio", async () => {
    await asUser(db, ANA, (q) => q(...doc(`${orgA}/${dealA}/visivel.pdf`)), { commit: true });
    const seen = await asUser(db, CAIO, (q) => q("select id from public.documents"));
    expect(seen).toHaveLength(0);
    await expect(asUser(db, CAIO, (q) => q(...doc(`${orgA}/${dealA}/intruso.pdf`)))).rejects.toThrow();
  });
});

describe("storage", () => {
  it("membro grava e lê na pasta da organização; estranho não", async () => {
    await asUser(db, ANA, (q) => q("insert into storage.objects (bucket_id, name) values ('documentos', $1)", [`${orgA}/${dealA}/a.pdf`]), { commit: true });
    const ana = await asUser(db, ANA, (q) => q("select name from storage.objects"));
    const caio = await asUser(db, CAIO, (q) => q("select name from storage.objects"));
    expect(ana).toHaveLength(1);
    expect(caio).toHaveLength(0);
    await expect(
      asUser(db, CAIO, (q) => q("insert into storage.objects (bucket_id, name) values ('documentos', $1)", [`${orgA}/${dealA}/b.pdf`])),
    ).rejects.toThrow();
  });

  it("caminho sem uuid no primeiro segmento é recusado", async () => {
    await expect(
      asUser(db, ANA, (q) => q("insert into storage.objects (bucket_id, name) values ('documentos', 'qualquer/a.pdf')")),
    ).rejects.toThrow();
  });
});

describe("análises e apontamentos", () => {
  it("registra análise e apontamento do mesmo negócio; recusa referência cruzada", async () => {
    await asUser(db, ANA, async (q) => {
      const [d] = await q<{ id: string }>(...doc(`${orgA}/${dealA}/an.pdf`, itemA));
      const [a] = await q<{ id: string }>(
        "insert into public.document_analyses (deal_id, document_id, status) values ($1, $2, 'concluida') returning id",
        [dealA, d.id],
      );
      await q(
        "insert into public.findings (deal_id, document_id, deal_item_id, analysis_id, severity, title, source) values ($1, $2, $3, $4, 'alto', 'Hipoteca', 'ia')",
        [dealA, d.id, itemA, a.id],
      );
      await expect(
        q("insert into public.findings (deal_id, deal_item_id, severity, title) values ($1, $2, 'baixo', 'X1')", [dealA2, itemA]),
      ).rejects.toThrow(/item de outro negócio/);
    });
  });

  it("outra organização não vê análises nem apontamentos", async () => {
    await asUser(db, ANA, (q) => q("insert into public.findings (deal_id, severity, title) values ($1, 'medio', 'Manual')", [dealA]), { commit: true });
    expect(await asUser(db, CAIO, (q) => q("select id from public.findings"))).toHaveLength(0);
    expect(await asUser(db, CAIO, (q) => q("select id from public.document_analyses"))).toHaveLength(0);
  });
});

describe("pedidos de certidão", () => {
  it("registra pedido do item do negócio; recusa item de outro negócio e estranhos", async () => {
    await asUser(db, ANA, async (q) => {
      const rows = await q("insert into public.certificate_requests (deal_id, deal_item_id, provider) values ($1, $2, 'simulado') returning status", [dealA, itemA]);
      expect(rows).toEqual([{ status: "pendente" }]);
      await expect(
        q("insert into public.certificate_requests (deal_id, deal_item_id, provider) values ($1, $2, 'simulado')", [dealA2, itemA]),
      ).rejects.toThrow(/item de outro negócio/);
    });
    await expect(
      asUser(db, CAIO, (q) => q("insert into public.certificate_requests (deal_id, deal_item_id, provider) values ($1, $2, 'simulado')", [dealA, itemA])),
    ).rejects.toThrow();
  });
});
