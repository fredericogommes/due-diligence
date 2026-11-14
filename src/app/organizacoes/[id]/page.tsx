import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { LoadingSkeleton } from "@/components/ui";
import { AppHeader } from "@/components/app-header";
import { AuditList } from "@/components/audit-list";
import type { AuditRow } from "@/lib/audit";
import { todaySaoPaulo } from "@/lib/checklist/validity";
import { formatDate } from "@/lib/domain";
import { isManager, ROLE_LABEL, type MemberRole, type MemberView } from "@/lib/members";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";
import { InviteForm, InvitationList, MemberList } from "./members";

export const metadata: Metadata = { title: "Organização · Due Diligence" };

export default function OrganizationPage({ params }: PageProps<"/organizacoes/[id]">) {
  return (
    <>
      <AppHeader current="organizacoes" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Link href="/organizacoes" className="text-sm text-subtle hover:text-brand">← Organizações</Link>
        <Suspense fallback={<div className="mt-4"><LoadingSkeleton /></div>}>
          <Organization params={params} />
        </Suspense>
      </main>
    </>
  );
}

type InvitationView = { id: string; email: string; role: MemberRole; created_at: string; expires_at: string };

async function Organization({ params }: { params: PageProps<"/organizacoes/[id]">["params"] }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id, name, cnpj").eq("id", id).maybeSingle<{ id: string; name: string; cnpj: string | null }>();
  if (!org) notFound();

  const [{ data: members }, { data: invitations }, { data: audit }] = await Promise.all([
    supabase.rpc("org_members", { p_org: id }) as unknown as Promise<{ data: MemberView[] | null }>,
    supabase
      .from("invitations")
      .select("id, email, role, created_at, expires_at")
      .eq("org_id", id)
      .is("accepted_at", null)
      .order("created_at")
      .returns<InvitationView[]>(),
    supabase.from("audit_log").select("*").eq("org_id", id).order("created_at", { ascending: false }).limit(100).returns<AuditRow[]>(),
  ]);

  const me = members?.find((m) => m.user_id === userId);
  const myRole = me?.role ?? null;
  const names = Object.fromEntries((members ?? []).map((m) => [m.user_id, m.full_name ?? m.email]));
  const today = todaySaoPaulo();

  return (
    <div className="mt-2 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{org.name}</h1>
        <p className="text-sm text-subtle">Seu papel: {myRole ? ROLE_LABEL[myRole] : "—"}</p>
      </div>

      <section className="rounded-xl border border-line bg-surface p-6">
        <h2 className="mb-4 text-lg font-semibold text-ink">Membros</h2>
        <MemberList orgId={id} me={{ userId, role: myRole ?? "corretor" }} members={members ?? []} />
      </section>

      {isManager(myRole) && (
        <section className="space-y-4 rounded-xl border border-line bg-surface p-6">
          <div>
            <h2 className="text-lg font-semibold text-ink">Convidar</h2>
            <p className="text-sm text-subtle">
              A pessoa entra (ou se cadastra) com o e-mail convidado e aceita o convite na página inicial. O convite vale 14 dias.
              Ninguém entra como dono: depois de entrar, o dono pode promover.
            </p>
          </div>
          <InviteForm orgId={id} />
          <InvitationList
            orgId={id}
            invitations={(invitations ?? []).map((i) => ({
              ...i,
              expired: i.expires_at.slice(0, 10) < today,
              expiresLabel: formatDate(i.expires_at),
            }))}
          />
        </section>
      )}

      {isManager(myRole) && (
        <section className="rounded-xl border border-line bg-surface p-6">
          <h2 className="mb-1 text-lg font-semibold text-ink">Histórico da organização</h2>
          <p className="mb-4 text-sm text-subtle">Últimos 100 registros: quem fez o quê e quando, em membros, negócios e documentos.</p>
          <AuditList rows={audit ?? []} names={names} showDealLink />
        </section>
      )}
    </div>
  );
}
