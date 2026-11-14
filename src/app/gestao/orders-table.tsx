"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { OWNER_LABEL, STAGE_LABEL, STAGES, type Aging, type Stage, type TaskOwner } from "@/lib/board";
import { DEAL_KIND_LABEL, formatBRL, formatDate, type DealKind } from "@/lib/domain";
import { AgingBadge, OwnerBadge } from "./badges";

export type OrderRow = {
  id: string;
  title: string;
  kind: DealKind;
  price: string | number | null;
  stage: Stage;
  clientName: string | null;
  assigneeName: string | null;
  owner: TaskOwner;
  aging: Aging;
  openFindings: number;
  createdAt: string;
};

type SortKey = "createdAt" | "aging" | "price" | "title";
const PAGE = 12;

const selectClass = "rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-text";

/** Todos os pedidos (inclusive os concluídos), com busca, filtros, ordenação e paginação. */
export function OrdersTable({ rows }: { rows: OrderRow[] }) {
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<"" | Stage>("");
  const [owner, setOwner] = useState<"" | TaskOwner["who"]>("");
  const [onlyLate, setOnlyLate] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "createdAt", dir: -1 });
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const out = rows.filter(
      (r) =>
        (!term || `${r.title} ${r.clientName ?? ""} ${r.assigneeName ?? ""}`.toLowerCase().includes(term)) &&
        (!stage || r.stage === stage) &&
        (!owner || r.owner.who === owner) &&
        (!onlyLate || r.aging.state === "atrasado"),
    );
    const val = (r: OrderRow): string | number =>
      sort.key === "createdAt" ? r.createdAt : sort.key === "aging" ? r.aging.days : sort.key === "price" ? Number(r.price) || 0 : r.title.toLowerCase();
    return out.sort((a, b) => (val(a) < val(b) ? -1 : val(a) > val(b) ? 1 : 0) * sort.dir);
  }, [rows, q, stage, owner, onlyLate, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * PAGE, current * PAGE + PAGE);
  const reset = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setPage(0);
  };

  const header = (key: SortKey, label: string, align = "text-left") => (
    <th className={`px-4 py-2.5 font-medium ${align}`} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" className="inline-flex items-center gap-1 hover:text-ink" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : -1 }))}>
        {label}
        <span aria-hidden className="text-[10px]">{sort.key === key ? (sort.dir === 1 ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );

  return (
    <section className="rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
        <h2 className="mr-auto text-sm font-semibold text-ink">Todos os pedidos <span className="font-normal text-subtle">({filtered.length})</span></h2>
        <input
          type="search"
          value={q}
          onChange={(e) => reset(setQ)(e.target.value)}
          placeholder="Buscar pedido, cliente ou responsável"
          aria-label="Buscar"
          className={`${selectClass} w-full sm:w-64`}
        />
        <select aria-label="Etapa" value={stage} onChange={(e) => reset(setStage)(e.target.value as "" | Stage)} className={selectClass}>
          <option value="">Todas as etapas</option>
          {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
        </select>
        <select aria-label="Com quem está" value={owner} onChange={(e) => reset(setOwner)(e.target.value as "" | TaskOwner["who"])} className={selectClass}>
          <option value="">Com qualquer um</option>
          {(["humano", "ia", "cliente", "ninguem"] as const).map((w) => <option key={w} value={w}>{w === "ninguem" ? "Concluídos" : `Com ${OWNER_LABEL[w] === "IA" ? "a IA" : OWNER_LABEL[w].toLowerCase()}`}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={onlyLate} onChange={(e) => reset(setOnlyLate)(e.target.checked)} className="accent-[var(--brand)]" />
          Só atrasados
        </label>
      </div>

      {/* Celular: cartões. */}
      <ul className="divide-y divide-line md:hidden">
        {visible.map((r) => (
          <li key={r.id} className="space-y-1.5 px-5 py-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/negocios/${r.id}`} className="min-w-0 font-medium text-ink hover:text-brand">{r.title}</Link>
              <OwnerBadge owner={r.owner} />
            </div>
            <p className="text-xs text-subtle">{STAGE_LABEL[r.stage]} · {formatBRL(r.price)} · {r.clientName ?? "sem cliente"}</p>
            <p className="flex justify-between text-xs"><span className="text-subtle">{r.assigneeName ?? "Sem responsável"}</span><AgingBadge aging={r.aging} /></p>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs text-subtle">
            <tr>
              {header("title", "Pedido")}
              <th className="px-4 py-2.5 text-left font-medium">Cliente</th>
              <th className="px-4 py-2.5 text-left font-medium">Etapa</th>
              <th className="px-4 py-2.5 text-left font-medium">Com quem está</th>
              <th className="px-4 py-2.5 text-left font-medium">Responsável</th>
              {header("aging", "Na etapa")}
              {header("price", "Valor", "text-right")}
              {header("createdAt", "Criado em")}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.map((r) => (
              <tr key={r.id} className="align-top hover:bg-muted/40">
                <td className="min-w-56 px-4 py-3">
                  <Link href={`/negocios/${r.id}`} className="font-medium text-ink hover:text-brand hover:underline">{r.title}</Link>
                  <p className="text-xs text-subtle">{DEAL_KIND_LABEL[r.kind]}{r.openFindings ? ` · ${r.openFindings} apontamento(s)` : ""}</p>
                </td>
                <td className="px-4 py-3 text-text">{r.clientName ?? <span className="text-subtle">—</span>}</td>
                <td className="whitespace-nowrap px-4 py-3 text-text">{STAGE_LABEL[r.stage]}</td>
                <td className="max-w-60 px-4 py-3">
                  <OwnerBadge owner={r.owner} />
                  <p className="mt-1 text-xs text-subtle">{r.owner.reason}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-text">{r.assigneeName ?? <span className="text-subtle">—</span>}</td>
                <td className="px-4 py-3"><AgingBadge aging={r.aging} /></td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatBRL(r.price)}</td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-subtle">{formatDate(r.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {visible.length === 0 && <p className="px-5 py-8 text-center text-sm text-subtle">Nenhum pedido com esses filtros.</p>}

      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-line px-5 py-3 text-sm">
          <span className="text-subtle">Página {current + 1} de {pages}</span>
          <div className="flex gap-2">
            <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)} className="rounded-lg border border-line px-3 py-1 hover:bg-muted disabled:opacity-40">Anterior</button>
            <button type="button" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="rounded-lg border border-line px-3 py-1 hover:bg-muted disabled:opacity-40">Próxima</button>
          </div>
        </div>
      )}
    </section>
  );
}
