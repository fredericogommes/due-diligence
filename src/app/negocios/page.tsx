import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { ButtonLink } from "@/components/ui";
import type { DealProgressRow, DealRow } from "@/lib/db-types";
import { DEAL_KIND_LABEL, DEAL_STATUS_LABEL, formatBRL, formatDate } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import { ProgressBar } from "./progress-bar";

export const metadata: Metadata = { title: "Negócios · Due Diligence" };

export default function DealsPage() {
  return (
    <>
      <AppHeader current="negocios" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-ink">Negócios</h1>
          <ButtonLink href="/negocios/novo">Novo negócio</ButtonLink>
        </div>
        <Suspense fallback={<p className="text-sm text-subtle">Carregando…</p>}>
          <DealList />
        </Suspense>
      </main>
    </>
  );
}

async function DealList() {
  const supabase = await createClient();
  const [{ data: deals, error }, { data: progress }, { data: orgs }] = await Promise.all([
    supabase.from("deals").select("*").order("created_at", { ascending: false }).returns<DealRow[]>(),
    supabase.from("deal_progress").select("*").returns<DealProgressRow[]>(),
    supabase.from("organizations").select("id, name").returns<{ id: string; name: string }[]>(),
  ]);

  if (error) return <p className="text-sm text-danger">Não foi possível carregar os negócios.</p>;
  if (!orgs?.length) {
    return (
      <p className="rounded-xl border border-line bg-surface p-6 text-sm text-subtle">
        Crie uma organização em <Link href="/" className="text-brand underline">Organizações</Link> antes de cadastrar negócios.
      </p>
    );
  }
  if (!deals?.length) {
    return <p className="rounded-xl border border-line bg-surface p-6 text-sm text-subtle">Nenhum negócio cadastrado ainda.</p>;
  }

  const byDeal = new Map((progress ?? []).map((p) => [p.deal_id, p]));
  const orgName = new Map(orgs.map((o) => [o.id, o.name]));

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-muted text-left text-xs uppercase tracking-wide text-subtle">
          <tr>
            <th className="px-4 py-3">Negócio</th>
            <th className="px-4 py-3">Tipo</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Valor</th>
            <th className="px-4 py-3 w-48">Checklist</th>
            <th className="px-4 py-3">Criado em</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {deals.map((d) => (
            <tr key={d.id} className="hover:bg-muted/50">
              <td className="px-4 py-3">
                <Link href={`/negocios/${d.id}`} className="font-semibold text-ink hover:text-brand">{d.title}</Link>
                {orgs.length > 1 && <div className="text-xs text-subtle">{orgName.get(d.org_id)}</div>}
              </td>
              <td className="px-4 py-3">{DEAL_KIND_LABEL[d.kind]}</td>
              <td className="px-4 py-3">{DEAL_STATUS_LABEL[d.status]}</td>
              <td className="px-4 py-3 tabular-nums">{formatBRL(d.price)}</td>
              <td className="px-4 py-3"><ProgressBar progress={byDeal.get(d.id)} /></td>
              <td className="px-4 py-3 tabular-nums">{formatDate(d.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
