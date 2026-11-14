import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb, createUser } from "./harness";

const ANA = "00000000-0000-0000-0000-0000000006a1"; // dona
const BETO = "00000000-0000-0000-0000-0000000006b1"; // convidado como advogado
const CAIO = "00000000-0000-0000-0000-0000000006c1"; // de fora
const DORA = "00000000-0000-0000-0000-0000000006d1"; // corretora

let db: PGlite;
let orgA: string;
let dealId: string;

beforeAll(async () => {
  db = await createTestDb();
  await createUser(db, ANA, "Ana");
  await createUser(db, BETO, "Beto");
  await createUser(db, CAIO, "Caio");
  await createUser(db, DORA, "Dora");
  orgA = await asUser(db, ANA, async (q) => {
    const [o] = await q<{ id: string }>("select public.create_organization('Escritório A') as id");
    await q("insert into public.memberships (org_id, user_id, role) values ($1, $2, 'corretor')", [o.id, DORA]);
    return o.id;
  }, { commit: true });
  dealId = await asUser(db, ANA, async (q) =>
    (await q<{ id: string }>("insert into public.deals (org_id, kind, title) values ($1, 'compra_venda_imovel', 'Apto 101') returning id", [orgA]))[0].id,
  { commit: true });
}, 60_000);

const email = (id: string) => `${id}@teste.local`;

describe("convites", () => {
  it("corretor não convida; dono convida", async () => {
    await expect(
      asUser(db, DORA, (q) => q("insert into public.invitations (org_id, email, role) values ($1, $2, 'advogado')", [orgA, email(BETO)])),
    ).rejects.toThrow();
    const rows = await asUser(db, ANA, (q) =>
      q("insert into public.invitations (org_id, email, role) values ($1, $2, 'advogado') returning id", [orgA, email(BETO)]),
    { commit: true });
    expect(rows).toHaveLength(1);
  });

  it("não se convida alguém como dono", async () => {
    await expect(
      asUser(db, ANA, (q) => q("insert into public.invitations (org_id, email, role) values ($1, 'x@y.com', 'owner')", [orgA])),
    ).rejects.toThrow();
  });

  it("o convidado vê o convite com o nome da organização; outro usuário não vê", async () => {
    const beto = await asUser(db, BETO, (q) => q<{ org_name: string; role: string }>("select org_name, role from public.my_invitations()"));
    expect(beto).toEqual([{ org_name: "Escritório A", role: "advogado" }]);
    const caio = await asUser(db, CAIO, (q) => q("select * from public.my_invitations()"));
    expect(caio).toHaveLength(0);
    const caioDireto = await asUser(db, CAIO, (q) => q("select * from public.invitations"));
    expect(caioDireto).toHaveLength(0);
  });

  it("outro usuário não aceita o convite alheio", async () => {
    const [inv] = await asUser(db, BETO, (q) => q<{ id: string }>("select id from public.my_invitations()"));
    await expect(asUser(db, CAIO, (q) => q("select public.accept_invitation($1)", [inv.id]))).rejects.toThrow(/convite/);
  });

  it("o convidado aceita e vira membro com o papel do convite", async () => {
    const [inv] = await asUser(db, BETO, (q) => q<{ id: string }>("select id from public.my_invitations()"));
    await asUser(db, BETO, (q) => q("select public.accept_invitation($1)", [inv.id]), { commit: true });
    const rows = await asUser(db, BETO, (q) => q("select role from public.memberships where org_id = $1 and user_id = $2", [orgA, BETO]));
    expect(rows).toEqual([{ role: "advogado" }]);
    const pend = await asUser(db, BETO, (q) => q("select * from public.my_invitations()"));
    expect(pend).toHaveLength(0);
  });

  it("org_members lista nome e e-mail só para membros", async () => {
    const membros = await asUser(db, BETO, (q) => q<{ full_name: string; email: string }>("select full_name, email from public.org_members($1)", [orgA]));
    expect(membros.map((m) => m.full_name)).toEqual(["Ana", "Dora", "Beto"]);
    expect(membros[0].email).toBe(email(ANA));
    const fora = await asUser(db, CAIO, (q) => q("select * from public.org_members($1)", [orgA]));
    expect(fora).toHaveLength(0);
  });

  it("convite expirado não pode ser aceito", async () => {
    const [inv] = await asUser(db, ANA, (q) =>
      q<{ id: string }>("insert into public.invitations (org_id, email, role, expires_at) values ($1, $2, 'corretor', now() - interval '1 day') returning id", [orgA, email(CAIO)]),
    { commit: true });
    await expect(asUser(db, CAIO, (q) => q("select public.accept_invitation($1)", [inv.id]))).rejects.toThrow(/expirado/);
  });
});

describe("versões do relatório", () => {
  const snapshot = JSON.stringify({ report: { dealTitle: "Apto 101" }, conclusion: "incompleta", opinion: null });

  it("numera as versões em sequência e começa como rascunho", async () => {
    const rows = await asUser(db, DORA, async (q) => {
      await q("insert into public.report_versions (deal_id, conclusion, snapshot) values ($1, 'incompleta', $2)", [dealId, snapshot]);
      await q("insert into public.report_versions (deal_id, conclusion, snapshot, status, version) values ($1, 'viavel', $2, 'assinado', 99)", [dealId, snapshot]);
      return q<{ version: number; status: string; created_by: string }>("select version, status, created_by from public.report_versions where deal_id = $1 order by version", [dealId]);
    }, { commit: true });
    expect(rows).toEqual([
      { version: 1, status: "rascunho", created_by: DORA },
      { version: 2, status: "rascunho", created_by: DORA },
    ]);
  });

  it("o conteúdo não muda depois de salvo", async () => {
    await expect(
      asUser(db, ANA, (q) => q("update public.report_versions set status = status, conclusion = 'viavel' where deal_id = $1 and version = 1", [dealId])),
    ).rejects.toThrow();
  });

  it("corretor não revisa; advogado revisa e depois assina", async () => {
    await expect(
      asUser(db, DORA, (q) => q("update public.report_versions set status = 'revisado' where deal_id = $1 and version = 1", [dealId])),
    ).rejects.toThrow(/revisor jurídico/);
    await expect(
      asUser(db, BETO, (q) => q("update public.report_versions set status = 'assinado' where deal_id = $1 and version = 1", [dealId])),
    ).rejects.toThrow(/inválida/);
    const rows = await asUser(db, BETO, async (q) => {
      await q("update public.report_versions set status = 'revisado' where deal_id = $1 and version = 1", [dealId]);
      await q("update public.report_versions set status = 'assinado' where deal_id = $1 and version = 1", [dealId]);
      return q<{ status: string; reviewed_by: string; signed_by: string }>("select status, reviewed_by, signed_by from public.report_versions where deal_id = $1 and version = 1", [dealId]);
    }, { commit: true });
    expect(rows).toEqual([{ status: "assinado", reviewed_by: BETO, signed_by: BETO }]);
  });

  it("versão assinada não volta atrás nem é apagada; rascunho pode ser apagado", async () => {
    await expect(
      asUser(db, BETO, (q) => q("update public.report_versions set status = 'rascunho' where deal_id = $1 and version = 1", [dealId])),
    ).rejects.toThrow(/inválida/);
    const apagadaAssinada = await asUser(db, ANA, (q) => q("delete from public.report_versions where deal_id = $1 and version = 1 returning id", [dealId]));
    expect(apagadaAssinada).toHaveLength(0);
    const apagadaRascunho = await asUser(db, ANA, (q) => q("delete from public.report_versions where deal_id = $1 and version = 2 returning id", [dealId]));
    expect(apagadaRascunho).toHaveLength(1);
  });

  it("quem é de fora não vê as versões", async () => {
    const rows = await asUser(db, CAIO, (q) => q("select * from public.report_versions"));
    expect(rows).toHaveLength(0);
  });
});

describe("log de auditoria", () => {
  it("registra quem criou e alterou, com os nomes dos campos (sem valores)", async () => {
    const partyId = await asUser(db, DORA, async (q) => {
      const [p] = await q<{ id: string }>(
        "insert into public.parties (deal_id, kind, role, name, document) values ($1, 'pf', 'vendedor', 'Fulano', '52998224725') returning id",
        [dealId],
      );
      await q("update public.parties set name = 'Fulano de Tal' where id = $1", [p.id]);
      return p.id;
    }, { commit: true });

    const rows = await asUser(db, DORA, (q) =>
      q<{ actor_id: string; action: string; changed_fields: string[] | null }>(
        "select actor_id, action, changed_fields from public.audit_log where table_name = 'parties' and record_id = $1 order by id",
        [partyId],
      ),
    );
    expect(rows).toEqual([
      { actor_id: DORA, action: "insert", changed_fields: null },
      { actor_id: DORA, action: "update", changed_fields: ["name"] },
    ]);
  });

  it("registra a criação do negócio e a entrada do membro convidado", async () => {
    const acoes = await asUser(db, ANA, (q) =>
      q<{ table_name: string; action: string }>("select table_name, action from public.audit_log where org_id = $1 order by id", [orgA]),
    );
    expect(acoes).toContainEqual({ table_name: "deals", action: "insert" });
    expect(acoes).toContainEqual({ table_name: "memberships", action: "insert" });
    expect(acoes).toContainEqual({ table_name: "invitations", action: "update" });
    expect(acoes).toContainEqual({ table_name: "report_versions", action: "update" });
  });

  it("corretor vê o histórico dos negócios, mas não o da organização", async () => {
    const rows = await asUser(db, DORA, (q) => q<{ deal_id: string | null }>("select deal_id from public.audit_log where org_id = $1", [orgA]));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.deal_id !== null)).toBe(true);
  });

  it("ninguém altera nem apaga o log, e quem é de fora não lê", async () => {
    await expect(asUser(db, ANA, (q) => q("delete from public.audit_log"))).rejects.toThrow();
    await expect(asUser(db, ANA, (q) => q("update public.audit_log set action = 'insert'"))).rejects.toThrow();
    await expect(
      asUser(db, ANA, (q) => q("insert into public.audit_log (org_id, table_name, action) values ($1, 'x', 'insert')", [orgA])),
    ).rejects.toThrow();
    const fora = await asUser(db, CAIO, (q) => q("select * from public.audit_log"));
    expect(fora).toHaveLength(0);
  });

  it("apagar o negócio deixa um único registro, e o histórico continua legível pelo dono", async () => {
    await asUser(db, ANA, (q) => q("delete from public.deals where id = $1", [dealId]), { commit: true });
    const rows = await asUser(db, ANA, (q) =>
      q<{ table_name: string }>("select table_name from public.audit_log where deal_id = $1 and action = 'delete'", [dealId]),
    );
    expect(rows).toEqual([{ table_name: "deals" }]);
  });

  it("apagar a organização não falha por causa do log", async () => {
    const rows = await asUser(db, ANA, (q) => q("delete from public.organizations where id = $1 returning id", [orgA]));
    expect(rows).toHaveLength(1);
  });
});
