import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/server";
import { NewDealForm } from "./new-deal-form";

export const metadata: Metadata = { title: "Novo negócio · Due Diligence" };

export default function NewDealPage() {
  return (
    <>
      <AppHeader current="negocios" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <Link href="/negocios" className="text-sm text-subtle hover:text-brand">← Negócios</Link>
        <h1 className="mb-6 mt-2 text-2xl font-semibold tracking-tight text-ink">Novo negócio</h1>
        <Suspense fallback={<p className="text-sm text-subtle">Carregando…</p>}>
          <FormLoader />
        </Suspense>
      </main>
    </>
  );
}

async function FormLoader() {
  const supabase = await createClient();
  const { data: orgs } = await supabase.from("organizations").select("id, name").order("name").returns<{ id: string; name: string }[]>();
  if (!orgs?.length) {
    return (
      <p className="text-sm text-subtle">
        Crie uma organização em <Link href="/" className="text-brand underline">Organizações</Link> primeiro.
      </p>
    );
  }
  return <NewDealForm orgs={orgs} />;
}
