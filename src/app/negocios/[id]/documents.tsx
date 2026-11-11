"use client";

import { useState, useTransition } from "react";
import { Field, inputClass } from "@/components/ui";
import type { DocView } from "@/lib/checklist/build";
import { VALIDITY_LABEL, type ValidityState } from "@/lib/checklist/validity";
import {
  ALLOWED_MIME, buildStoragePath, DOC_RESULT_LABEL, DOC_RESULTS, DOCUMENTS_BUCKET, formatBytes, isAllowedMime,
  MAX_DOCUMENT_BYTES, type DocResult,
} from "@/lib/documents";
import { formatDate } from "@/lib/domain";
import { createClient } from "@/lib/supabase/client";
import { deleteDocument, getDocumentUrl, getUploadFolder, registerDocument, updateDocument } from "../document-actions";

export type ItemOption = { id: string; label: string };

export const VALIDITY_STYLE: Record<ValidityState, string> = {
  valida: "bg-ok/15 text-ok",
  a_vencer: "bg-warn/15 text-warn",
  vencida: "bg-danger/10 text-danger",
  sem_data: "bg-muted text-subtle",
};

export function ValidityBadge({ doc }: { doc: DocView }) {
  const v = doc.validity;
  const detail =
    v.until && v.daysLeft !== null
      ? v.daysLeft < 0
        ? `venceu em ${formatDate(v.until)}`
        : `até ${formatDate(v.until)}${v.basis === "referencia" ? " (prazo de referência)" : ""}`
      : "informe emissão ou validade";
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${VALIDITY_STYLE[v.state]}`} title={detail}>
      {VALIDITY_LABEL[v.state]}
      {v.until && <span className="font-normal"> · {detail}</span>}
    </span>
  );
}

async function sha256Hex(file: File): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

type Meta = { docType: string; issuer: string; issuedAt: string; expiresAt: string; result: DocResult; notes: string };
const emptyMeta: Meta = { docType: "", issuer: "", issuedAt: "", expiresAt: "", result: "indeterminado", notes: "" };

function MetaFields({ meta, onChange }: { meta: Meta; onChange: (m: Meta) => void }) {
  const set = (k: keyof Meta) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange({ ...meta, [k]: e.target.value });
  return (
    <>
      <Field label="Tipo de documento"><input value={meta.docType} onChange={set("docType")} maxLength={200} className={inputClass} placeholder="Certidão de ônus reais" /></Field>
      <Field label="Emissor"><input value={meta.issuer} onChange={set("issuer")} maxLength={200} className={inputClass} placeholder="2º RI de Volta Redonda" /></Field>
      <Field label="Emitido em"><input type="date" value={meta.issuedAt} onChange={set("issuedAt")} className={inputClass} /></Field>
      <Field label="Válido até" hint="Se impresso no documento"><input type="date" value={meta.expiresAt} onChange={set("expiresAt")} className={inputClass} /></Field>
      <Field label="Resultado">
        <select value={meta.result} onChange={set("result")} className={inputClass}>
          {DOC_RESULTS.map((r) => <option key={r} value={r}>{DOC_RESULT_LABEL[r]}</option>)}
        </select>
      </Field>
      <Field label="Observação"><input value={meta.notes} onChange={set("notes")} maxLength={2000} className={inputClass} /></Field>
    </>
  );
}

/** Envia o arquivo direto ao Storage (pasta do negócio) e registra os metadados. */
export function DocumentUploader({ dealId, itemId, onDone }: { dealId: string; itemId?: string; onDone?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<Meta>(emptyMeta);
  const [error, setError] = useState<string>();
  const [step, setStep] = useState<string>();
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      setError(undefined);
      if (!file) return setError("Escolha um arquivo.");
      if (!isAllowedMime(file.type)) return setError("Use PDF, JPG, PNG ou WEBP.");
      if (file.size > MAX_DOCUMENT_BYTES) return setError("Arquivo maior que 20 MB.");

      setStep("Preparando…");
      const folder = await getUploadFolder(dealId);
      if (folder.error || !folder.orgId) return setError(folder.error ?? "Negócio não encontrado.");
      const path = buildStoragePath(folder.orgId, dealId, crypto.randomUUID(), file.name);
      const sha256 = await sha256Hex(file);

      setStep("Enviando arquivo…");
      const { error: upErr } = await createClient().storage.from(DOCUMENTS_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) {
        setStep(undefined);
        return setError("Falha no envio do arquivo. Verifique a conexão e tente de novo.");
      }

      setStep("Registrando…");
      const r = await registerDocument({
        dealId, dealItemId: itemId ?? "", path, fileName: file.name, mimeType: file.type, sizeBytes: file.size, sha256, ...meta,
      });
      setStep(undefined);
      if (r.error) return setError(r.error);
      setFile(null);
      setMeta(emptyMeta);
      onDone?.();
    });

  return (
    <div className="mt-2 grid gap-3 rounded-lg border border-dashed border-line bg-muted/40 p-3 sm:grid-cols-2">
      <Field label="Arquivo" hint="PDF, JPG, PNG ou WEBP, até 20 MB">
        <input
          type="file"
          accept={ALLOWED_MIME.join(",")}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
        />
      </Field>
      <MetaFields meta={meta} onChange={setMeta} />
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="button" onClick={submit} disabled={pending || !file}
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-60">
          {pending ? step ?? "Enviando…" : "Anexar documento"}
        </button>
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      </div>
    </div>
  );
}

/** Lista de documentos com abrir, editar (metadados e item) e apagar. */
export function DocumentList({ dealId, docs, itemOptions, extra }: {
  dealId: string;
  docs: DocView[];
  itemOptions?: ItemOption[];
  extra?: (doc: DocView) => React.ReactNode;
}) {
  if (!docs.length) return null;
  return (
    <ul className="mt-2 space-y-2">
      {docs.map((d) => <DocumentRowView key={d.id} dealId={dealId} doc={d} itemOptions={itemOptions} extra={extra?.(d)} />)}
    </ul>
  );
}

function DocumentRowView({ dealId, doc, itemOptions, extra }: { dealId: string; doc: DocView; itemOptions?: ItemOption[]; extra?: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  const [meta, setMeta] = useState<Meta>({
    docType: doc.doc_type ?? "", issuer: doc.issuer ?? "", issuedAt: doc.issued_at ?? "", expiresAt: doc.expires_at ?? "",
    result: doc.result, notes: doc.notes ?? "",
  });
  const [itemId, setItemId] = useState(doc.deal_item_id ?? "");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const open = () =>
    start(async () => {
      const r = await getDocumentUrl(doc.id);
      if (r.url) window.open(r.url, "_blank", "noopener,noreferrer");
      else setError(r.error);
    });

  return (
    <li className="rounded-md border border-line bg-surface p-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={open} disabled={pending} className="font-semibold text-brand hover:underline" title="Abrir arquivo">
          📄 {doc.file_name}
        </button>
        <span className="text-subtle">{formatBytes(doc.size_bytes)}</span>
        {doc.doc_type && <span>· {doc.doc_type}</span>}
        {doc.issued_at && <span className="text-subtle">· emitido em {formatDate(doc.issued_at)}</span>}
        <span className="text-subtle">· {DOC_RESULT_LABEL[doc.result]}</span>
        <ValidityBadge doc={doc} />
        <span className="ml-auto flex gap-3">
          <button type="button" className="text-brand hover:underline" onClick={() => setEditing((e) => !e)}>{editing ? "Fechar" : "Editar"}</button>
          <button type="button" className="text-danger hover:underline" disabled={pending}
            onClick={() => {
              if (!confirm(`Apagar ${doc.file_name}? O arquivo será removido.`)) return;
              start(async () => setError((await deleteDocument(dealId, doc.id)).error));
            }}>
            Apagar
          </button>
        </span>
      </div>
      {extra}
      {editing && (
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {itemOptions && (
            <Field label="Item do checklist">
              <select value={itemId} onChange={(e) => setItemId(e.target.value)} className={inputClass}>
                <option value="">Fora do checklist</option>
                {itemOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </Field>
          )}
          <MetaFields meta={meta} onChange={setMeta} />
          <div className="sm:col-span-2">
            <button type="button" disabled={pending}
              className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-strong disabled:opacity-60"
              onClick={() =>
                start(async () => {
                  const r = await updateDocument(dealId, doc.id, { ...meta, dealItemId: itemOptions ? itemId : doc.deal_item_id ?? "" });
                  setError(r.error);
                  if (!r.error) setEditing(false);
                })
              }>
              Salvar
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-1 text-danger" role="alert">{error}</p>}
    </li>
  );
}
