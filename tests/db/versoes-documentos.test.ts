/** Gate G04 (MK-01): nova versão de documento sem apagar a anterior. Dados sintéticos. */
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb, createUser } from "./harness";

const OWNER = "00000000-0000-0000-0000-0000000014a1";
let db: PGlite;
let org: string;
let deal: string;
let other: string;
let n = 0;

const addDoc = (dealId: string, supersedes: string | null = null) =>
  asUser(db, OWNER, async (q) => {
    n++;
    const path = `${org}/${dealId}/00000000-0000-0000-0000-${String(n).padStart(12, "0")}-v.pdf`;
    const [d] = await q<{ id: string }>(
      "insert into public.documents (deal_id, storage_path, file_name, mime_type, size_bytes, supersedes_id) values ($1, $2, 'v.pdf', 'application/pdf', 10, $3) returning id",
      [dealId, path, supersedes],
    );
    return d.id;
  }, { commit: true });

beforeAll(async () => {
  db = await createTestDb();
  await createUser(db, OWNER, "Dono");
  org = await asUser(db, OWNER, async (q) => (await q<{ id: string }>("select public.create_organization('Escritório') as id"))[0].id, { commit: true });
  [deal, other] = await asUser(db, OWNER, async (q) => {
    const a = await q<{ id: string }>("insert into public.deals (org_id, kind, title) values ($1, 'compra_venda_imovel', 'Negócio 1') returning id", [org]);
    const b = await q<{ id: string }>("insert into public.deals (org_id, kind, title) values ($1, 'compra_venda_imovel', 'Negócio 2') returning id", [org]);
    return [a[0].id, b[0].id];
  }, { commit: true });
}, 60_000);

describe("versões de documentos", () => {
  it("nova versão aponta para a anterior, que continua guardada e não pode ser apagada", async () => {
    const v1 = await addDoc(deal);
    const v2 = await addDoc(deal, v1);
    const del = await asUser(db, OWNER, (q) => q("delete from public.documents where id = $1", [v1]).then(() => "apagou").catch((e: Error) => e.message));
    expect(del).toMatch(/foreign key|violates/);
    // apagar a versão mais nova é permitido (volta para a anterior)
    expect(await asUser(db, OWNER, (q) => q("delete from public.documents where id = $1 returning id", [v2]))).toHaveLength(1);
  });

  it("cada versão tem uma única sucessora", async () => {
    const v1 = await addDoc(deal);
    await addDoc(deal, v1);
    await expect(addDoc(deal, v1)).rejects.toThrow();
  });

  it("não aceita versão anterior de outro negócio nem troca depois de gravada", async () => {
    const x = await addDoc(other);
    await expect(addDoc(deal, x)).rejects.toThrow(/mesmo negócio/);
    const v1 = await addDoc(deal);
    const v2 = await addDoc(deal, v1);
    await expect(asUser(db, OWNER, (q) => q("update public.documents set supersedes_id = null where id = $1", [v2]))).rejects.toThrow(/não pode ser trocada/);
  });

  it("apagar o negócio inteiro continua funcionando com cadeia de versões", async () => {
    const v1 = await addDoc(other);
    await addDoc(other, v1);
    const rows = await asUser(db, OWNER, (q) => q("delete from public.deals where id = $1 returning id", [other]));
    expect(rows).toHaveLength(1);
  });
});
