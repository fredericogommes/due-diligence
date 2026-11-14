"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { FormMessage } from "@/components/ui";
import { STAGE_LABEL, STAGES, type Aging, type Stage, type TaskOwner } from "@/lib/board";
import { AgingBadge, OwnerBadge } from "@/app/gestao/badges";
import { DEAL_KIND_LABEL, formatBRL, type DealKind } from "@/lib/domain";
import { assignDeal, moveDeal } from "./actions";

export type Card = {
  id: string;
  title: string;
  kind: DealKind;
  price: string | number | null;
  stage: Stage;
  orgName: string | null;
  clientName: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  owner: TaskOwner;
  aging: Aging;
  openFindings: number;
  staff: { id: string; name: string }[];
  updatedAt: string;
};

type Filter = "todos" | "humano" | "ia" | "cliente" | "meus" | "atrasados";

export function Kanban({ cards: initial, me }: { cards: Card[]; me: string }) {
  const [cards, setCards] = useState(initial);
  const [filter, setFilter] = useState<Filter>("todos");
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();

  const visible = useMemo(
    () =>
      cards.filter((c) =>
        filter === "todos" ? true : filter === "meus" ? c.assigneeId === me : filter === "atrasados" ? c.aging.state === "atrasado" : c.owner.who === filter,
      ),
    [cards, filter, me],
  );
  const counts = {
    humano: cards.filter((c) => c.owner.who === "humano").length,
    ia: cards.filter((c) => c.owner.who === "ia").length,
    cliente: cards.filter((c) => c.owner.who === "cliente").length,
    meus: cards.filter((c) => c.assigneeId === me).length,
    atrasados: cards.filter((c) => c.aging.state === "atrasado").length,
  };

  const move = (id: string, stage: Stage) => {
    const card = cards.find((c) => c.id === id);
    if (!card || card.stage === stage) return;
    const before = cards;
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, stage } : c)));
    start(async () => {
      const r = await moveDeal(id, stage);
      if (r.error) {
        setCards(before);
        setError(r.error);
      } else setError(undefined);
    });
  };

  const assign = (id: string, userId: string | null) => {
    const before = cards;
    setCards((cs) =>
      cs.map((c) => (c.id === id ? { ...c, assigneeId: userId, assigneeName: c.staff.find((s) => s.id === userId)?.name ?? null } : c)),
    );
    start(async () => {
      const r = await assignDeal(id, userId);
      if (r.error) {
        setCards(before);
        setError(r.error);
      } else setError(undefined);
    });
  };

  const filterButton = (f: Filter, label: string) => (
    <button
      key={f}
      type="button"
      onClick={() => setFilter(f)}
      aria-pressed={filter === f}
      className={`rounded-full border px-3 py-1 text-xs ${filter === f ? "border-brand bg-brand text-white" : "border-line bg-surface hover:bg-muted"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar">
        {filterButton("todos", `Todos (${cards.length})`)}
        {filterButton("humano", `Precisa de humano (${counts.humano})`)}
        {filterButton("ia", `Com a IA (${counts.ia})`)}
        {filterButton("cliente", `Com o cliente (${counts.cliente})`)}
        {filterButton("meus", `Meus (${counts.meus})`)}
        {filterButton("atrasados", `Atrasados (${counts.atrasados})`)}
        {pending && <span className="text-xs text-subtle">Salvando…</span>}
      </div>
      <FormMessage error={error} />

      <div className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-3 xl:mx-0 xl:px-0">
        {STAGES.map((stage) => {
          const col = visible.filter((c) => c.stage === stage);
          return (
            <section
              key={stage}
              aria-label={STAGE_LABEL[stage]}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(stage);
              }}
              onDragLeave={() => setOver((o) => (o === stage ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const id = e.dataTransfer.getData("text/plain") || dragging;
                if (id) move(id, stage);
                setDragging(null);
              }}
              className={`flex min-h-64 w-72 shrink-0 snap-start flex-col rounded-xl border bg-muted/50 p-2 transition-colors xl:w-auto xl:min-w-0 xl:flex-1 xl:shrink ${over === stage ? "border-brand bg-brand/5" : "border-line"}`}
            >
              <h2 className="mb-2 flex items-center justify-between px-1 text-sm font-semibold text-ink">
                {STAGE_LABEL[stage]}
                <span className="rounded-full bg-surface px-2 text-xs font-normal text-subtle">{col.length}</span>
              </h2>
              <ol className="flex flex-1 flex-col gap-2">
                {col.map((c) => (
                  <li
                    key={c.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", c.id);
                      setDragging(c.id);
                    }}
                    onDragEnd={() => setDragging(null)}
                    className={`relative cursor-grab space-y-2 rounded-lg border border-line bg-surface p-3 text-sm shadow-sm ${dragging === c.id ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/negocios/${c.id}`} className="min-w-0 break-words font-medium text-ink hover:text-brand hover:underline">
                        {c.title}
                      </Link>
                      <OwnerBadge owner={c.owner} />
                    </div>
                    <p className="text-xs text-subtle">
                      {DEAL_KIND_LABEL[c.kind]}
                      {c.price ? ` · ${formatBRL(c.price)}` : ""}
                      {c.orgName ? ` · ${c.orgName}` : ""}
                    </p>
                    {c.clientName && <p className="text-xs">Cliente: {c.clientName}</p>}
                    <p className="text-xs text-text">{c.owner.reason}</p>
                    <AgingBadge aging={c.aging} />
                    {c.openFindings > 0 && <p className="text-xs text-danger">{c.openFindings} apontamento(s) em aberto</p>}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line pt-2">
                      <select
                        aria-label={`Responsável por ${c.title}`}
                        value={c.assigneeId ?? ""}
                        onChange={(e) => assign(c.id, e.target.value || null)}
                        className="min-w-32 flex-1 rounded-md border border-line bg-surface px-1.5 py-1 text-xs"
                      >
                        <option value="">Sem responsável</option>
                        {c.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      {c.assigneeId !== me && c.staff.some((s) => s.id === me) && (
                        <button type="button" onClick={() => assign(c.id, me)} className="text-xs font-semibold text-brand hover:underline">
                          Assumir
                        </button>
                      )}
                    </div>
                    <label className="sr-only" htmlFor={`stage-${c.id}`}>Etapa de {c.title}</label>
                    <select
                      id={`stage-${c.id}`}
                      value={c.stage}
                      onChange={(e) => move(c.id, e.target.value as Stage)}
                      className="w-full rounded-md border border-line bg-surface px-1.5 py-1 text-xs xl:hidden"
                    >
                      {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
                    </select>
                  </li>
                ))}
                {col.length === 0 && <li className="px-1 text-xs text-subtle">Nenhum negócio.</li>}
              </ol>
            </section>
          );
        })}
      </div>
    </div>
  );
}
