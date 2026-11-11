"use client";

import { useActionState } from "react";
import { Field, FormMessage, inputClass, SubmitButton } from "@/components/ui";
import { CONCLUSION_LABEL, type Conclusion } from "@/lib/report/build";
import { saveOpinion, type OpinionState } from "./actions";

export type OpinionData = {
  conclusion: Conclusion | null;
  opinion: string | null;
  signer_name: string | null;
  signer_registration: string | null;
};

/** Edição do parecer (só na tela; não sai na impressão). */
export function OpinionEditor({ dealId, suggested, opinion }: { dealId: string; suggested: Conclusion; opinion: OpinionData | null }) {
  const [state, action] = useActionState<OpinionState, FormData>(saveOpinion, {});
  return (
    <form action={action} className="grid gap-3 rounded-xl border border-line bg-surface p-5 print:hidden sm:grid-cols-2">
      <input type="hidden" name="dealId" value={dealId} />
      <div className="sm:col-span-2">
        <h2 className="text-lg font-semibold text-ink">Parecer do responsável</h2>
        <p className="text-sm text-subtle">
          Conclusão sugerida pelas regras: <strong>{CONCLUSION_LABEL[suggested]}</strong>. Você pode mantê-la ou definir outra.
          O texto abaixo entra no relatório antes da conclusão.
        </p>
      </div>
      <Field label="Conclusão">
        <select name="conclusion" defaultValue={opinion?.conclusion ?? ""} className={inputClass}>
          <option value="">Usar a sugerida ({CONCLUSION_LABEL[suggested]})</option>
          {(Object.keys(CONCLUSION_LABEL) as Conclusion[]).map((c) => <option key={c} value={c}>{CONCLUSION_LABEL[c]}</option>)}
        </select>
      </Field>
      <div />
      <div className="sm:col-span-2">
        <Field label="Parecer" hint="Análise do advogado/corretor: contexto, riscos e condições recomendadas.">
          <textarea name="opinion" rows={6} maxLength={20000} defaultValue={opinion?.opinion ?? ""} className={inputClass} />
        </Field>
      </div>
      <Field label="Responsável técnico"><input name="signerName" maxLength={200} defaultValue={opinion?.signer_name ?? ""} className={inputClass} /></Field>
      <Field label="Registro (OAB/CRECI)"><input name="signerRegistration" maxLength={100} defaultValue={opinion?.signer_registration ?? ""} className={inputClass} placeholder="OAB/RJ 000.000" /></Field>
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton>Salvar parecer</SubmitButton>
        <FormMessage error={state.error} info={state.ok ? "Parecer salvo." : undefined} />
      </div>
    </form>
  );
}
