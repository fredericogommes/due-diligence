import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoadingSkeleton } from "@/components/ui";
import { AppHeader } from "@/components/app-header";
import { STAGE_LABEL, type BoardRow } from "@/lib/board";
import { formatBRL, formatCompactBRL } from "@/lib/domain";
import { attention, byStage, createdPerWeek, enrich, kpis, workload } from "@/lib/gestao";
import type { MemberView } from "@/lib/members";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";
import { AgingBadge, OwnerBadge } from "./badges";
import { OrdersTable, type OrderRow } from "./orders-table";

export const metadata: Metadata = { title: "Gestão · Due Diligence" };

/** Relógio do servidor, fora do render (o lint de pureza não aceita Date no corpo do componente). */
function nowIso(): string {
  return new Date().toISOString();
}

export default function ManagementPage() {
  return (
    <>
      <AppHeader current="gestao" />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 lg:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Gestão</h1>
            <p className="text-sm text-subtle">Visão dos pedidos: andamento, prazos, gargalos e carga da equipe.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/painel" className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium hover:bg-muted">Abrir quadro</Link>
            <Link href="/negocios/novo" className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-strong">Novo pedido</Link>
          </div>
        </div>
        <Suspense fallback={<div className="mt-4"><LoadingSkeleton /></div>}>
          <Dashboard />
        </Suspense>
      </main>
    </>
  );
}

function Kpi({ label, value, hint, tone = "default" }: { label: string; value: string; hint?: string; tone?: "default" | "danger" | "warn" }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs font-medium text-subtle">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums tracking-tight ${tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : "text-ink"}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-subtle">{hint}</p>}
    </div>
  );
}

function Panel({ title, action, children, className = "" }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-line bg-surface ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

async function Dashboard() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");
  const supabase = await createClient();
  const [{ data: rows }, { data: orgs }] = await Promise.all([
    supabase.from("deal_board").select("*").returns<BoardRow[]>(),
    supabase.from("organizations").select("id, name").returns<{ id: string; name: string }[]>(),
  ]);
  if (!orgs?.length) redirect("/minhas-solicitacoes");

  const members = new Map<string, MemberView>();
  await Promise.all(
    orgs.map(async (o) => {
      const { data } = await supabase.rpc("org_members", { p_org: o.id });
      for (const m of (data as MemberView[] | null) ?? []) members.set(m.user_id, m);
    }),
  );
  const name = (uid: string | null) => (uid ? (members.get(uid)?.full_name ?? members.get(uid)?.email ?? "ex-membro") : null);

  const now = nowIso();
  const orders = enrich(rows ?? [], now);
  const k = kpis(orders);
  const stages = byStage(orders);
  const weeks = createdPerWeek(orders, now);
  const load = workload(orders);
  const urgent = attention(orders);
  const maxStage = Math.max(1, ...stages.map((s) => s.count));
  const maxWeek = Math.max(1, ...weeks.map((w) => w.count));

  const tableRows: OrderRow[] = orders.map((o) => ({
    id: o.id,
    title: o.title,
    kind: o.kind,
    price: o.price,
    stage: o.stage,
    clientName: name(o.client_id),
    assigneeName: name(o.assignee_id),
    owner: o.owner,
    aging: o.aging,
    openFindings: o.open_findings,
    createdAt: o.created_at,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Pedidos ativos" value={String(k.active)} hint={`${k.done} concluídos`} />
        <Kpi label="Precisam de humano" value={String(k.needHuman)} tone={k.needHuman ? "warn" : "default"} />
        <Kpi label="Fora do prazo" value={String(k.overdue)} tone={k.overdue ? "danger" : "default"} hint="tempo na etapa acima do prazo" />
        <Kpi label="Aguardando cliente" value={String(k.withClient)} hint="decisão ou boleto" />
        <Kpi label="Riscos altos/críticos" value={String(k.seriousRisks)} tone={k.seriousRisks ? "danger" : "default"} hint="em pedidos ativos" />
        <Kpi label="Valor em análise" value={formatCompactBRL(k.activeValue)} hint={formatBRL(k.activeValue)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Pedidos por etapa" action={<span className="text-xs text-subtle">prazo-alvo por etapa</span>}>
          <ul className="space-y-3">
            {stages.map((s) => (
              <li key={s.stage} className="grid grid-cols-[8.5rem_1fr_2rem] items-center gap-3 text-sm" title={`${STAGE_LABEL[s.stage]}: ${s.count} pedido(s), ${s.overdue} fora do prazo`}>
                <span className="truncate text-text">{STAGE_LABEL[s.stage]}</span>
                <span className="flex h-2.5 overflow-hidden rounded-full bg-muted">
                  <span className="rounded-full bg-brand" style={{ width: `${((s.count - s.overdue) / maxStage) * 100}%` }} />
                  {s.overdue > 0 && <span className="ml-0.5 rounded-full bg-danger" style={{ width: `${(s.overdue / maxStage) * 100}%` }} />}
                </span>
                <span className="text-right tabular-nums text-ink">{s.count}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex gap-4 text-xs text-subtle">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand" />no prazo</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-danger" />fora do prazo</span>
          </p>
        </Panel>

        <Panel title="Novos pedidos por semana" action={<span className="text-xs text-subtle">últimas 8 semanas</span>}>
          <div className="flex h-40 items-end gap-2" role="img" aria-label={`Novos pedidos por semana: ${weeks.map((w) => w.count).join(", ")}`}>
            {weeks.map((w) => (
              <div key={w.week} className="group flex h-full flex-1 flex-col items-center justify-end gap-1" title={`Semana de ${w.week.split("-").reverse().join("/")}: ${w.count}`}>
                <span className="text-[11px] tabular-nums text-subtle opacity-0 group-hover:opacity-100">{w.count}</span>
                <span className="w-full max-w-8 rounded-t bg-brand/80 group-hover:bg-brand" style={{ height: `${Math.max(w.count ? 4 : 1, (w.count / maxWeek) * 100)}%` }} />
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2 text-[10px] text-subtle">
            {weeks.map((w) => <span key={w.week} className="flex-1 text-center tabular-nums">{w.week.slice(8, 10)}/{w.week.slice(5, 7)}</span>)}
          </div>
        </Panel>

        <Panel title="Carga da equipe" action={<span className="text-xs text-subtle">pedidos ativos</span>}>
          {load.length === 0 ? (
            <p className="text-sm text-subtle">Nenhum pedido ativo.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-subtle">
                <tr><th className="pb-2 font-medium">Responsável</th><th className="pb-2 text-right font-medium">Ativos</th><th className="pb-2 text-right font-medium">Humano</th><th className="pb-2 text-right font-medium">Atrasados</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {load.map((w) => (
                  <tr key={w.assigneeId ?? "none"}>
                    <td className={`py-2 ${w.assigneeId ? "text-text" : "italic text-subtle"}`}>{name(w.assigneeId) ?? "Sem responsável"}</td>
                    <td className="py-2 text-right tabular-nums">{w.active}</td>
                    <td className="py-2 text-right tabular-nums">{w.needHuman}</td>
                    <td className={`py-2 text-right tabular-nums ${w.overdue ? "font-semibold text-danger" : ""}`}>{w.overdue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      <Panel title="Precisa de atenção agora" action={<Link href="/painel" className="text-xs font-medium text-brand hover:underline">ver quadro</Link>}>
        {urgent.length === 0 ? (
          <p className="text-sm text-subtle">Nada parado nem esperando a equipe.</p>
        ) : (
          <ul className="divide-y divide-line">
            {urgent.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <Link href={`/negocios/${o.id}`} className="font-medium text-ink hover:text-brand hover:underline">{o.title}</Link>
                  <p className="text-xs text-subtle">{STAGE_LABEL[o.stage]} · {o.owner.reason}{o.assignee_id ? ` · ${name(o.assignee_id)}` : " · sem responsável"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <OwnerBadge owner={o.owner} />
                  <AgingBadge aging={o.aging} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <OrdersTable rows={tableRows} />
    </div>
  );
}
