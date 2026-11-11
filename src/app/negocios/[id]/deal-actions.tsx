"use client";

import { useState, useTransition } from "react";
import { buttonClass, inputClass } from "@/components/ui";
import { DEAL_STATUS_LABEL, DEAL_STATUSES, type DealStatus } from "@/lib/domain";
import { deleteDeal, updateDealStatus } from "../actions";

export function DealActions({ dealId, status }: { dealId: string; status: DealStatus }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-subtle" htmlFor="deal-status">Status</label>
        <select
          id="deal-status"
          defaultValue={status}
          disabled={pending}
          className={`${inputClass} w-40`}
          onChange={(e) => {
            const next = e.target.value;
            start(async () => setError((await updateDealStatus(dealId, next)).error));
          }}
        >
          {DEAL_STATUSES.map((s) => <option key={s} value={s}>{DEAL_STATUS_LABEL[s]}</option>)}
        </select>
        <a href={`/negocios/${dealId}/relatorio`} className={buttonClass("primary")}>Relatório preliminar</a>
        <a href={`/negocios/${dealId}/historico`} className={buttonClass("secondary")}>Histórico</a>
        <button
          type="button"
          disabled={pending}
          className={buttonClass("danger")}
          onClick={() => {
            if (!confirm("Apagar este negócio com partes, bens, checklist e documentos? Não dá para desfazer.")) return;
            start(async () => setError((await deleteDeal(dealId)).error));
          }}
        >
          Apagar
        </button>
      </div>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
    </div>
  );
}
