"use client";

import { useActionState, useState, useTransition } from "react";
import { Field, FormMessage, inputClass, SubmitButton } from "@/components/ui";
import type { PartyRow } from "@/lib/db-types";
import {
  formatDocument, MARITAL_STATUS_LABEL, MARITAL_STATUSES, PARTY_KIND_LABEL, PARTY_ROLE_LABEL, PROPERTY_REGIME_LABEL,
  PROPERTY_REGIMES, type DealKind, type PartyRole,
} from "@/lib/domain";
import { addParty, deleteParty, type ActionState } from "../actions";

const ROLES_BY_KIND: Record<DealKind, PartyRole[]> = {
  compra_venda_imovel: ["vendedor", "conjuge", "comprador", "procurador", "outro"],
  cessao_cotas: ["empresa_alvo", "cedente", "socio", "conjuge", "cessionario", "procurador", "outro"],
};

export function PartiesSection({ dealId, dealKind, parties }: { dealId: string; dealKind: DealKind; parties: PartyRow[] }) {
  const [state, action] = useActionState<ActionState, FormData>(addParty, {});
  const [open, setOpen] = useState(parties.length === 0);
  const [pending, start] = useTransition();
  const [removeError, setRemoveError] = useState<string>();
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">Partes</h2>
        <button type="button" className="text-sm text-brand hover:underline" onClick={() => setOpen((o) => !o)}>
          {open ? "Fechar" : "Adicionar parte"}
        </button>
      </div>

      {parties.length === 0 ? (
        <p className="mb-3 text-sm text-subtle">Nenhuma parte cadastrada.</p>
      ) : (
        <ul className="mb-3 divide-y divide-line">
          {parties.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-3 py-2 text-sm">
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-subtle">
                  {PARTY_ROLE_LABEL[p.role]} · {PARTY_KIND_LABEL[p.kind]}
                  {p.document && ` · ${formatDocument(p.document)}`}
                  {p.marital_status && ` · ${MARITAL_STATUS_LABEL[p.marital_status]}`}
                  {p.property_regime && ` (${PROPERTY_REGIME_LABEL[p.property_regime]})`}
                </div>
              </div>
              <button
                type="button"
                disabled={pending}
                className="text-xs text-danger hover:underline"
                onClick={() => {
                  if (!confirm(`Remover ${p.name}? Os itens do checklist dessa parte também serão removidos.`)) return;
                  start(async () => setRemoveError((await deleteParty(dealId, p.id)).error));
                }}
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}
      <FormMessage error={removeError} />

      {open && <PartyForm key={state.at ?? 0} dealId={dealId} dealKind={dealKind} action={action} error={state.error} />}
    </section>
  );
}

function PartyForm({
  dealId, dealKind, action, error,
}: {
  dealId: string;
  dealKind: DealKind;
  action: (form: FormData) => void;
  error?: string;
}) {
  const [kind, setKind] = useState<"pf" | "pj">("pf");
  const [marital, setMarital] = useState("");
  return (
    <form action={action} className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
      <input type="hidden" name="dealId" value={dealId} />
      <Field label="Tipo">
        <select name="kind" className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as "pf" | "pj")}>
          <option value="pf">Pessoa física</option>
          <option value="pj">Pessoa jurídica</option>
        </select>
      </Field>
      <Field label="Papel no negócio">
        <select name="role" className={inputClass} required>
          {ROLES_BY_KIND[dealKind].map((r) => <option key={r} value={r}>{PARTY_ROLE_LABEL[r]}</option>)}
        </select>
      </Field>
      <Field label={kind === "pf" ? "Nome completo" : "Razão social"}>
        <input name="name" required minLength={2} maxLength={200} className={inputClass} />
      </Field>
      <Field label={kind === "pf" ? "CPF" : "CNPJ"} hint="Opcional">
        <input name="document" inputMode="numeric" className={inputClass} placeholder={kind === "pf" ? "000.000.000-00" : "00.000.000/0000-00"} />
      </Field>
      {kind === "pf" && (
        <>
          <Field label="Estado civil">
            <select name="maritalStatus" className={inputClass} value={marital} onChange={(e) => setMarital(e.target.value)}>
              <option value="">Não informado</option>
              {MARITAL_STATUSES.map((m) => <option key={m} value={m}>{MARITAL_STATUS_LABEL[m]}</option>)}
            </select>
          </Field>
          <Field label="Regime de bens">
            <select name="propertyRegime" className={inputClass} disabled={marital !== "casado" && marital !== "uniao_estavel"} defaultValue="">
              <option value="">Não informado</option>
              {PROPERTY_REGIMES.map((r) => <option key={r} value={r}>{PROPERTY_REGIME_LABEL[r]}</option>)}
            </select>
          </Field>
        </>
      )}
      <div className="sm:col-span-2 space-y-2">
        <FormMessage error={error} />
        <SubmitButton pendingText="Adicionando…">Adicionar parte</SubmitButton>
      </div>
    </form>
  );
}
