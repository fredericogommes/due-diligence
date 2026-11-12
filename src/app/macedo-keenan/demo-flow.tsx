"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Demonstração interativa do fluxo do Due Diligence, com dados fictícios e sem banco.
 * Etapa 1: qualificação → consulta prévia das certidões → relatório preliminar por IA.
 * Etapa 2: requerimento das certidões oficiais e repasse do boleto.
 */

type Result = "negativa" | "positiva" | "indisponivel";

type Cert = {
  id: string;
  title: string;
  issuer: string;
  subject: "imovel" | "vendedor" | "conjuge";
  result: Result;
  summary: string;
  /** Custo ilustrativo da emissão oficial, em reais. */
  fee: number;
};

const CERTS: Cert[] = [
  { id: "mat", title: "Matrícula com ônus reais (inteiro teor)", issuer: "Registro de Imóveis · ONR", subject: "imovel", result: "positiva", summary: "R.7: hipoteca em favor do Banco Exemplo S.A., sem averbação de cancelamento.", fee: 98.45 },
  { id: "iptu", title: "Situação fiscal imobiliária (IPTU)", issuer: "Prefeitura", subject: "imovel", result: "negativa", summary: "Nada consta de débitos de IPTU para a inscrição informada.", fee: 0 },
  { id: "cnd-v", title: "CND conjunta federal (RFB/PGFN)", issuer: "Receita Federal / PGFN", subject: "vendedor", result: "negativa", summary: "Certidão negativa de débitos relativos a tributos federais e à dívida ativa da União.", fee: 0 },
  { id: "cndt-v", title: "Certidão negativa de débitos trabalhistas", issuer: "TST · CNDT", subject: "vendedor", result: "negativa", summary: "Não constam débitos inadimplidos perante a Justiça do Trabalho.", fee: 0 },
  { id: "tj-v", title: "Distribuidor cível da Justiça Estadual", issuer: "TJRJ", subject: "vendedor", result: "positiva", summary: "1 execução de título extrajudicial em curso, valor da causa R$ 42.300,00.", fee: 36.9 },
  { id: "trf-v", title: "Distribuidor da Justiça Federal", issuer: "TRF da 2ª Região", subject: "vendedor", result: "negativa", summary: "Nada consta de ações cíveis e criminais.", fee: 0 },
  { id: "prot-v", title: "Protestos de títulos (10 anos)", issuer: "CENPROT", subject: "vendedor", result: "negativa", summary: "Não constam protestos em nome do pesquisado.", fee: 24.5 },
  { id: "cnd-c", title: "CND conjunta federal (RFB/PGFN)", issuer: "Receita Federal / PGFN", subject: "conjuge", result: "negativa", summary: "Certidão negativa de débitos relativos a tributos federais e à dívida ativa da União.", fee: 0 },
  { id: "tj-c", title: "Distribuidor cível da Justiça Estadual", issuer: "TJRJ", subject: "conjuge", result: "indisponivel", summary: "Portal do tribunal fora do ar na consulta. Nova tentativa automática agendada.", fee: 36.9 },
];

const STEPS = ["Qualificação", "Consulta prévia", "Relatório preliminar", "Emissão oficial"] as const;

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Form = {
  kind: string;
  seller: string;
  sellerDoc: string;
  marital: string;
  spouse: string;
  buyer: string;
  matricula: string;
  cartorio: string;
  address: string;
  price: string;
};

const INITIAL: Form = {
  kind: "Compra e venda de imóvel",
  seller: "Carlos Exemplo da Silva",
  sellerDoc: "529.982.247-25",
  marital: "Casado · comunhão parcial de bens",
  spouse: "Marina Exemplo da Silva",
  buyer: "Paula Compradora",
  matricula: "45.678",
  cartorio: "1º Registro de Imóveis de Volta Redonda",
  address: "Rua das Acácias, 150, apto 302, Bloco B · Volta Redonda (RJ)",
  price: "R$ 780.000,00",
};

export function DemoFlow({ fullReport }: { fullReport: ReactNode }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(INITIAL);
  const top = useRef<HTMLDivElement>(null);

  function go(n: number) {
    setStep(n);
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div ref={top} className="scroll-mt-24 overflow-hidden rounded-2xl border border-[var(--mk-line)] bg-white shadow-[0_24px_60px_-30px_rgba(11,21,36,0.45)]">
      {/* barra do "aplicativo" */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--mk-navy-deep)] px-4 py-3 text-sm text-[#e9e4da] sm:px-6">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--mk-gold)] text-xs font-bold text-[var(--mk-navy-black)]">DD</span>
          <span className="font-semibold">Due Diligence <span className="font-normal text-[#c9bfae]">· Portal M&amp;K</span></span>
        </div>
        <span className="rounded-full border border-[var(--mk-gold)]/50 px-3 py-0.5 text-xs text-[var(--mk-brass)]">Negócio nº 2026-0147 · dados fictícios</span>
      </div>

      {/* passos */}
      <ol className="grid grid-cols-2 gap-px bg-[var(--mk-line)] sm:grid-cols-4">
        {STEPS.map((label, i) => {
          const state = i < step ? "done" : i === step ? "current" : "todo";
          return (
            <li key={label}>
              <button
                type="button"
                onClick={() => i <= step && go(i)}
                disabled={i > step}
                className={`flex h-full w-full items-center gap-2 px-3 py-3 text-left text-sm sm:px-4 ${state === "current" ? "bg-[var(--mk-gold-pale)] font-semibold text-[var(--mk-navy)]" : "bg-white text-[var(--mk-ink-soft)]"} disabled:cursor-default`}
              >
                <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${state === "done" ? "bg-[var(--mk-ok)] text-white" : state === "current" ? "bg-[var(--mk-navy)] text-white" : "border border-[var(--mk-line)]"}`}>
                  {state === "done" ? "✓" : i + 1}
                </span>
                <span>
                  <span className="block text-[11px] uppercase tracking-wider text-[var(--mk-gold-deep)]">{i < 3 ? "Fase 1" : "Fase 2"}</span>
                  {label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="p-4 sm:p-8">
        {step === 0 && <Qualification form={form} setForm={setForm} onNext={() => go(1)} />}
        {step === 1 && <Preview form={form} onNext={() => go(2)} />}
        {step === 2 && <AiReport form={form} fullReport={fullReport} onNext={() => go(3)} />}
        {step === 3 && <Issuance form={form} onRestart={() => { setForm(INITIAL); go(0); }} />}
      </div>
    </div>
  );
}

/* ---------- Etapa 1: qualificação ---------- */

function Qualification({ form, setForm, onNext }: { form: Form; setForm: (f: Form) => void; onNext: () => void }) {
  const field = (key: keyof Form, label: string, wide = false) => (
    <label className={`block space-y-1 text-sm ${wide ? "sm:col-span-2" : ""}`}>
      <span className="font-medium text-[var(--mk-navy)]">{label}</span>
      <input
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="w-full rounded-md border border-[var(--mk-line)] bg-[var(--mk-bg)] px-3 py-2 text-[var(--mk-ink)] outline-none focus:border-[var(--mk-gold)] focus:ring-2 focus:ring-[var(--mk-gold)]/25"
      />
    </label>
  );
  return (
    <div className="space-y-6">
      <Intro title="Quem são as partes e o que está sendo negociado?">
        O cliente (ou o escritório) informa as partes e o objeto do negócio. Com isso o sistema monta sozinho o checklist de certidões
        exigidas para cada parte e para o bem. Os campos abaixo já vêm preenchidos com um exemplo e podem ser editados.
      </Intro>

      <div className="grid gap-4 sm:grid-cols-2">
        {field("kind", "Tipo de negócio")}
        {field("price", "Valor do negócio")}
      </div>

      <Box title="Partes">
        <div className="grid gap-4 sm:grid-cols-2">
          {field("seller", "Vendedor")}
          {field("sellerDoc", "CPF do vendedor")}
          {field("marital", "Estado civil e regime")}
          {field("spouse", "Cônjuge do vendedor")}
          {field("buyer", "Comprador")}
        </div>
      </Box>

      <Box title="Objeto do negócio">
        <div className="grid gap-4 sm:grid-cols-2">
          {field("matricula", "Matrícula")}
          {field("cartorio", "Cartório")}
          {field("address", "Endereço do imóvel", true)}
        </div>
      </Box>

      <div className="rounded-lg border border-dashed border-[var(--mk-gold)] bg-[var(--mk-gold-pale)] px-4 py-3 text-sm text-[var(--mk-navy)]">
        <strong>Checklist gerado:</strong> 9 certidões online (imóvel, vendedor e cônjuge) e 4 documentos por upload
        (identidades, título aquisitivo anterior e declaração de condomínio).
      </div>

      <Actions>
        <PrimaryButton onClick={onNext}>Buscar certidões automaticamente →</PrimaryButton>
      </Actions>
    </div>
  );
}

/* ---------- Etapa 1: consulta prévia ---------- */

function subjectName(c: Cert, form: Form) {
  if (c.subject === "imovel") return `Matrícula ${form.matricula}`;
  return c.subject === "vendedor" ? form.seller : form.spouse;
}

function Preview({ form, onNext }: { form: Form; onNext: () => void }) {
  const [done, setDone] = useState(0);
  const [open, setOpen] = useState<Cert | null>(null);

  useEffect(() => {
    if (done >= CERTS.length) return;
    const t = setTimeout(() => setDone((d) => d + 1), done === 0 ? 700 : 520);
    return () => clearTimeout(t);
  }, [done]);

  const finished = done >= CERTS.length;
  const positives = CERTS.filter((c) => c.result === "positiva").length;

  return (
    <div className="space-y-6">
      <Intro title="O sistema busca as certidões sozinho">
        Para cada item, o sistema consulta a fonte oficial e baixa uma <strong>prévia</strong> (visualização sem valor legal, sem custo).
        A IA lê cada prévia; um resultado positivo vira um apontamento no relatório.
      </Intro>

      <div className="h-2 overflow-hidden rounded-full bg-[var(--mk-paper)]">
        <div className="h-full bg-[var(--mk-gold)] transition-all duration-500" style={{ width: `${(done / CERTS.length) * 100}%` }} />
      </div>

      <ul className="divide-y divide-[var(--mk-line)] overflow-hidden rounded-lg border border-[var(--mk-line)]">
        {CERTS.map((c, i) => {
          const state = i < done ? "done" : i === done ? "running" : "waiting";
          return (
            <li key={c.id} className="flex flex-wrap items-center gap-3 px-3 py-3 sm:px-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--mk-navy)]">{c.title}</p>
                <p className="text-xs text-[var(--mk-ink-soft)]">{c.issuer} · {subjectName(c, form)}</p>
              </div>
              {state === "waiting" && <span className="text-xs text-[var(--mk-ink-soft)]">na fila</span>}
              {state === "running" && <span className="mk-pulse text-xs font-medium text-[var(--mk-gold-deep)]">consultando…</span>}
              {state === "done" && (
                <>
                  <ResultBadge result={c.result} />
                  {c.result !== "indisponivel" && (
                    <button type="button" onClick={() => setOpen(c)} className="rounded-md border border-[var(--mk-line)] px-3 py-1 text-xs font-medium text-[var(--mk-navy)] hover:bg-[var(--mk-paper)]">
                      Ver prévia
                    </button>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>

      {finished && (
        <p className="text-sm text-[var(--mk-ink-soft)]">
          Consulta concluída: {CERTS.length} certidões, <strong className="text-[var(--mk-danger)]">{positives} positivas</strong>, 1 indisponível (nova tentativa automática).
        </p>
      )}

      <Actions>
        <PrimaryButton onClick={onNext} disabled={!finished}>{finished ? "Gerar relatório preliminar com IA →" : "Aguarde a consulta…"}</PrimaryButton>
      </Actions>

      {open && <PreviewModal cert={open} form={form} onClose={() => setOpen(null)} />}
    </div>
  );
}

function PreviewModal({ cert, form, onClose }: { cert: Cert; form: Form; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(11,21,36,0.6)] p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div className="relative w-full max-w-lg overflow-hidden rounded-lg bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mk-watermark">PRÉVIA · SEM VALOR LEGAL</div>
        <p className="text-center text-xs uppercase tracking-widest text-[var(--mk-ink-soft)]">{cert.issuer}</p>
        <h3 className="mk-serif mt-1 text-center text-lg font-bold text-[var(--mk-navy)]">{cert.title.toUpperCase()}</h3>
        <dl className="mt-5 space-y-2 text-sm">
          <Row k="Pesquisado" v={subjectName(cert, form)} />
          {cert.subject === "vendedor" && <Row k="CPF" v={form.sellerDoc} />}
          {cert.subject === "imovel" && <Row k="Cartório" v={form.cartorio} />}
          <Row k="Data da consulta" v={new Date().toLocaleDateString("pt-BR")} />
          <Row k="Resultado" v={cert.result === "positiva" ? "POSITIVA" : "NEGATIVA"} />
        </dl>
        <p className="mt-4 rounded-md bg-[var(--mk-paper)] p-3 text-sm">{cert.summary}</p>
        <p className="mt-4 text-[11px] text-[var(--mk-ink-soft)]">Documento simulado para demonstração. Nomes, números e resultados são fictícios.</p>
        <div className="mt-4 text-right">
          <button type="button" onClick={onClose} className="rounded-md bg-[var(--mk-navy)] px-4 py-2 text-sm font-semibold text-white">Fechar</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Etapa 1: relatório preliminar por IA ---------- */

type Finding = { level: "Alto" | "Médio" | "Baixo"; kind: "Risco" | "Inconsistência" | "Pendência"; title: string; text: string };

const FINDINGS: Finding[] = [
  { level: "Alto", kind: "Risco", title: "Hipoteca vigente na matrícula (R.7)", text: "Ônus real em favor do Banco Exemplo S.A. sem averbação de cancelamento. Exigir termo de quitação e averbar o cancelamento antes ou no ato da escritura; considerar retenção de parte do preço." },
  { level: "Alto", kind: "Risco", title: "Execução em curso contra o vendedor (TJRJ)", text: "Execução de título extrajudicial de R$ 42.300,00. Avaliar risco de fraude à execução: pedir certidão de objeto e pé, comprovação de outros bens ou quitação prévia do débito." },
  { level: "Médio", kind: "Inconsistência", title: "Área divergente entre matrícula e cadastro do IPTU", text: "Matrícula informa 78,40 m² de área privativa; o cadastro municipal, 82,00 m². Verificar se houve acréscimo não averbado antes de fixar o preço." },
  { level: "Médio", kind: "Pendência", title: "Outorga do cônjuge", text: "Vendedor casado em comunhão parcial: o cônjuge precisa anuir na escritura e apresentar as próprias certidões (uma ainda indisponível)." },
  { level: "Baixo", kind: "Pendência", title: "Título aquisitivo anterior", text: "Documento não existe online. Solicitar o upload da escritura de aquisição do vendedor." },
];

const LEVEL_CLASS: Record<Finding["level"], string> = {
  Alto: "bg-[var(--mk-danger)] text-white",
  Médio: "bg-[var(--mk-warn)] text-white",
  Baixo: "bg-[var(--mk-paper)] text-[var(--mk-navy)]",
};

function AiReport({ form, fullReport, onNext }: { form: Form; fullReport: ReactNode; onNext: () => void }) {
  const [ready, setReady] = useState(false);
  const [showFull, setShowFull] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1600);
    return () => clearTimeout(t);
  }, []);

  if (!ready) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--mk-paper)] border-t-[var(--mk-gold)]" />
        <p className="mk-pulse text-sm text-[var(--mk-ink-soft)]">A IA está lendo as certidões e cruzando as informações…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Intro title="Relatório preliminar de due diligence">
        Gerado pela IA a partir das prévias e dos dados da qualificação. É um rascunho para revisão: a conclusão final e a assinatura são do advogado.
      </Intro>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Certidões lidas" value="8 de 9" />
        <Stat label="Riscos altos" value="2" tone="danger" />
        <Stat label="Inconsistências" value="1" tone="warn" />
        <Stat label="Pendências" value="2" />
      </div>

      <div className="rounded-lg border-l-4 border-[var(--mk-warn)] bg-[var(--mk-gold-pale)] p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--mk-gold-deep)]">Conclusão sugerida</p>
        <p className="mk-serif mt-1 text-xl font-bold text-[var(--mk-navy)]">Viável com ressalvas</p>
        <p className="mt-1 text-sm text-[var(--mk-ink-soft)]">
          {form.kind} · {form.address} · {form.price}. O negócio pode avançar desde que a hipoteca seja baixada e a execução contra o vendedor seja equacionada.
        </p>
      </div>

      <ul className="space-y-3">
        {FINDINGS.map((f) => (
          <li key={f.title} className="rounded-lg border border-[var(--mk-line)] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded px-2 py-0.5 text-[11px] font-bold uppercase ${LEVEL_CLASS[f.level]}`}>{f.level}</span>
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--mk-gold-deep)]">{f.kind}</span>
            </div>
            <p className="mt-2 font-semibold text-[var(--mk-navy)]">{f.title}</p>
            <p className="mt-1 text-sm text-[var(--mk-ink-soft)]">{f.text}</p>
          </li>
        ))}
      </ul>

      <div className="flex items-start gap-3 rounded-lg bg-[var(--mk-navy)] p-4 text-sm text-[#e9e4da]">
        <span className="text-lg text-[var(--mk-brass)]">⚖</span>
        <p><strong className="text-white">Quem decide é o advogado.</strong> A IA organiza e aponta; o parecer é revisado, editado e assinado por advogado antes de ir ao cliente.</p>
      </div>

      <div>
        <button type="button" onClick={() => setShowFull((v) => !v)} className="text-sm font-semibold text-[var(--mk-gold-deep)] underline underline-offset-4">
          {showFull ? "Ocultar o parecer completo" : "Ver o parecer completo no formato do relatório →"}
        </button>
        {showFull && <div className="mt-4 overflow-x-auto">{fullReport}</div>}
      </div>

      <Actions>
        <SecondaryButton onClick={() => window.print()}>Imprimir / PDF</SecondaryButton>
        <PrimaryButton onClick={onNext}>As tratativas avançaram: emitir certidões oficiais →</PrimaryButton>
      </Actions>
    </div>
  );
}

/* ---------- Etapa 2: emissão oficial e boleto ---------- */

function Issuance({ form, onRestart }: { form: Form; onRestart: () => void }) {
  const issuable = CERTS;
  const total = issuable.reduce((s, c) => s + c.fee, 0);
  const [phase, setPhase] = useState<"review" | "boleto" | "paid">("review");
  const [arrived, setArrived] = useState(0);
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);
  const [due] = useState(() => new Date(Date.now() + 3 * 86_400_000).toLocaleDateString("pt-BR"));
  const line = "23793.38128 60000.000003 47000.063301 1 9876" + String(Math.round(total * 100)).padStart(10, "0");

  useEffect(() => {
    if (phase !== "paid" || arrived >= issuable.length) return;
    const t = setTimeout(() => setArrived((a) => a + 1), 450);
    return () => clearTimeout(t);
  }, [phase, arrived, issuable.length]);

  return (
    <div className="space-y-6">
      <Intro title="Fase 2: emissão das certidões oficiais">
        Com o negócio avançando, um clique pede pela API a emissão de todas as certidões válidas. O sistema calcula os custos
        e <strong>só repassa o boleto</strong> ao cliente; depois do pagamento, cada certidão oficial chega e é anexada ao item do checklist.
      </Intro>

      <div className="overflow-x-auto rounded-lg border border-[var(--mk-line)]">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-[var(--mk-paper)] text-left text-xs uppercase tracking-wider text-[var(--mk-ink-soft)]">
            <tr>
              <th className="px-3 py-2">Certidão</th>
              <th className="px-3 py-2">Pesquisado</th>
              <th className="px-3 py-2 text-right">Custo*</th>
              <th className="px-3 py-2 text-right">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--mk-line)]">
            {issuable.map((c, i) => (
              <tr key={c.id}>
                <td className="px-3 py-2 font-medium text-[var(--mk-navy)]">{c.title}</td>
                <td className="px-3 py-2 text-[var(--mk-ink-soft)]">{subjectName(c, form)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{c.fee ? brl(c.fee) : "gratuita"}</td>
                <td className="px-3 py-2 text-right text-xs">
                  {phase === "review" && <span className="text-[var(--mk-ink-soft)]">a requerer</span>}
                  {phase === "boleto" && <span className="text-[var(--mk-warn)]">aguardando pagamento</span>}
                  {phase === "paid" && (i < arrived
                    ? <span className="font-semibold text-[var(--mk-ok)]">✓ emitida e anexada</span>
                    : <span className="mk-pulse text-[var(--mk-gold-deep)]">emitindo…</span>)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[var(--mk-paper)] font-semibold">
              <td className="px-3 py-2" colSpan={2}>Total</td>
              <td className="px-3 py-2 text-right tabular-nums">{brl(total)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-[var(--mk-ink-soft)]">* Valores ilustrativos para a demonstração. Os emolumentos reais dependem de cada cartório e tribunal.</p>

      {phase === "review" && (
        <Actions>
          <PrimaryButton onClick={() => setPhase("boleto")}>Requerer emissão de todas as certidões</PrimaryButton>
        </Actions>
      )}

      {phase !== "review" && (
        <div className="relative overflow-hidden rounded-lg border-2 border-dashed border-[var(--mk-navy)] p-5">
          <div className="mk-watermark">BOLETO FICTÍCIO</div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="mk-serif text-lg font-bold text-[var(--mk-navy)]">Boleto para o cliente</p>
            <p className="text-sm">Vencimento <strong>{due}</strong> · Valor <strong>{brl(total)}</strong></p>
          </div>
          <p className="mt-1 text-sm text-[var(--mk-ink-soft)]">Pagador: {form.buyer} · Referência: certidões do negócio nº 2026-0147</p>
          <p className="mt-3 break-all rounded bg-[var(--mk-paper)] px-3 py-2 font-mono text-sm">{line}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <SecondaryButton onClick={() => { navigator.clipboard?.writeText(line).catch(() => {}); setCopied(true); }}>{copied ? "Copiado ✓" : "Copiar linha digitável"}</SecondaryButton>
            <SecondaryButton onClick={() => setSent(true)}>{sent ? "Enviado ao cliente ✓ (simulado)" : "Enviar ao cliente por e-mail e WhatsApp"}</SecondaryButton>
            {phase === "boleto" && <PrimaryButton onClick={() => setPhase("paid")}>Simular pagamento</PrimaryButton>}
          </div>
        </div>
      )}

      {phase === "paid" && arrived >= issuable.length && (
        <div className="rounded-lg border border-[var(--mk-ok)] bg-[#eef6f0] p-4 text-sm text-[var(--mk-navy)]">
          <strong>Pronto.</strong> Todas as certidões oficiais foram anexadas ao negócio e o relatório pode ser atualizado para a versão final, revisada e assinada.
        </div>
      )}

      <Actions>
        <SecondaryButton onClick={onRestart}>Recomeçar a demonstração</SecondaryButton>
      </Actions>
    </div>
  );
}

/* ---------- peças pequenas ---------- */

function Intro({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mk-serif text-2xl font-bold text-[var(--mk-navy)]">{title}</h3>
      <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-[var(--mk-ink-soft)]">{children}</p>
    </div>
  );
}

function Box({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-lg border border-[var(--mk-line)] p-4">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-[var(--mk-gold-deep)]">{title}</legend>
      {children}
    </fieldset>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-dotted border-[var(--mk-line)] pb-1">
      <dt className="text-[var(--mk-ink-soft)]">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "danger" | "warn" }) {
  const color = tone === "danger" ? "text-[var(--mk-danger)]" : tone === "warn" ? "text-[var(--mk-warn)]" : "text-[var(--mk-navy)]";
  return (
    <div className="rounded-lg border border-[var(--mk-line)] p-3">
      <p className={`mk-serif text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-[var(--mk-ink-soft)]">{label}</p>
    </div>
  );
}

function ResultBadge({ result }: { result: Result }) {
  if (result === "positiva") return <span className="rounded-full bg-[var(--mk-danger)]/10 px-2.5 py-0.5 text-xs font-semibold text-[var(--mk-danger)]">Positiva</span>;
  if (result === "negativa") return <span className="rounded-full bg-[var(--mk-ok)]/10 px-2.5 py-0.5 text-xs font-semibold text-[var(--mk-ok)]">Negativa</span>;
  return <span className="rounded-full bg-[var(--mk-paper)] px-2.5 py-0.5 text-xs font-semibold text-[var(--mk-ink-soft)]">Indisponível</span>;
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--mk-line)] pt-5">{children}</div>;
}

function PrimaryButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="mk-btn-gold rounded-md px-5 py-2.5 text-sm font-semibold disabled:opacity-50">
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-md border border-[var(--mk-navy)] px-4 py-2 text-sm font-semibold text-[var(--mk-navy)] hover:bg-[var(--mk-paper)]">
      {children}
    </button>
  );
}
