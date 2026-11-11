"use client";

import { useState, useTransition } from "react";
import { formatDate } from "@/lib/domain";
import { pollCertificate, requestCertificate } from "../certificate-actions";

export type CertOption = { id: string; name: string; available: boolean; reason: string | null; missing: string[] };
export type CertRequestView = { id: string; provider: string; status: "pendente" | "concluido" | "erro"; protocol: string | null; error: string | null; created_at: string };
export type CertInfo = { options: CertOption[]; requests: CertRequestView[] };

const STATUS_LABEL = { pendente: "Em andamento", concluido: "Recebida", erro: "Falhou" } as const;

/** Pedir a certidão do item a um provedor e acompanhar os pedidos. */
export function CertificateRequest({ dealId, itemId, info }: { dealId: string; itemId: string; info: CertInfo }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; message?: string }>({});
  if (!info.options.length && !info.requests.length) return null;

  return (
    <div className="mt-1">
      <button type="button" className="text-xs font-semibold text-brand hover:underline" onClick={() => setOpen((o) => !o)}>
        {open ? "Fechar pedidos de certidão" : `Pedir certidão online${info.requests.length ? ` (${info.requests.length})` : ""}`}
      </button>
      {open && (
        <div className="mt-2 space-y-2 rounded-md border border-line p-2 text-xs">
          {info.options.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={pending || !o.available || o.missing.length > 0}
                onClick={() =>
                  start(async () => {
                    const r = await requestCertificate(dealId, itemId, o.id);
                    setMsg({ error: r.error, message: r.message });
                  })
                }
                className="rounded border border-brand/40 px-2 py-1 font-semibold text-brand hover:bg-brand/10 disabled:opacity-50"
              >
                {pending ? "Pedindo…" : `Pedir via ${o.name}`}
              </button>
              {!o.available && <span className="text-subtle">{o.reason}</span>}
              {o.available && o.missing.length > 0 && <span className="text-warn">Falta cadastrar: {o.missing.join(", ")}.</span>}
            </div>
          ))}
          {info.requests.length > 0 && (
            <ul className="space-y-1 border-t border-line pt-2">
              {info.requests.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2">
                  <span>{formatDate(r.created_at)} · {r.provider} · <strong>{STATUS_LABEL[r.status]}</strong></span>
                  {r.protocol && <span className="text-subtle">protocolo {r.protocol}</span>}
                  {r.error && <span className="text-danger">{r.error}</span>}
                  {r.status === "pendente" && (
                    <button type="button" disabled={pending} className="text-brand underline"
                      onClick={() => start(async () => {
                        const res = await pollCertificate(dealId, r.id);
                        setMsg({ error: res.error, message: res.message });
                      })}>
                      consultar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {msg.error && <p className="text-danger" role="alert">{msg.error}</p>}
          {msg.message && <p className="text-ok" role="status">{msg.message}</p>}
        </div>
      )}
    </div>
  );
}
