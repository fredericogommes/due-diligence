import { describe, expect, it } from "vitest";
import { describeAudit, formatDateTime } from "@/lib/audit";
import { canSignReports, memberPermissions, nextReportStatus } from "@/lib/members";

describe("memberPermissions", () => {
  const owner = { userId: "o", role: "owner" as const };
  const admin = { userId: "a", role: "admin" as const };
  const corretor = { userId: "c", role: "corretor" as const };

  it("dono muda papel e remove qualquer outro membro, e pode promover a dono", () => {
    const p = memberPermissions(owner, { user_id: "a", role: "admin" });
    expect(p).toMatchObject({ changeRole: true, remove: true, leave: false });
    expect(p.assignableRoles).toContain("owner");
  });

  it("administrador não mexe no dono e não promove a dono", () => {
    expect(memberPermissions(admin, { user_id: "o", role: "owner" })).toMatchObject({ changeRole: false, remove: false });
    const p = memberPermissions(admin, { user_id: "c", role: "corretor" });
    expect(p.changeRole).toBe(true);
    expect(p.assignableRoles).not.toContain("owner");
  });

  it("corretor só pode sair", () => {
    expect(memberPermissions(corretor, { user_id: "a", role: "admin" })).toMatchObject({ changeRole: false, remove: false, leave: false });
    expect(memberPermissions(corretor, { user_id: "c", role: "corretor" })).toMatchObject({ changeRole: false, remove: false, leave: true });
  });

  it("o dono não 'sai' pela lista (precisa passar a posse antes)", () => {
    expect(memberPermissions(owner, { user_id: "o", role: "owner" }).leave).toBe(false);
  });
});

describe("versões do relatório", () => {
  it("avança rascunho → revisado → assinado", () => {
    expect(nextReportStatus("rascunho")).toBe("revisado");
    expect(nextReportStatus("revisado")).toBe("assinado");
    expect(nextReportStatus("assinado")).toBeNull();
  });

  it("corretor não assina", () => {
    expect(canSignReports("advogado")).toBe(true);
    expect(canSignReports("corretor")).toBe(false);
    expect(canSignReports(null)).toBe(false);
  });
});

describe("describeAudit", () => {
  it("descreve inclusão, alteração e exclusão com gênero certo", () => {
    expect(describeAudit({ table_name: "parties", action: "insert", changed_fields: null })).toBe("incluiu a parte");
    expect(describeAudit({ table_name: "parties", action: "update", changed_fields: ["name", "document"] })).toBe("alterou a parte (nome, CPF/CNPJ)");
    expect(describeAudit({ table_name: "deals", action: "delete", changed_fields: null })).toBe("excluiu o negócio");
  });

  it("eventos especiais de membros, convites e versões", () => {
    expect(describeAudit({ table_name: "memberships", action: "update", changed_fields: ["role"] })).toBe("mudou o papel de um membro");
    expect(describeAudit({ table_name: "invitations", action: "update", changed_fields: ["accepted_at", "accepted_by"] })).toBe("aceitou um convite");
    expect(describeAudit({ table_name: "report_versions", action: "update", changed_fields: ["signed_at", "signed_by", "status"] })).toBe(
      "assinou uma versão do relatório",
    );
    expect(describeAudit({ table_name: "report_versions", action: "insert", changed_fields: null })).toBe("salvou uma versão do relatório");
  });

  it("não repete campos com o mesmo rótulo", () => {
    expect(describeAudit({ table_name: "findings", action: "update", changed_fields: ["resolved", "resolved_at"] })).toBe(
      "alterou o risco/apontamento (resolvido)",
    );
  });

  it("formata data e hora em São Paulo", () => {
    expect(formatDateTime("2026-11-11T17:05:00Z")).toBe("11/11/2026, 14:05");
  });
});
