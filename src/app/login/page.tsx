import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForms } from "./auth-forms";

export const metadata: Metadata = { title: "Entrar · Due Diligence" };

async function LinkError({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { erro } = await searchParams;
  if (erro !== "link") return null;
  return (
    <p className="text-sm text-danger" role="alert">O link de confirmação é inválido ou expirou. Entre ou cadastre-se de novo.</p>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-12">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-ink">Due Diligence</h1>
        <p className="mt-1 text-sm text-subtle">Relatório preliminar de negócios imobiliários e societários</p>
      </div>
      <Suspense>
        <LinkError searchParams={searchParams} />
      </Suspense>
      <AuthForms />
    </main>
  );
}
