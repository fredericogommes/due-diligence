/* eslint-disable @next/next/no-img-element -- logo servido pelo CDN do site do escritório */
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import "../macedo-keenan/mk.css";
import { AuthForms } from "./auth-forms";

export const metadata: Metadata = { title: "Entrar · Due Diligence · Macedo & Keenan" };

const LOGO_LIGHT = "https://cdn.prod.website-files.com/6ac2439d5860a511bb193913/6ac247504cb03b262c4c0043_logo-mk-claro.png";

async function LoginContent({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { erro, perfil } = await searchParams;
  return (
    <>
      {erro === "link" && (
        <p className="mb-4 rounded-md border border-[var(--mk-danger)]/30 bg-[var(--mk-danger)]/5 px-3 py-2 text-sm text-[var(--mk-danger)]" role="alert">
          O link de confirmação é inválido ou expirou. Entre ou cadastre-se de novo.
        </p>
      )}
      <AuthForms initialProfile={perfil === "equipe" ? "equipe" : "cliente"} />
    </>
  );
}

/** Acesso ao subsistema, no visual do site do escritório: área do cliente e acesso da equipe. */
export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="mk flex min-h-full flex-1 flex-col lg:flex-row">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- fontes do site só nas páginas MK */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,500&display=swap"
        precedence="default"
      />

      <aside className="mk-hero flex flex-col justify-between gap-10 px-6 py-8 text-white sm:px-10 lg:w-[44%] lg:py-12">
        <Link href="/" aria-label="Voltar ao site da Macedo & Keenan">
          <img src={LOGO_LIGHT} alt="Macedo & Keenan Sociedade de Advogados" className="h-10 w-auto max-w-[200px] object-contain object-left" />
        </Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mk-brass)]">Due diligence</p>
          <h1 className="mk-serif mt-4 text-3xl leading-tight font-bold sm:text-4xl">
            Antes de assinar,
            <br />
            saiba o que está comprando.
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[#d9d4ca]">
            Clientes acompanham aqui suas solicitações, boletos e relatórios. A equipe do escritório acessa a gestão dos pedidos.
          </p>
        </div>
        <Link href="/" className="text-sm text-[#d9d4ca] hover:text-white">← Voltar ao site</Link>
      </aside>

      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <Suspense>
            <LoginContent searchParams={searchParams} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
