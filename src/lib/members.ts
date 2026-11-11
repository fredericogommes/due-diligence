export const MEMBER_ROLES = ["owner", "admin", "advogado", "corretor", "cliente"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const ROLE_LABEL: Record<MemberRole, string> = {
  owner: "Dono",
  admin: "Administrador",
  advogado: "Advogado",
  corretor: "Corretor",
  cliente: "Cliente",
};

/** Papéis que se pode atribuir num convite (ninguém entra como dono). */
export const INVITE_ROLES = ["admin", "advogado", "corretor", "cliente"] as const satisfies readonly MemberRole[];

export type MemberView = {
  user_id: string;
  full_name: string | null;
  email: string;
  role: MemberRole;
  created_at: string;
};

/** Equipe = todos menos o cliente. */
export function isStaff(role: MemberRole | null | undefined): boolean {
  return !!role && role !== "cliente";
}

export function isManager(role: MemberRole | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

/**
 * O que `actor` pode fazer com o membro `target` (espelha as políticas do banco):
 * dono gerencia todos; administrador gerencia quem não é dono; qualquer um
 * (menos o dono) pode sair. O banco ainda impede que fique sem dono.
 */
export function memberPermissions(actor: { userId: string; role: MemberRole }, target: { user_id: string; role: MemberRole }) {
  const self = actor.userId === target.user_id;
  const manages = actor.role === "owner" || (actor.role === "admin" && target.role !== "owner");
  return {
    changeRole: manages && !self,
    /** Papéis que o actor pode atribuir ao alvo. */
    assignableRoles: actor.role === "owner" ? [...MEMBER_ROLES] : (["admin", "advogado", "corretor", "cliente"] as MemberRole[]),
    remove: manages && !self,
    leave: self && target.role !== "owner",
  };
}

/** Versões do relatório. */
export const REPORT_STATUSES = ["rascunho", "revisado", "assinado"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];
export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  rascunho: "Rascunho",
  revisado: "Revisado",
  assinado: "Assinado",
};

/** Próximo status de uma versão, ou null se já está assinada. */
export function nextReportStatus(status: ReportStatus): ReportStatus | null {
  if (status === "rascunho") return "revisado";
  if (status === "revisado") return "assinado";
  return null;
}

/** Quem pode revisar ou assinar uma versão. */
export function canSignReports(role: MemberRole | null | undefined): boolean {
  return role === "owner" || role === "admin" || role === "advogado";
}
