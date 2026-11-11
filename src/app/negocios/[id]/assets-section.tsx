"use client";

import { useActionState, useState, useTransition } from "react";
import { Field, FormMessage, inputClass, SubmitButton } from "@/components/ui";
import type { AssetRow } from "@/lib/db-types";
import { ASSET_KIND_LABEL, formatDocument, UFS, type AssetKind, type DealKind } from "@/lib/domain";
import { addAsset, deleteAsset, type ActionState } from "../actions";

export function AssetsSection({ dealId, dealKind, assets }: { dealId: string; dealKind: DealKind; assets: AssetRow[] }) {
  const [state, action] = useActionState<ActionState, FormData>(addAsset, {});
  const [kind, setKind] = useState<AssetKind>(dealKind === "cessao_cotas" ? "empresa" : "imovel");
  const [open, setOpen] = useState(assets.length === 0);
  const [pending, start] = useTransition();
  const [removeError, setRemoveError] = useState<string>();
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">Bens</h2>
        <button type="button" className="text-sm text-brand hover:underline" onClick={() => setOpen((o) => !o)}>
          {open ? "Fechar" : "Adicionar bem"}
        </button>
      </div>

      {assets.length === 0 ? (
        <p className="mb-3 text-sm text-subtle">Nenhum bem cadastrado.</p>
      ) : (
        <ul className="mb-3 divide-y divide-line">
          {assets.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-3 py-2 text-sm">
              <div>
                <div className="font-medium">{a.description}</div>
                <div className="text-xs text-subtle">
                  {ASSET_KIND_LABEL[a.kind]}
                  {a.matricula && ` · matrícula ${a.matricula}`}
                  {a.cartorio && ` · ${a.cartorio}`}
                  {a.inscricao_iptu && ` · IPTU ${a.inscricao_iptu}`}
                  {a.cnpj && ` · CNPJ ${formatDocument(a.cnpj)}`}
                  {a.municipio && ` · ${a.municipio}${a.uf ? `/${a.uf}` : ""}`}
                </div>
              </div>
              <button
                type="button"
                disabled={pending}
                className="text-xs text-danger hover:underline"
                onClick={() => {
                  if (!confirm(`Remover ${a.description}? Os itens do checklist desse bem também serão removidos.`)) return;
                  start(async () => setRemoveError((await deleteAsset(dealId, a.id)).error));
                }}
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}
      <FormMessage error={removeError} />

      {open && (
        <form key={state.at ?? 0} action={action} className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
          <input type="hidden" name="dealId" value={dealId} />
          <Field label="Tipo">
            <select name="kind" className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as AssetKind)}>
              <option value="imovel">Imóvel</option>
              <option value="empresa">Empresa</option>
            </select>
          </Field>
          <Field label="Descrição">
            <input name="description" required minLength={2} maxLength={300} className={inputClass}
              placeholder={kind === "imovel" ? "Apto 101, Bloco A" : "AME Clínica Veterinária Ltda."} />
          </Field>
          {kind === "imovel" ? (
            <>
              <Field label="Matrícula"><input name="matricula" maxLength={40} className={inputClass} /></Field>
              <Field label="Cartório de Registro de Imóveis"><input name="cartorio" maxLength={200} className={inputClass} placeholder="2º RI de Volta Redonda" /></Field>
              <Field label="CNS do cartório" hint="6 dígitos, opcional"><input name="cns" inputMode="numeric" maxLength={8} className={inputClass} /></Field>
              <Field label="Inscrição do IPTU"><input name="inscricaoIptu" maxLength={60} className={inputClass} /></Field>
              <Field label="Endereço"><input name="address" maxLength={300} className={inputClass} /></Field>
            </>
          ) : (
            <Field label="CNPJ"><input name="cnpj" inputMode="numeric" className={inputClass} placeholder="00.000.000/0000-00" /></Field>
          )}
          <Field label="Município"><input name="municipio" maxLength={120} className={inputClass} /></Field>
          <Field label="UF">
            <select name="uf" className={inputClass} defaultValue="">
              <option value="">—</option>
              {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-2 space-y-2">
            <FormMessage error={state.error} />
            <SubmitButton pendingText="Adicionando…">Adicionar bem</SubmitButton>
          </div>
        </form>
      )}
    </section>
  );
}
