"use client";

import { useActionState } from "react";
import { CurrencyInput, Field, FormMessage, inputClass, SubmitButton } from "@/components/ui";
import { DEAL_KIND_LABEL, DEAL_KINDS } from "@/lib/domain";
import { createRequest, type RequestState } from "./actions";

export function NewRequestForm({ orgs }: { orgs: { org_id: string; org_name: string }[] }) {
  const [state, action] = useActionState<RequestState, FormData>(createRequest, {});
  return (
    <form key={state.at} action={action} className="grid gap-3 sm:grid-cols-2">
      {orgs.length > 1 ? (
        <Field label="Escritório">
          <select name="orgId" className={inputClass}>{orgs.map((o) => <option key={o.org_id} value={o.org_id}>{o.org_name}</option>)}</select>
        </Field>
      ) : (
        <input type="hidden" name="orgId" value={orgs[0].org_id} />
      )}
      <Field label="Tipo de negócio">
        <select name="kind" className={inputClass}>{DEAL_KINDS.map((k) => <option key={k} value={k}>{DEAL_KIND_LABEL[k]}</option>)}</select>
      </Field>
      <Field label="O que você quer analisar" hint="Ex.: Apartamento 101 da Rua das Flores, 200">
        <input name="title" required minLength={2} maxLength={200} className={inputClass} />
      </Field>
      <Field label="Valor do negócio" hint="Opcional">
        <CurrencyInput name="price" />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Informações para a equipe" hint="Quem vende, quem compra, matrícula, cartório… o que você souber.">
          <textarea name="notes" rows={3} maxLength={5000} className={inputClass} />
        </Field>
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton pendingText="Enviando…">Abrir solicitação</SubmitButton>
        <FormMessage error={state.error} info={state.ok ? "Solicitação aberta. A equipe vai qualificar as partes e iniciar a consulta." : undefined} />
      </div>
    </form>
  );
}
