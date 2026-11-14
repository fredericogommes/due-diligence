import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { AuditList } from "@/components/audit-list";
import type { AuditRow } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Histórico do negócio · Due Diligence" };

export default function DealHistoryPage({ params }: PageProps<"/negocios/[id]/historico">) {
  return (
    <>
      <AppHeader current="negocios" />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <Suspense fallback={<p className="text-sm text-subtle">Carregando…</p>}>
          <History params={params} />
        </Suspense>
      </main>
    </>
  );
}

async function History({ params }: { params: PageProps<"/negocios/[id]/historico">["params"] }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: deal }, { data: rows }, { data: profiles }] = await Promise.all([
    supabase.from("deals").select("id, title").eq("id", id).maybeSingle<{ id: string; title: string }>(),
    supabase.from("audit_log").select("*").eq("deal_id", id).order("created_at", { ascending: false }).limit(500).returns<AuditRow[]>(),
    supabase.from("profiles").select("id, full_name").returns<{ id: string; full_name: string | null }[]>(),
  ]);
  if (!deal && !rows?.length) notFound();
  const names = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name ?? "Sem nome"]));

  return (
    <div className="space-y-6">
      {deal ? (
        <Link href={`/negocios/${id}`} className="text-sm text-subtle hover:text-brand">← Voltar ao negócio</Link>
      ) : (
        <Link href="/negocios" className="text-sm text-subtle hover:text-brand">← Negócios</Link>
      )}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Histórico{deal ? `: ${deal.title}` : " (negócio excluído)"}</h1>
        <p className="text-sm text-subtle">
          Quem fez o quê e quando. O histórico registra quais campos mudaram, mas não guarda os valores (para não duplicar dados pessoais).
        </p>
      </div>
      <section className="rounded-xl border border-line bg-surface p-6">
        <AuditList rows={rows ?? []} names={names} />
      </section>
    </div>
  );
}
