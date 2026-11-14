/** Gate G05 (MK-01): estados dos achados, justificativa, aceite só por revisor e histórico preservado. */
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb, createUser } from "./harness";

const OWNER = "00000000-0000-0000-0000-0000000013a1";
const LAWYER = "00000000-0000-0000-0000-0000000013a2";
const BROKER = "00000000-0000-0000-0000-0000000013a3";

let db: PGlite;
let deal: string;

const insert = (uid: string, source: string, extra = "") =>
  asUser(db, uid, async (q) =>
    (await q<{ id: string; status: string; resolved: boolean }>(
      `insert into public.findings (deal_id, severity, title, source${extra ? ", status, resolved" : ""}) values ($1, 'alto', 'Achado sintético', $2${extra}) returning id, status, resolved`,
      [deal, source],
    ))[0], { commit: true });

const setStatus = (uid: string, id: string, status: string, note: string | null = null) =>
  asUser(db, uid, (q) => q<{ status: string; resolved: boolean; status_changed_by: string }>(
    "update public.findings set status = $2, resolution_note = $3 where id = $1 returning status, resolved, status_changed_by", [id, status, note]), { commit: true });

beforeAll(async () => {
  db = await createTestDb();
  for (const id of [OWNER, LAWYER, BROKER]) await createUser(db, id, id.slice(-2));
  const org = await asUser(db, OWNER, async (q) => {
    const [o] = await q<{ id: string }>("select public.create_organization('Escritório') as id");
    await q("insert into public.memberships (org_id, user_id, role) values ($1, $2, 'advogado'), ($1, $3, 'corretor')", [o.id, LAWYER, BROKER]);
    return o.id;
  }, { commit: true });
  deal = await asUser(db, OWNER, async (q) => (await q<{ id: string }>("insert into public.deals (org_id, kind, title) values ($1, 'compra_venda_imovel', 'Negócio sintético') returning id", [org]))[0].id, { commit: true });
}, 60_000);

describe("estados dos achados", () => {
  it("IA e consulta nascem 'proposto'; manual nasce 'confirmado' — o cliente não escolhe", async () => {
    expect(await insert(BROKER, "ia")).toMatchObject({ status: "proposto", resolved: false });
    expect(await insert(BROKER, "consulta")).toMatchObject({ status: "proposto" });
    expect(await insert(BROKER, "manual", ", 'resolvido', true")).toMatchObject({ status: "confirmado", resolved: false });
  });

  it("encerrar exige justificativa; com justificativa, resolved acompanha e registra quem mudou", async () => {
    const f = await insert(BROKER, "ia");
    await expect(setStatus(BROKER, f.id, "descartado")).rejects.toThrow(/justificativa/);
    await expect(setStatus(BROKER, f.id, "resolvido", "   ")).rejects.toThrow(/justificativa/);
    expect(await setStatus(BROKER, f.id, "confirmado")).toEqual([{ status: "confirmado", resolved: false, status_changed_by: BROKER }]);
    expect(await setStatus(BROKER, f.id, "mitigado", "Retenção de 10% do preço até a baixa")).toEqual([{ status: "mitigado", resolved: true, status_changed_by: BROKER }]);
  });

  it("aceitar risco só com revisor jurídico", async () => {
    const f = await insert(BROKER, "manual");
    await expect(setStatus(BROKER, f.id, "aceito", "Cliente ciente")).rejects.toThrow(/revisor jurídico/);
    await expect(setStatus(OWNER, f.id, "aceito", "Cliente ciente")).rejects.toThrow(/revisor jurídico/);
    expect(await setStatus(LAWYER, f.id, "aceito", "Cliente ciente e de acordo")).toEqual([{ status: "aceito", resolved: true, status_changed_by: LAWYER }]);
  });

  it("não volta a proposto", async () => {
    const f = await insert(BROKER, "ia");
    await setStatus(BROKER, f.id, "confirmado");
    await expect(setStatus(BROKER, f.id, "proposto")).rejects.toThrow(/não volta/);
  });

  it("compatibilidade: mexer só em 'resolved' vira mudança de estado (e ainda exige justificativa)", async () => {
    const f = await insert(BROKER, "manual");
    await expect(asUser(db, BROKER, (q) => q("update public.findings set resolved = true where id = $1", [f.id]))).rejects.toThrow(/justificativa/);
    const r = await asUser(db, BROKER, (q) => q<{ status: string }>("update public.findings set resolved = true, resolution_note = 'ok' where id = $1 returning status", [f.id]));
    expect(r).toEqual([{ status: "resolvido" }]);
  });

  it("histórico preservado: só se apaga proposta não revisada ou manual ainda confirmado", async () => {
    const proposta = await insert(BROKER, "ia");
    const confirmadaIa = await insert(BROKER, "ia");
    await setStatus(BROKER, confirmadaIa.id, "confirmado");
    const manualEncerrado = await insert(BROKER, "manual");
    await setStatus(BROKER, manualEncerrado.id, "descartado", "Duplicado");
    const del = (id: string) => asUser(db, BROKER, (q) => q("delete from public.findings where id = $1 returning id", [id]));
    expect(await del(proposta.id)).toHaveLength(1);
    expect(await del(confirmadaIa.id)).toHaveLength(0);
    expect(await del(manualEncerrado.id)).toHaveLength(0);
  });
});
