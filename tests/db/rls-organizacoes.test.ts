import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb, createUser } from "./harness";

const ANA = "00000000-0000-0000-0000-00000000000a"; // dona do escritório A
const BETO = "00000000-0000-0000-0000-00000000000b"; // corretor do escritório A
const CAIO = "00000000-0000-0000-0000-00000000000c"; // dono do escritório B (outro tenant)

let db: PGlite;
let orgA: string;
let orgB: string;

beforeAll(async () => {
  db = await createTestDb();
  await createUser(db, ANA, "Ana");
  await createUser(db, BETO, "Beto");
  await createUser(db, CAIO, "Caio");

  orgA = await asUser(db, ANA, async (q) => {
    const [row] = await q<{ id: string }>("select public.create_organization('Escritório A') as id");
    await q("insert into public.memberships (org_id, user_id, role) values ($1, $2, 'corretor')", [row.id, BETO]);
    return row.id;
  }, { commit: true });

  orgB = await asUser(db, CAIO, async (q) => {
    const [row] = await q<{ id: string }>("select public.create_organization('Escritório B') as id");
    return row.id;
  }, { commit: true });
}, 60_000);

describe("cadastro", () => {
  it("cria o perfil automaticamente com o nome informado", async () => {
    const rows = await asUser(db, ANA, (q) => q<{ full_name: string }>("select full_name from public.profiles where id = $1", [ANA]));
    expect(rows).toEqual([{ full_name: "Ana" }]);
  });

  it("create_organization torna o criador dono", async () => {
    const rows = await asUser(db, ANA, (q) => q("select role from public.memberships where org_id = $1 and user_id = $2", [orgA, ANA]));
    expect(rows).toEqual([{ role: "owner" }]);
  });

  it("anônimo não cria organização", async () => {
    await expect(asUser(db, null, (q) => q("select public.create_organization('X')"))).rejects.toThrow();
  });

  it("insert direto em organizations é bloqueado", async () => {
    await expect(
      asUser(db, ANA, (q) => q("insert into public.organizations (name) values ('Pirata')")),
    ).rejects.toThrow();
  });
});

describe("isolamento entre organizações", () => {
  it("cada usuário só vê as próprias organizações", async () => {
    const ana = await asUser(db, ANA, (q) => q<{ id: string }>("select id from public.organizations"));
    const caio = await asUser(db, CAIO, (q) => q<{ id: string }>("select id from public.organizations"));
    expect(ana.map((r) => r.id)).toEqual([orgA]);
    expect(caio.map((r) => r.id)).toEqual([orgB]);
  });

  it("não vê membros nem perfis de outra organização", async () => {
    const membros = await asUser(db, CAIO, (q) => q("select * from public.memberships where org_id = $1", [orgA]));
    const perfis = await asUser(db, CAIO, (q) => q<{ id: string }>("select id from public.profiles"));
    expect(membros).toHaveLength(0);
    expect(perfis.map((p) => p.id)).toEqual([CAIO]);
  });

  it("colega de organização vê o perfil do outro", async () => {
    const perfis = await asUser(db, BETO, (q) => q<{ id: string }>("select id from public.profiles order by id"));
    expect(perfis.map((p) => p.id)).toEqual([ANA, BETO]);
  });

  it("não consegue se incluir em organização alheia", async () => {
    await expect(
      asUser(db, CAIO, (q) => q("insert into public.memberships (org_id, user_id, role) values ($1, $2, 'owner')", [orgA, CAIO])),
    ).rejects.toThrow();
  });

  it("anônimo não lê nada", async () => {
    await expect(asUser(db, null, (q) => q("select * from public.organizations"))).rejects.toThrow();
  });
});

describe("papéis", () => {
  it("corretor não edita a organização", async () => {
    const rows = await asUser(db, BETO, (q) => q("update public.organizations set name = 'Hack' where id = $1 returning id", [orgA]));
    expect(rows).toHaveLength(0);
  });

  it("corretor não se promove a dono", async () => {
    const rows = await asUser(db, BETO, (q) =>
      q("update public.memberships set role = 'owner' where org_id = $1 and user_id = $2 returning role", [orgA, BETO]),
    );
    expect(rows).toHaveLength(0);
  });

  it("dono edita a organização", async () => {
    const rows = await asUser(db, ANA, (q) => q("update public.organizations set name = 'Escritório A2' where id = $1 returning id", [orgA]));
    expect(rows).toHaveLength(1);
  });

  it("o último dono não pode sair nem ser rebaixado", async () => {
    await expect(
      asUser(db, ANA, (q) => q("delete from public.memberships where org_id = $1 and user_id = $2", [orgA, ANA])),
    ).rejects.toThrow(/ao menos um dono/);
    await expect(
      asUser(db, ANA, (q) => q("update public.memberships set role = 'admin' where org_id = $1 and user_id = $2", [orgA, ANA])),
    ).rejects.toThrow(/ao menos um dono/);
  });

  it("membro comum pode sair da organização", async () => {
    const rows = await asUser(db, BETO, (q) =>
      q("delete from public.memberships where org_id = $1 and user_id = $2 returning user_id", [orgA, BETO]),
    );
    expect(rows).toHaveLength(1);
  });

  it("dono apaga a organização inteira (membros em cascata)", async () => {
    const rows = await asUser(db, CAIO, (q) => q("delete from public.organizations where id = $1 returning id", [orgB]));
    expect(rows).toHaveLength(1);
  });
});
