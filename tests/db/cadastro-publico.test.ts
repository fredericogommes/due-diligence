/** Cadastro público de clientes: só no escritório marcado; equipe não vira cliente. Dados sintéticos. */
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb, createUser } from "./harness";

const OWNER = "00000000-0000-0000-0000-0000000015a1";
const NEW_CLIENT = "00000000-0000-0000-0000-0000000015a2";
const OTHER_OWNER = "00000000-0000-0000-0000-0000000015a3";
let db: PGlite;
let mk: string;

beforeAll(async () => {
  db = await createTestDb();
  for (const id of [OWNER, NEW_CLIENT, OTHER_OWNER]) await createUser(db, id, id.slice(-2));
  mk = await asUser(db, OWNER, async (q) => (await q<{ id: string }>("select public.create_organization('MK') as id"))[0].id, { commit: true });
  await asUser(db, OTHER_OWNER, (q) => q("select public.create_organization('Outro')"), { commit: true });
}, 60_000);

describe("cadastro público de clientes", () => {
  it("sem escritório público, ninguém entra (devolve null)", async () => {
    expect(await asUser(db, NEW_CLIENT, async (q) => (await q<{ o: string | null }>("select public.join_public_client_org() as o"))[0].o)).toBeNull();
  });

  it("o cliente não marca o escritório como público (só o dono/admin, pela política de organização)", async () => {
    const r = await asUser(db, NEW_CLIENT, (q) => q("update public.organizations set accepts_public_clients = true where id = $1 returning id", [mk]));
    expect(r).toHaveLength(0);
  });

  it("com o escritório marcado, o novo usuário vira cliente dele (e só dele), sem acesso de equipe", async () => {
    await asUser(db, OWNER, (q) => q("update public.organizations set accepts_public_clients = true where id = $1", [mk]), { commit: true });
    const org = await asUser(db, NEW_CLIENT, async (q) => (await q<{ o: string }>("select public.join_public_client_org() as o"))[0].o, { commit: true });
    expect(org).toBe(mk);
    const r = await asUser(db, NEW_CLIENT, async (q) => ({
      roles: await q<{ role: string }>("select role from public.memberships"),
      deals: await q("select id from public.deals"),
      clientOrgs: await q<{ org_name: string }>("select org_name from public.my_client_orgs()"),
    }));
    expect(r).toEqual({ roles: [{ role: "cliente" }], deals: [], clientOrgs: [{ org_name: "MK" }] });
  });

  it("repetir não duplica; o dono (equipe) não vira cliente", async () => {
    await asUser(db, NEW_CLIENT, (q) => q("select public.join_public_client_org()"), { commit: true });
    await asUser(db, OWNER, (q) => q("select public.join_public_client_org()"), { commit: true });
    const rows = await asUser(db, OWNER, (q) => q<{ user_id: string; role: string }>("select user_id, role from public.memberships where org_id = $1 order by role::text", [mk]));
    expect(rows).toEqual([{ user_id: NEW_CLIENT, role: "cliente" }, { user_id: OWNER, role: "owner" }]);
  });
});
