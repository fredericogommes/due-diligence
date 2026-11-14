/** Gate G05/G03 (MK-01): administrador não é revisor jurídico automaticamente. Dados sintéticos. */
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb, createUser } from "./harness";

const OWNER = "00000000-0000-0000-0000-0000000011a1";
const ADMIN = "00000000-0000-0000-0000-0000000011a2";
const LAWYER = "00000000-0000-0000-0000-0000000011a3";
const BROKER = "00000000-0000-0000-0000-0000000011a4";

let db: PGlite;
let org: string;
let deal: string;

const reviewer = (uid: string) =>
  asUser(db, OWNER, (q) => q<{ legal_reviewer: boolean }>("select legal_reviewer from public.memberships where org_id = $1 and user_id = $2", [org, uid])).then((r) => r[0]?.legal_reviewer);

beforeAll(async () => {
  db = await createTestDb();
  for (const id of [OWNER, ADMIN, LAWYER, BROKER]) await createUser(db, id, id.slice(-2));
  org = await asUser(db, OWNER, async (q) => {
    const [o] = await q<{ id: string }>("select public.create_organization('Escritório') as id");
    await q("insert into public.memberships (org_id, user_id, role, legal_reviewer) values ($1, $2, 'admin', true), ($1, $3, 'advogado', false), ($1, $4, 'corretor', true)", [o.id, ADMIN, LAWYER, BROKER]);
    return o.id;
  }, { commit: true });
  deal = await asUser(db, OWNER, async (q) => {
    const [d] = await q<{ id: string }>("insert into public.deals (org_id, kind, title) values ($1, 'compra_venda_imovel', 'Negócio X') returning id", [org]);
    await q("insert into public.report_versions (deal_id, conclusion, snapshot) values ($1, 'viavel', '{}')", [d.id]);
    return d.id;
  }, { commit: true });
}, 60_000);

const review = (uid: string) => asUser(db, uid, (q) => q("update public.report_versions set status = 'revisado' where deal_id = $1 returning status", [deal]));

describe("revisor jurídico", () => {
  it("o valor enviado na criação é ignorado: só advogado nasce revisor (dono e admin não)", async () => {
    expect(await reviewer(OWNER)).toBe(false);
    expect(await reviewer(ADMIN)).toBe(false);
    expect(await reviewer(LAWYER)).toBe(true);
    expect(await reviewer(BROKER)).toBe(false);
  });

  it("dono e administrador sem a permissão não revisam", async () => {
    await expect(review(OWNER)).rejects.toThrow(/revisor jurídico/);
    await expect(review(ADMIN)).rejects.toThrow(/revisor jurídico/);
  });

  it("administrador não se concede a permissão; só o dono concede", async () => {
    await expect(asUser(db, ADMIN, (q) => q("update public.memberships set legal_reviewer = true where org_id = $1 and user_id = $2", [org, ADMIN]))).rejects.toThrow(/só o dono/);
    await asUser(db, OWNER, (q) => q("update public.memberships set legal_reviewer = true where org_id = $1 and user_id = $2", [org, ADMIN]), { commit: true });
    expect(await reviewer(ADMIN)).toBe(true);
    expect(await review(ADMIN)).toEqual([{ status: "revisado" }]);
  });

  it("advogado revisor revisa; retirar a permissão bloqueia na hora", async () => {
    expect(await review(LAWYER)).toEqual([{ status: "revisado" }]);
    await asUser(db, OWNER, (q) => q("update public.memberships set legal_reviewer = false where org_id = $1 and user_id = $2", [org, LAWYER]), { commit: true });
    await expect(review(LAWYER)).rejects.toThrow(/revisor jurídico/);
  });

  it("virar cliente retira a permissão automaticamente", async () => {
    await asUser(db, OWNER, (q) => q("update public.memberships set role = 'cliente' where org_id = $1 and user_id = $2", [org, ADMIN]), { commit: true });
    expect(await reviewer(ADMIN)).toBe(false);
  });

  it("org_members informa quem é revisor", async () => {
    const rows = await asUser(db, OWNER, (q) => q<{ user_id: string; legal_reviewer: boolean }>("select user_id, legal_reviewer from public.org_members($1)", [org]));
    expect(rows.find((r) => r.user_id === OWNER)?.legal_reviewer).toBe(false);
  });
});
