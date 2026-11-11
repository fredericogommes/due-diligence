"use client";

import { useActionState } from "react";
import { Field, FormMessage, inputClass, SubmitButton } from "@/components/ui";
import { DEAL_KIND_LABEL, DEAL_KINDS } from "@/lib/domain";
import { createDeal, type ActionState } from "../actions";

const KIND_HINT = {
  compra_venda_imovel: "Checklist gerado a partir dos imóveis e das partes que você cadastrar (vendedores, cônjuges, compradores).",
  cessao_cotas: "Checklist TETTU de 35 itens: societário, regulatório, fiscal, trabalhista, forense, ativos e financeiro.",
} as const;

export function NewDealForm({ orgs }: { orgs: { id: string; name: string }[] }) {
  const [state, action] = useActionState<ActionState, FormData>(createDeal, {});
  return (
    <form action={action} className="space-y-4 rounded-xl border border-line bg-surface p-6">
      {orgs.length > 1 ? (
        <Field label="Organização">
          <select name="orgId" required className={inputClass} defaultValue={orgs[0].id}>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </Field>
      ) : (
        <input type="hidden" name="orgId" value={orgs[0].id} />
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Tipo de negócio</legend>
        {DEAL_KINDS.map((k, i) => (
          <label key={k} className="flex cursor-pointer gap-3 rounded-md border border-line p-3 has-[:checked]:border-brand has-[:checked]:bg-brand/5">
            <input type="radio" name="kind" value={k} defaultChecked={i === 0} className="mt-1 accent-[var(--brand)]" />
            <span>
              <span className="block text-sm font-semibold">{DEAL_KIND_LABEL[k]}</span>
              <span className="block text-xs text-subtle">{KIND_HINT[k]}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <Field label="Nome do negócio" hint="Ex.: Apto 101 – Rua das Flores, 200 ou Aquisição AME Clínica">
        <input name="title" required minLength={2} maxLength={200} className={inputClass} />
      </Field>
      <Field label="Valor do negócio (R$)" hint="Opcional">
        <input name="price" inputMode="decimal" placeholder="1.250.000,00" className={inputClass} />
      </Field>
      <Field label="Observações" hint="Opcional">
        <textarea name="notes" rows={3} maxLength={5000} className={inputClass} />
      </Field>

      <FormMessage error={state.error} />
      <SubmitButton pendingText="Criando…">Criar negócio</SubmitButton>
    </form>
  );
}
