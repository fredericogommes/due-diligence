import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb, createUser } from "./harness";

const ANA = "00000000-0000-0000-0000-0000000008a1"; // dona
const BIA = "00000000-0000-0000-0000-0000000008b1"; // cliente
const CAIO = "00000000-0000-0000-0000-0000000008c1"; // outro cliente
const DUDA = "00000000-0000-0000-0000-0000000008d1"; // advogada

let db: PGlite;
let org: string;
let dealBia: string;

beforeAll(async () => {
  db = await createTestDb();
  for (const [id, name] of [[ANA, "Ana"], [BIA, "Bia"], [CAIO, "Caio"], [DUDA, "Duda"]]) await createUser(db, id, name);
  org = await asUser(db, ANA, async (q) => {
    const [o] = await q<{ id: string }>("select public.create_organization('Escritório') as id");
    await q("insert into public.memberships (org_id, user_id, role) values ($1, $2, 'cliente'), ($1, $3, 'cliente'), ($1, $4, 'advogado')", [o.id, BIA, CAIO, DUDA]);
    return o.id;
  }, { commit: true });
}, 60_000);

describe("cliente", () => {
  it("abre solicitação na organização e ela nasce na qualificação, ligada a ele", async () => {
    dealBia = await asUser(db, BIA, async (q) =>
      (await q<{ id: string }>("select public.create_client_request($1, 'compra_venda_imovel', 'Apto da Bia', 500000, 'quero comprar') as id", [org]))[0].id,
    { commit: true });
    const rows = await asUser(db, ANA, (q) => q("select stage, client_id, title from public.deals where id = $1", [dealBia]));
    expect(rows).toEqual([{ stage: "qualificacao", client_id: BIA, title: "Apto da Bia" }]);
  });

  it("quem não é cliente não abre solicitação por essa função", async () => {
    await expect(asUser(db, CAIO, (q) => q("select public.create_client_request($1, 'compra_venda_imovel', 'X')", ["00000000-0000-0000-0000-000000000000"]))).rejects.toThrow(/clientes/);
    await expect(asUser(db, DUDA, (q) => q("select public.create_client_request($1, 'compra_venda_imovel', 'X')", [org]))).rejects.toThrow(/clientes/);
  });

  it("não lê as tabelas internas: negócios, partes, documentos, quadro", async () => {
    const r = await asUser(db, BIA, async (q) => ({
      deals: await q("select id from public.deals"),
      board: await q("select id from public.deal_board"),
      items: await q("select id from public.deal_items"),
      orgs: await q("select id from public.organizations"),
    }));
    expect(r).toEqual({ deals: [], board: [], items: [], orgs: [] });
  });

  it("vê só as próprias solicitações no resumo, e a própria participação", async () => {
    const bia = await asUser(db, BIA, (q) => q<{ title: string; stage: string; org_name: string }>("select title, stage, org_name from public.my_client_requests()"));
    expect(bia).toEqual([{ title: "Apto da Bia", stage: "qualificacao", org_name: "Escritório" }]);
    expect(await asUser(db, CAIO, (q) => q("select * from public.my_client_requests()"))).toHaveLength(0);
    expect(await asUser(db, BIA, (q) => q<{ role: string }>("select role from public.memberships"))).toEqual([{ role: "cliente" }]);
    expect(await asUser(db, BIA, (q) => q<{ org_name: string }>("select org_name from public.my_client_orgs()"))).toEqual([{ org_name: "Escritório" }]);
  });

  it("vê o relatório só depois de assinado", async () => {
    await asUser(db, DUDA, (q) => q("insert into public.report_versions (deal_id, conclusion, snapshot) values ($1, 'viavel', '{\"x\":1}')", [dealBia]), { commit: true });
    expect(await asUser(db, BIA, (q) => q("select * from public.client_signed_report($1)", [dealBia]))).toHaveLength(0);
    await asUser(db, DUDA, async (q) => {
      await q("update public.report_versions set status = 'revisado' where deal_id = $1", [dealBia]);
      await q("update public.report_versions set status = 'assinado' where deal_id = $1", [dealBia]);
    }, { commit: true });
    expect(await asUser(db, BIA, (q) => q<{ version: number }>("select version from public.client_signed_report($1)", [dealBia]))).toEqual([{ version: 1 }]);
    expect(await asUser(db, CAIO, (q) => q("select * from public.client_signed_report($1)", [dealBia]))).toHaveLength(0);
  });
});

describe("equipe e quadro", () => {
  it("a equipe vê o negócio do cliente no quadro, com as contagens", async () => {
    const rows = await asUser(db, DUDA, (q) => q<{ title: string; stage: string; parties: number; signed_version: number }>(
      "select title, stage, parties, signed_version from public.deal_board where id = $1", [dealBia]));
    expect(rows).toEqual([{ title: "Apto da Bia", stage: "qualificacao", parties: 0, signed_version: 1 }]);
  });

  it("responsável precisa ser da equipe; cliente precisa ser cliente", async () => {
    await expect(asUser(db, ANA, (q) => q("update public.deals set assignee_id = $2 where id = $1", [dealBia, BIA]))).rejects.toThrow(/equipe/);
    await expect(asUser(db, ANA, (q) => q("update public.deals set client_id = $2 where id = $1", [dealBia, DUDA]))).rejects.toThrow(/papel cliente/);
    const ok = await asUser(db, DUDA, (q) => q("update public.deals set assignee_id = $2, stage = 'consulta' where id = $1 returning stage", [dealBia, DUDA]));
    expect(ok).toEqual([{ stage: "consulta" }]);
  });

  it("etapa inválida é recusada", async () => {
    await expect(asUser(db, ANA, (q) => q("update public.deals set stage = 'xyz' where id = $1", [dealBia]))).rejects.toThrow();
  });
});
