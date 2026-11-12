/* eslint-disable @next/next/no-img-element -- logos servidos pelo CDN do site do escritório */
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { todaySaoPaulo } from "@/lib/checklist/validity";
import { demoReportInput } from "@/lib/demo/sample";
import { buildReport } from "@/lib/report/build";
import { ReportDocument } from "@/app/negocios/[id]/relatorio/report-document";
import { DemoFlow } from "./demo-flow";
import "./mk.css";

export const metadata: Metadata = {
  title: "Due Diligence · Macedo & Keenan (demonstração)",
  description: "Demonstração do subsistema de due diligence integrado ao site do escritório Macedo & Keenan. Dados fictícios.",
  robots: { index: false, follow: false },
};

const SITE = "https://www.macedokeenan.adv.br";
const CDN = "https://cdn.prod.website-files.com/6ac2439d5860a511bb193913";
const LOGO_LIGHT = `${CDN}/6ac247504cb03b262c4c0043_logo-mk-claro.png`;
const LOGO_DARK = `${CDN}/6ac247504cb03b262c4c0065_logo-mk-escuro.png`;

const NAV = [
  { label: "Áreas de atuação", href: `${SITE}/#atuacao` },
  { label: "Como atuamos", href: `${SITE}/#processo` },
  { label: "IA na advocacia", href: `${SITE}/#ia` },
  { label: "Due diligence", href: "#due-diligence", isNew: true },
  { label: "Sócios", href: `${SITE}/#socios` },
  { label: "Contato", href: `${SITE}/#contato` },
];

/**
 * Demonstração pública do Due Diligence como subsistema do site macedokeenan.adv.br.
 * Reproduz cabeçalho, herói e rodapé do site e encaixa a nova seção com o fluxo interativo.
 * Tudo é fictício e roda no navegador: nenhuma chamada ao banco.
 */
export default function MacedoKeenanDemoPage() {
  return (
    <div className="mk flex min-h-full flex-1 flex-col overflow-x-clip">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- fontes do site só nesta página */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,500&display=swap"
        precedence="default"
      />

      <div className="bg-[var(--mk-gold)] px-4 py-1.5 text-center text-xs font-semibold text-[var(--mk-navy-black)]">
        Demonstração · subsistema Due Diligence integrado ao site · todos os dados são fictícios
      </div>

      {/* cabeçalho do site */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[var(--mk-navy-black)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <a href={SITE} className="shrink-0" aria-label="Macedo & Keenan Sociedade de Advogados">
            <img src={LOGO_LIGHT} alt="Macedo & Keenan Sociedade de Advogados" className="h-9 w-auto max-w-[180px] object-contain object-left sm:h-10" />
          </a>
          <nav className="hidden items-center gap-5 whitespace-nowrap text-[15px] text-[#e9e4da] lg:flex">
            {NAV.map((n) => (
              <a key={n.label} href={n.href} className={n.isNew ? "flex items-center gap-1.5 font-semibold text-[var(--mk-brass)]" : "hover:text-white"}>
                {n.label}
                {n.isNew && <span className="rounded bg-[var(--mk-gold)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--mk-navy-black)]">novo</span>}
              </a>
            ))}
          </nav>
          <a href="#portal" className="mk-btn-gold hidden shrink-0 whitespace-nowrap rounded-md px-4 py-2 text-sm font-semibold sm:inline-block">Iniciar due diligence</a>
        </div>
        <nav className="flex gap-4 overflow-x-auto px-4 pb-2 text-sm text-[#e9e4da] lg:hidden">
          {NAV.map((n) => (
            <a key={n.label} href={n.href} className={`shrink-0 ${n.isNew ? "font-semibold text-[var(--mk-brass)]" : ""}`}>{n.label}</a>
          ))}
        </nav>
      </header>

      {/* herói da nova seção, no padrão visual do site */}
      <section id="due-diligence" className="mk-hero scroll-mt-20 text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:py-20 lg:grid-cols-[1.25fr_1fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mk-brass)]">
              <span className="mr-3 inline-block h-px w-8 bg-[var(--mk-brass)] align-middle" />
              Novo · Due diligence assistida por IA
            </p>
            <h1 className="mk-serif mt-5 text-4xl leading-tight font-bold sm:text-5xl">
              Antes de assinar,
              <br />
              saiba o que está comprando.
            </h1>
            <p className="mk-serif mt-3 text-xl text-[var(--mk-brass)] italic">com a experiência de quem conhece o cartório por dentro.</p>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-[#d9d4ca]">
              Informe as partes e o imóvel ou as cotas. O sistema busca as certidões, a inteligência artificial aponta riscos e
              inconsistências, e um advogado do escritório revisa e assina o relatório. Se o negócio avançar, as certidões oficiais
              são emitidas com um único boleto.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#portal" className="mk-btn-gold rounded-md px-5 py-3 text-sm font-semibold">Ver demonstração</a>
              <a href="#como-funciona" className="rounded-md border border-white/40 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10">Como funciona</a>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-white/15 bg-white/15 text-center">
            {[
              ["30+", "certidões consultadas por negócio"],
              ["minutos", "para o relatório preliminar"],
              ["1 boleto", "para todas as certidões oficiais"],
            ].map(([v, l]) => (
              <div key={l} className="bg-[var(--mk-navy-deep)]/80 px-3 py-6">
                <p className="mk-serif text-2xl font-bold text-[var(--mk-brass)]">{v}</p>
                <p className="mt-1 text-xs text-[#d9d4ca]">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* como funciona */}
      <section id="como-funciona" className="scroll-mt-20 border-b border-[var(--mk-line)]">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mk-gold-deep)]">Método de trabalho</p>
          <h2 className="mk-serif mt-2 text-3xl font-bold text-[var(--mk-navy)]">Duas fases. Você só paga certidão quando o negócio avança.</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {[
              ["01", "Qualificação", "Partes, cônjuges, empresa e o objeto do negócio. O checklist se monta sozinho."],
              ["02", "Consulta prévia", "O sistema busca a prévia de cada certidão online, sem custo e sem valor legal."],
              ["03", "Relatório preliminar", "A IA lê tudo e aponta riscos, inconsistências e pendências. O advogado revisa e assina."],
              ["04", "Emissão oficial", "Com as tratativas avançando, as certidões oficiais são requeridas e o cliente recebe só o boleto."],
            ].map(([n, t, d], i) => (
              <div key={n} className={`rounded-xl border p-5 ${i < 3 ? "border-[var(--mk-line)] bg-white" : "border-[var(--mk-gold)] bg-[var(--mk-gold-pale)]"}`}>
                <p className="text-xs font-semibold tracking-wider text-[var(--mk-gold-deep)]">{n} · {i < 3 ? "FASE 1" : "FASE 2"}</p>
                <p className="mk-serif mt-2 text-lg font-bold text-[var(--mk-navy)]">{t}</p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--mk-ink-soft)]">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* o subsistema */}
      <section id="portal" className="scroll-mt-20 bg-[var(--mk-paper)]">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mk-gold-deep)]">Portal do cliente</p>
          <h2 className="mk-serif mt-2 text-3xl font-bold text-[var(--mk-navy)]">Experimente o fluxo completo</h2>
          <p className="mt-2 max-w-3xl text-[15px] text-[var(--mk-ink-soft)]">
            Exemplo: compra e venda de um apartamento em Volta Redonda. Clique nos botões para avançar; nada aqui é enviado a lugar nenhum.
          </p>
          <div className="mt-8">
            <DemoFlow
              fullReport={
                <Suspense fallback={<p className="text-sm text-[var(--mk-ink-soft)]">Carregando o parecer…</p>}>
                  <FullReport />
                </Suspense>
              }
            />
          </div>
        </div>
      </section>

      {/* rodapé do site */}
      <footer className="border-t border-[var(--mk-line)] bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-[1.4fr_1fr_1fr_1.3fr]">
          <div>
            <img src={LOGO_DARK} alt="Macedo & Keenan Sociedade de Advogados" className="h-10 w-auto" />
            <p className="mt-4 text-sm leading-relaxed text-[var(--mk-ink-soft)]">
              Advocacia em Direito Imobiliário, Registral, Sucessório, de Família e Empresarial, nas vias extrajudicial e judicial, em Volta Redonda e no Sul Fluminense.
            </p>
          </div>
          <FooterCol title="Áreas" items={["Imobiliário e registral", "Sucessões e planejamento", "Família", "Societário e contratos", "Due diligence"]} />
          <FooterCol title="Escritório" items={["Como atuamos", "Sócios", "Contato"]} />
          <FooterCol
            title="Contato"
            items={["R. Luiz Alves Pereira, 377, Loja 25, Aterrado, Volta Redonda (RJ)", "(24) 99271-9921", "contato@macedokeenan.adv.br"]}
          />
        </div>
        <div className="border-t border-[var(--mk-line)] px-4 py-5 text-center text-xs text-[var(--mk-ink-soft)]">
          © 2026 Macedo &amp; Keenan Sociedade de Advogados · Demonstração do subsistema Due Diligence com dados fictícios
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--mk-gold-deep)]">{title}</p>
      <ul className="mt-3 space-y-2 text-sm text-[var(--mk-ink)]">
        {items.map((i) => <li key={i}>{i}</li>)}
      </ul>
    </div>
  );
}

async function FullReport() {
  await connection();
  const report = buildReport({ ...demoReportInput(), orgName: "Macedo & Keenan Sociedade de Advogados" }, todaySaoPaulo());
  return (
    <ReportDocument
      report={report}
      conclusion={report.suggestedConclusion}
      opinion={{ conclusion: null, opinion: null, signer_name: "Advogado responsável", signer_registration: "OAB/RJ (assinatura após revisão)" }}
    />
  );
}
