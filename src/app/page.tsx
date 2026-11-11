import { redirect } from "next/navigation";
import { Suspense } from "react";
import { signOut } from "./login/actions";
import { OrgForm } from "./org-form";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";

const ROLE_LABEL: Record<string, string> = {
  owner: "Dono",
  admin: "Administrador",
  advogado: "Advogado",
  corretor: "Corretor",
};

type MembershipRow = {
  role: string;
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
  const [{ data: profile }, { data: memberships, error }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    supabase
      .from("memberships")
      .select("role, organizations(id, name, cnpj)")
      .eq("user_id", userId)
      .order("created_at")
      .returns<MembershipRow[]>(),
  ]);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Due Diligence</h1>
          <p className="text-sm text-subtle">Olá, {profile?.full_name ?? "bem-vindo"}.</p>
        </div>
        <form action={signOut}>
          <button className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-muted">Sair</button>
        </form>
      </header>

      <section className="rounded-xl border border-line bg-surface p-6">
        <h2 className="mb-4 text-lg font-semibold text-ink">Suas organizações</h2>
        {error && <p className="text-sm text-danger">Não foi possível carregar as organizações.</p>}
        {memberships && memberships.length > 0 ? (
          <ul className="mb-6 divide-y divide-line">
            {memberships.map((m) => (
              <li key={m.organizations?.id} className="flex items-center justify-between py-3">
                <span className="font-medium">{m.organizations?.name}</span>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-subtle">{ROLE_LABEL[m.role] ?? m.role}</span>
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
  );
}
