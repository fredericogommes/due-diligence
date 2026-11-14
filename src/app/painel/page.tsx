import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoadingSkeleton } from "@/components/ui";
import { AppHeader } from "@/components/app-header";
import { stageAging, taskOwner, type BoardRow } from "@/lib/board";
import type { MemberView } from "@/lib/members";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";
import { Kanban, type Card } from "./kanban";

export const metadata: Metadata = { title: "Painel · Due Diligence" };

function nowIso(): string {
  return new Date().toISOString();
}

export default function BoardPage() {
  return (
    <>
      <AppHeader current="painel" />
      <main className="w-full flex-1 px-4 py-8 lg:px-8">
        <div className="mx-auto mb-6 max-w-[1600px]">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Quadro de pedidos</h1>
          <p className="text-sm text-subtle">
            Cada coluna é uma etapa. O selo mostra com quem está a tarefa agora: IA, humano ou cliente. Arraste um cartão para mudar a etapa.
          </p>
        </div>
        <Suspense fallback={<div className="mt-4"><LoadingSkeleton /></div>}>
          <Board />
        </Suspense>
      </main>
    </>
  );
}

async function Board() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");
  const supabase = await createClient();
  const [{ data: rows }, { data: orgs }] = await Promise.all([
    supabase.from("deal_board").select("*").order("updated_at", { ascending: false }).returns<BoardRow[]>(),
    supabase.from("organizations").select("id, name").returns<{ id: string; name: string }[]>(),
  ]);
  if (!orgs?.length) redirect("/minhas-solicitacoes");

  const members = new Map<string, MemberView[]>();
  await Promise.all(
    orgs.map(async (o) => {
      const { data } = await supabase.rpc("org_members", { p_org: o.id });
      members.set(o.id, (data as MemberView[] | null) ?? []);
    }),
  );
  const nameOf = (orgId: string, uid: string | null) => {
    if (!uid) return null;
    const m = members.get(orgId)?.find((x) => x.user_id === uid);
    return m ? (m.full_name ?? m.email) : "ex-membro";
  };

  const now = nowIso();
  const cards: Card[] = (rows ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    kind: r.kind,
    price: r.price,
    stage: r.stage,
    orgName: orgs.length > 1 ? (orgs.find((o) => o.id === r.org_id)?.name ?? null) : null,
    clientName: nameOf(r.org_id, r.client_id),
    assigneeId: r.assignee_id,
    assigneeName: nameOf(r.org_id, r.assignee_id),
    owner: taskOwner(r),
    aging: stageAging(r.stage, r.stage_changed_at, now),
    openFindings: r.open_findings,
    staff: (members.get(r.org_id) ?? [])
      .filter((m) => m.role !== "cliente")
      .map((m) => ({ id: m.user_id, name: m.full_name ?? m.email })),
    updatedAt: r.updated_at,
  }));

  return <Kanban cards={cards} me={userId} />;
}
