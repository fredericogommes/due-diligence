"use client";

import { useActionState, useState, useTransition } from "react";
import { buttonClass, Field, FormMessage, inputClass, SubmitButton } from "@/components/ui";
import { INVITE_ROLES, memberPermissions, ROLE_LABEL, type MemberRole, type MemberView } from "@/lib/members";
import { cancelInvitation, changeMemberRole, inviteMember, removeMember, setLegalReviewer, type MemberActionState } from "../actions";

export function MemberList({ orgId, me, members }: { orgId: string; me: { userId: string; role: MemberRole }; members: MemberView[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-line">
        {members.map((m) => {
          const can = memberPermissions(me, m);
          return (
            <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium">{m.full_name ?? m.email}{m.user_id === me.userId && <span className="text-subtle"> (você)</span>}</p>
                <p className="text-xs text-subtle">{m.email}</p>
                {m.legal_reviewer && <span className="mt-1 inline-block rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">Revisor jurídico</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {can.changeRole ? (
                  <select
                    aria-label={`Papel de ${m.full_name ?? m.email}`}
                    defaultValue={m.role}
                    disabled={pending}
                    className={`${inputClass} w-44`}
                    onChange={(e) => {
                      const role = e.target.value;
                      start(async () => setError((await changeMemberRole(orgId, m.user_id, role)).error));
                    }}
                  >
                    {can.assignableRoles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                ) : (
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-subtle">{ROLE_LABEL[m.role]}</span>
                )}
                {me.role === "owner" && m.role !== "cliente" && (
                  <label className="flex items-center gap-1.5 text-xs text-text" title="Pode revisar e assinar versões do relatório">
                    <input
                      type="checkbox"
                      checked={m.legal_reviewer}
                      disabled={pending}
                      onChange={(e) => {
                        const v = e.target.checked;
                        start(async () => setError((await setLegalReviewer(orgId, m.user_id, v)).error));
                      }}
                      className="accent-[var(--brand)]"
                    />
                    Revisor jurídico
                  </label>
                )}
                {(can.remove || can.leave) && (
                  <button
                    type="button"
                    disabled={pending}
                    className={buttonClass("danger")}
                    onClick={() => {
                      const msg = can.leave ? "Sair desta organização?" : `Remover ${m.full_name ?? m.email} da organização?`;
                      if (!confirm(msg)) return;
                      start(async () => setError((await removeMember(orgId, m.user_id)).error));
                    }}
                  >
                    {can.leave ? "Sair" : "Remover"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <FormMessage error={error} />
    </div>
  );
}

export function InviteForm({ orgId }: { orgId: string }) {
  const [state, action] = useActionState<MemberActionState, FormData>(inviteMember, {});
  return (
    <form key={state.at} action={action} className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
      <input type="hidden" name="orgId" value={orgId} />
      <Field label="E-mail">
        <input name="email" type="email" required className={inputClass} placeholder="pessoa@escritorio.com.br" />
      </Field>
      <Field label="Papel">
        <select name="role" defaultValue="advogado" className={inputClass}>
          {INVITE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
      </Field>
      <SubmitButton pendingText="Convidando…">Convidar</SubmitButton>
      <div className="sm:col-span-3"><FormMessage error={state.error} info={state.info} /></div>
    </form>
  );
}

type InvitationItem = { id: string; email: string; role: MemberRole; expired: boolean; expiresLabel: string };

export function InvitationList({ orgId, invitations }: { orgId: string; invitations: InvitationItem[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  if (invitations.length === 0) return <p className="text-sm text-subtle">Nenhum convite pendente.</p>;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-ink">Convites pendentes</h3>
      <ul className="divide-y divide-line">
        {invitations.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
            <span>
              {i.email} · {ROLE_LABEL[i.role]} ·{" "}
              <span className={i.expired ? "text-danger" : "text-subtle"}>{i.expired ? `expirou em ${i.expiresLabel}` : `vale até ${i.expiresLabel}`}</span>
            </span>
            <button
              type="button"
              disabled={pending}
              className={buttonClass("secondary")}
              onClick={() => start(async () => setError((await cancelInvitation(orgId, i.id)).error))}
            >
              Cancelar
            </button>
          </li>
        ))}
      </ul>
      <FormMessage error={error} />
    </div>
  );
}
