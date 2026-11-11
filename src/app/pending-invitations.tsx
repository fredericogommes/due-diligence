"use client";

import { useState, useTransition } from "react";
import { buttonClass, FormMessage } from "@/components/ui";
import { acceptInvitation } from "./organizacoes/actions";

export function PendingInvitations({ invitations }: { invitations: { id: string; label: string }[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <section className="mb-6 rounded-xl border border-brand/40 bg-surface p-6">
      <h2 className="mb-3 text-lg font-semibold text-ink">Convites para você</h2>
      <ul className="divide-y divide-line">
        {invitations.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
            <span>{i.label}</span>
            <button
              type="button"
              disabled={pending}
              className={buttonClass("primary")}
              onClick={() => start(async () => setError((await acceptInvitation(i.id)).error))}
            >
              Aceitar
            </button>
          </li>
        ))}
      </ul>
      <FormMessage error={error} />
    </section>
  );
}
