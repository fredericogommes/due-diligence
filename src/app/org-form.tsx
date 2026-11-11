"use client";

import { useActionState } from "react";
import { createOrganization, type OrgState } from "./actions";

const input =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export function OrgForm() {
  const [state, action, pending] = useActionState<OrgState, FormData>(createOrganization, {});
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_14rem_auto] sm:items-end">
      <label className="block space-y-1 text-sm">
        <span>Nome do escritório ou imobiliária</span>
        <input name="name" required minLength={2} maxLength={120} className={input} />
      </label>
      <label className="block space-y-1 text-sm">
        <span>CNPJ (opcional)</span>
        <input name="cnpj" inputMode="numeric" placeholder="00.000.000/0000-00" className={input} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-60"
      >
        {pending ? "Criando…" : "Criar"}
      </button>
      {state.error && <p className="text-sm text-danger sm:col-span-3" role="alert">{state.error}</p>}
    </form>
  );
}
