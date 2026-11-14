import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { formatDate } from "@/lib/domain";
import { ROLE_LABEL, type MemberRole } from "@/lib/members";
import { OrgForm } from "./org-form";
import { PendingInvitations } from "./pending-invitations";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";

type InvitationRow = { id: string; org_name: string; role: MemberRole; invited_by_name: string | null; expires_at: string };

type MembershipRow = {
  role: MemberRole;
  organizations: { id: string; name: string; cnpj: string | null } | null;
};

export default function HomePage() {
  return (
    <Suspense fallback={<main className="flex-1 p-8 text-sm text-subtle">Carregando…</main>}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const supabase = await createClient();
  const [{ data: profile }, { data: memberships, error }, { data: invitations }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    supabase
      .from("memberships")
      .select("role, organizations(id, name, cnpj)")
      .eq("user_id", userId)
      .order("created_at")
      .returns<MembershipRow[]>(),
    supabase.rpc("my_invitations") as unknown as Promise<{ data: InvitationRow[] | null }>,
  ]);

  return (
    <>
    <AppHeader current="organizacoes" />
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Organizações</h1>
        <p className="text-sm text-subtle">Olá, {profile?.full_name ?? "bem-vindo"}.</p>
      </div>

      {invitations && invitations.length > 0 && (
        <PendingInvitations
          invitations={invitations.map((i) => ({
            id: i.id,
            label: `${i.org_name} · ${ROLE_LABEL[i.role]}${i.invited_by_name ? ` · convite de ${i.invited_by_name}` : ""} · vale até ${formatDate(i.expires_at)}`,
          }))}
        />
      )}

      <section className="rounded-xl border border-line bg-surface p-6">
        <h2 className="mb-4 text-lg font-semibold text-ink">Suas organizações</h2>
        {error && <p className="text-sm text-danger">Não foi possível carregar as organizações.</p>}
        {memberships && memberships.length > 0 ? (
          <ul className="mb-6 divide-y divide-line">
            {memberships.map((m) => (
              <li key={m.organizations?.id} className="flex items-center justify-between py-3">
                <Link href={`/organizacoes/${m.organizations?.id}`} className="font-medium text-ink hover:text-brand hover:underline">
                  {m.organizations?.name}
                </Link>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-subtle">{ROLE_LABEL[m.role]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-6 text-sm text-subtle">
            Você ainda não faz parte de nenhuma organização. Crie a sua para começar a cadastrar negócios.
          </p>
        )}
        <OrgForm />
      </section>
    </main>
    </>
  );
}
