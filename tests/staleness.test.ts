import { describe, expect, it } from "vitest";
import { describeStaleness, staleSince } from "@/lib/report/staleness";

const at = (iso: string) => ({ created_at: iso });
const none = { documents: [], findings: [], parties: [], assets: [] };

describe("staleSince", () => {
  const versions = [
    { version: 1, status: "assinado", created_at: "2026-11-10T10:00:00Z" },
    { version: 2, status: "rascunho", created_at: "2026-11-12T10:00:00Z" },
  ];

  it("sem versão revisada/assinada não há o que invalidar", () => {
    expect(staleSince([{ version: 1, status: "rascunho", created_at: "2026-11-10T10:00:00Z" }], { ...none, documents: [at("2026-11-11T00:00:00Z")] })).toBeNull();
  });

  it("nada novo depois do retrato: versão continua atual", () => {
    expect(staleSince(versions, { ...none, documents: [at("2026-11-09T10:00:00Z")] })).toBeNull();
  });

  it("conta só o que entrou depois do retrato da última versão aprovada (rascunho não conta)", () => {
    const s = staleSince(versions, {
      documents: [at("2026-11-09T10:00:00Z"), at("2026-11-11T10:00:00Z"), at("2026-11-13T10:00:00Z")],
      findings: [at("2026-11-11T09:00:00Z")],
      parties: [],
      assets: [],
    });
    expect(s).toEqual({ version: 1, status: "assinado", documents: 2, findings: 1, parties: 0, assets: 0, total: 3 });
    expect(describeStaleness(s!)).toBe("2 documentos e 1 apontamento");
  });
});
