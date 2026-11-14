/**
 * Gate G02 (MK-01 §11): dois tenants, tentativas de leitura, escrita e exclusão
 * cruzadas em todas as tabelas do negócio, no Storage e nas funções. Dados sintéticos.
 */
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb, createUser } from "./harness";

const A_OWNER = "00000000-0000-0000-0000-00000000a0a1";
const A_LAWYER = "00000000-0000-0000-0000-00000000a0a2";
const A_CLIENT = "00000000-0000-0000-0000-00000000a0a3";
const B_OWNER = "00000000-0000-0000-0000-00000000b0b1";

let db: PGlite;
let orgA: string;
let orgB: string;
const a: Record<string, string> = {};

/** Tabelas com org_id herdado do negócio. */
const CHILD_TABLES = [
  "parties", "assets", "deal_items", "documents", "document_analyses", "findings",
  "deal_opinions", "certificate_requests", "report_versions",
] as const;

beforeAll(async () => {
  db = await createTestDb();
  for (const id of [A_OWNER, A_LAWYER, A_CLIENT, B_OWNER]) await createUser(db, id, id.slice(-4));
  orgA = await asUser(db, A_OWNER, async (q) => {
    const [o] = await q<{ id: string }>("select public.create_organization('Tenant A') as id");
    await q("insert into public.memberships (org_id, user_id, role) values ($1, $2, 'advogado'), ($1, $3, 'cliente')", [o.id, A_LAWYER, A_CLIENT]);
    return o.id;
  }, { commit: true });
  orgB = await asUser(db, B_OWNER, async (q) => (await q<{ id: string }>("select public.create_organization('Tenant B') as id"))[0].id, { commit: true });

  // Um negócio completo no tenant A, com uma linha em cada tabela filha.
  Object.assign(a, await asUser(db, A_OWNER, async (q) => {
    const [deal] = await q<{ id: string }>("insert into public.deals (org_id, kind, title, client_id) values ($1, 'compra_venda_imovel', 'Sigiloso A', $2) returning id", [orgA, A_CLIENT]);
    const [party] = await q<{ id: string }>("insert into public.parties (deal_id, kind, role, name) values ($1, 'pf', 'vendedor', 'Vendedor A') returning id", [deal.id]);
    const [asset] = await q<{ id: string }>("insert into public.assets (deal_id, kind, description) values ($1, 'imovel', 'Imóvel A') returning id", [deal.id]);
    const [item] = await q<{ id: string }>("select id from public.deal_items where deal_id = $1 limit 1", [deal.id]);
    const path = `${orgA}/${deal.id}/00000000-0000-0000-0000-000000000001-a.pdf`;
    await q("insert into storage.objects (bucket_id, name) values ('documentos', $1)", [path]);
    const [doc] = await q<{ id: string }>(
      "insert into public.documents (deal_id, deal_item_id, storage_path, file_name, mime_type, size_bytes) values ($1, $2, $3, 'a.pdf', 'application/pdf', 10) returning id",
      [deal.id, item.id, path],
    );
    const [an] = await q<{ id: string }>("insert into public.document_analyses (deal_id, document_id) values ($1, $2) returning id", [deal.id, doc.id]);
    const [fi] = await q<{ id: string }>("insert into public.findings (deal_id, severity, title) values ($1, 'alto', 'Risco A') returning id", [deal.id]);
    await q("insert into public.deal_opinions (deal_id, opinion) values ($1, 'Parecer interno A')", [deal.id]);
    const [cr] = await q<{ id: string }>("insert into public.certificate_requests (deal_id, deal_item_id, provider) values ($1, $2, 'simulado') returning id", [deal.id, item.id]);
    const [rv] = await q<{ id: string }>("insert into public.report_versions (deal_id, conclusion, snapshot) values ($1, 'viavel', '{}') returning id", [deal.id]);
    return { deal: deal.id, party: party.id, asset: asset.id, item: item.id, doc: doc.id, analysis: an.id, finding: fi.id, request: cr.id, version: rv.id, path };
  }, { commit: true }));
}, 60_000);

describe("leitura cruzada", () => {
  it("o dono do tenant B não lê nenhuma linha do tenant A", async () => {
    for (const table of ["deals", "deal_board", "audit_log", "invitations", ...CHILD_TABLES]) {
      const rows = await asUser(db, B_OWNER, (q) => q(`select 1 from public.${table} where org_id = $1`, [orgA]));
      expect(rows, table).toHaveLength(0);
    }
  });

  it("nem os arquivos do tenant A no Storage", async () => {
    const rows = await asUser(db, B_OWNER, (q) => q("select name from storage.objects where name = $1", [a.path]));
    expect(rows).toHaveLength(0);
  });

  it("funções não vazam dados de A para B", async () => {
    const r = await asUser(db, B_OWNER, async (q) => ({
      members: await q("select * from public.org_members($1)", [orgA]),
      report: await q("select * from public.client_signed_report($1)", [a.deal]),
      requests: await q("select * from public.my_client_requests()"),
      isMember: (await q<{ v: boolean }>("select public.is_org_member($1) as v", [orgA]))[0].v,
    }));
    expect(r).toEqual({ members: [], report: [], requests: [], isMember: false });
  });

  it("o cliente convidado não lê notas internas (parecer, apontamentos, documentos)", async () => {
    for (const table of ["deal_opinions", "findings", "documents", "document_analyses", "deals", "audit_log"]) {
      const rows = await asUser(db, A_CLIENT, (q) => q(`select 1 from public.${table}`));
      expect(rows, table).toHaveLength(0);
    }
  });
});

describe("escrita e exclusão cruzadas", () => {
  it("B não altera nem apaga linhas de A (zero linhas afetadas)", async () => {
    for (const [table, col] of [["deals", "title"], ["parties", "name"], ["assets", "description"], ["findings", "title"], ["deal_opinions", "opinion"]] as const) {
      const upd = await asUser(db, B_OWNER, (q) => q(`update public.${table} set ${col} = 'invadido' where org_id = $1 returning 1`, [orgA]));
      expect(upd, `update ${table}`).toHaveLength(0);
    }
    for (const table of ["deals", ...CHILD_TABLES]) {
      const del = await asUser(db, B_OWNER, (q) => q(`delete from public.${table} where org_id = $1 returning 1`, [orgA])).catch(() => []);
      expect(del, `delete ${table}`).toHaveLength(0);
    }
  });

  it("B não insere filhos no negócio de A, mesmo informando o próprio org_id", async () => {
    await expect(asUser(db, B_OWNER, (q) => q("insert into public.parties (org_id, deal_id, kind, role, name) values ($1, $2, 'pf', 'vendedor', 'X')", [orgB, a.deal]))).rejects.toThrow();
    await expect(asUser(db, B_OWNER, (q) => q("insert into public.findings (org_id, deal_id, severity, title) values ($1, $2, 'baixo', 'X')", [orgB, a.deal]))).rejects.toThrow();
    await expect(asUser(db, B_OWNER, (q) => q("insert into public.deals (org_id, kind, title) values ($1, 'compra_venda_imovel', 'X')", [orgA]))).rejects.toThrow();
  });

  it("B não envia arquivo para a pasta de A", async () => {
    await expect(
      asUser(db, B_OWNER, (q) => q("insert into storage.objects (bucket_id, name) values ('documentos', $1)", [`${orgA}/${a.deal}/x.pdf`])),
    ).rejects.toThrow();
  });

  it("B não se convida nem se insere em A", async () => {
    await expect(asUser(db, B_OWNER, (q) => q("insert into public.invitations (org_id, email, role) values ($1, 'x@y.com', 'admin')", [orgA]))).rejects.toThrow();
    await expect(asUser(db, B_OWNER, (q) => q("insert into public.memberships (org_id, user_id, role) values ($1, $2, 'admin')", [orgA, B_OWNER]))).rejects.toThrow();
  });
});

describe("o banco rejeita relação entre tenants mesmo sem o trigger (FK composta)", () => {
  it.each(CHILD_TABLES.filter((t) => t !== "deal_opinions" && t !== "report_versions"))("%s: org_id diferente do negócio é recusado", async (table) => {
    await db.exec("begin");
    try {
      await db.exec(`alter table public.${table} disable trigger user`);
      await expect(db.query(`update public.${table} set org_id = $1 where deal_id = $2`, [orgB, a.deal])).rejects.toThrow(/org_deal_fkey/);
    } finally {
      await db.exec("rollback");
    }
  });
});

describe("revogação", () => {
  it("membro removido perde o acesso imediatamente", async () => {
    const before = await asUser(db, A_LAWYER, (q) => q("select id from public.deals where id = $1", [a.deal]));
    expect(before).toHaveLength(1);
    const after = await asUser(db, A_OWNER, async (q) => {
      await q("delete from public.memberships where org_id = $1 and user_id = $2", [orgA, A_LAWYER]);
      await q("select set_config('request.jwt.claim.sub', $1, true)", [A_LAWYER]);
      return q("select id from public.deals where id = $1", [a.deal]);
    });
    expect(after).toHaveLength(0);
  });
});

describe("auditoria de acesso a documentos", () => {
  it("abrir documento registra quem abriu; B não abre nem descobre se existe", async () => {
    const path = await asUser(db, A_OWNER, async (q) => (await q<{ p: string }>("select public.log_document_access($1) as p", [a.doc]))[0].p, { commit: true });
    expect(path).toBe(a.path);
    const log = await asUser(db, A_OWNER, (q) => q<{ actor_id: string; action: string }>("select actor_id, action from public.audit_log where record_id = $1 and action = 'download'", [a.doc]));
    expect(log).toEqual([{ actor_id: A_OWNER, action: "download" }]);
    await expect(asUser(db, B_OWNER, (q) => q("select public.log_document_access($1)", [a.doc]))).rejects.toThrow(/não encontrado/);
    await expect(asUser(db, B_OWNER, (q) => q("select public.log_document_access($1)", ["00000000-0000-0000-0000-000000000099"]))).rejects.toThrow(/não encontrado/);
    await expect(asUser(db, A_CLIENT, (q) => q("select public.log_document_access($1)", [a.doc]))).rejects.toThrow(/não encontrado/);
  });
});
