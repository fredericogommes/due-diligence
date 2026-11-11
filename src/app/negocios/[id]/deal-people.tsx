"use client";

import { useState, useTransition } from "react";
import { FormMessage, inputClass } from "@/components/ui";
import { assignDeal, setDealClient } from "@/app/painel/actions";

type Person = { id: string; name: string };

/** Responsável da equipe e cliente da solicitação. */
export function DealPeople({ dealId, assigneeId, clientId, staff, clients }: {
  dealId: string; assigneeId: string | null; clientId: string | null; staff: Person[]; clients: Person[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div className="flex flex-wrap items-end gap-3 text-sm">
      <label className="space-y-1">
        <span className="block text-xs text-subtle">Responsável</span>
        <select defaultValue={assigneeId ?? ""} disabled={pending} className={`${inputClass} w-48`}
          onChange={(e) => { const v = e.target.value || null; start(async () => setError((await assignDeal(dealId, v)).error)); }}>
          <option value="">Sem responsável</option>
          {staff.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label className="space-y-1">
        <span className="block text-xs text-subtle">Cliente</span>
        <select defaultValue={clientId ?? ""} disabled={pending} className={`${inputClass} w-48`}
          onChange={(e) => { const v = e.target.value || null; start(async () => setError((await setDealClient(dealId, v)).error)); }}>
          <option value="">Sem cliente</option>
          {clients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <FormMessage error={error} />
    </div>
  );
}
