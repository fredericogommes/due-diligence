/**
 * Provedores de certidão, em duas fases:
 *  - preview (consulta prévia): devolve a VISUALIZAÇÃO da certidão, sem valor
 *    oficial, para o relatório preliminar;
 *  - request/poll (emissão): pede a certidão OFICIAL; o provedor devolve um
 *    boleto, e a certidão chega depois do pagamento.
 * O servidor cuida de guardar os arquivos e registrar os documentos.
 */
import { simplePdf } from "./simple-pdf";

export type CertidaoSubject = {
  itemCode: string;
  itemTitle: string;
  /** Pessoa (nome + CPF/CNPJ) ou imóvel (matrícula + cartório) do item. */
  party?: { name: string; document: string | null };
  asset?: { description: string; matricula: string | null; cartorio: string | null; cns: string | null; municipio: string | null; uf: string | null };
};

export type CertMode = "visualizacao" | "emissao";

export type ReceivedFile = {
  status: "concluido";
  protocol: string | null;
  file: { bytes: Uint8Array; fileName: string; mimeType: "application/pdf" };
  meta: { docType: string; issuer: string; issuedAt: string; expiresAt: string | null; result: "negativa" | "positiva" };
  costCents: number | null;
};

export type ProviderError = { status: "erro"; error: string };

export type PreviewResult = ReceivedFile | ProviderError;

export type IssueResult =
  | ReceivedFile
  | ProviderError
  | { status: "aguardando_pagamento"; protocol: string; costCents: number | null; boleto: { url: string | null; line: string; due: string }; message: string }
  | { status: "pendente"; protocol: string; costCents: number | null; message: string };

export type CertidaoProvider = {
  id: string;
  name: string;
  /** Se o provedor está utilizável neste ambiente; senão, o motivo. */
  availability(): { available: true } | { available: false; reason: string };
  /** O provedor atende este item nesta fase? */
  supports(itemCode: string, mode: CertMode): boolean;
  /** O que falta para pedir (ex.: matrícula, CPF); lista vazia = pode pedir. */
  missing(subject: CertidaoSubject): string[];
  preview(subject: CertidaoSubject, today: string): Promise<PreviewResult>;
  request(subject: CertidaoSubject, today: string): Promise<IssueResult>;
  poll(protocol: string, subject: CertidaoSubject, today: string): Promise<IssueResult>;
};

/**
 * Itens que existem como certidão consultável/emitível online. Os demais
 * (identidade, contratos, título aquisitivo, laudos…) são fornecidos pelas
 * partes e entram por upload.
 */
export const ONLINE_ITEM_CODES = new Set([
  "IMV-01", "IMV-02",
  "VPF-02", "VPF-03", "VPF-04", "VPF-05", "VPF-06", "VPF-07", "VPF-08",
  "VPJ-01", "VPJ-02", "VPJ-03", "VPJ-04", "VPJ-05", "VPJ-06", "VPJ-07", "VPJ-08",
  "SOC-02", "TRIB-01", "TRIB-02", "TRIB-03", "TRIB-04", "TRAB-01", "JUD-01", "JUD-02", "JUD-03", "JUD-04",
]);

export function isOnlineItem(code: string): boolean {
  return ONLINE_ITEM_CODES.has(code);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function subjectLine(subject: CertidaoSubject): string {
  if (subject.party) return `${subject.party.name}${subject.party.document ? ` — ${subject.party.document}` : ""}`;
  if (subject.asset) return `${subject.asset.description}${subject.asset.matricula ? ` — matrícula ${subject.asset.matricula}` : ""}`;
  return "Negócio";
}

/** Hash estável (FNV-1a) para o simulado dar sempre o mesmo resultado ao mesmo sujeito. */
function stableHash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/**
 * Resultado da visualização simulada: positiva se o nome/descrição tiver
 * "positiv" (para demonstrar riscos), senão ~1 em cada 7 itens, de forma estável.
 */
export function simulatedOutcome(subject: CertidaoSubject): "negativa" | "positiva" {
  const who = `${subject.party?.name ?? ""} ${subject.asset?.description ?? ""}`.toLowerCase();
  if (who.includes("positiv")) return "positiva";
  return stableHash(`${subject.itemCode}|${subjectLine(subject)}`) % 7 === 0 ? "positiva" : "negativa";
}

const SIMULATED_FEE_CENTS = 4590;

/**
 * Provedor simulado: visualização e certidão fictícias em PDF e boleto fictício.
 * Só para demonstração e testes — fica desligado em produção.
 */
export const simulatedProvider: CertidaoProvider = {
  id: "simulado",
  name: "Simulado (testes)",
  availability() {
    if (process.env.NODE_ENV === "production" && process.env.CERTIDOES_SIMULADO !== "1") {
      return { available: false, reason: "Provedor simulado desligado em produção." };
    }
    return { available: true };
  },
  supports: (code) => isOnlineItem(code),
  missing: () => [],
  async preview(subject, today) {
    const result = simulatedOutcome(subject);
    const bytes = simplePdf("VISUALIZAÇÃO SIMULADA — SEM VALOR LEGAL", [
      `Item: ${subject.itemCode} — ${subject.itemTitle}`,
      `Referente a: ${subjectLine(subject)}`,
      `Consulta em: ${today.split("-").reverse().join("/")}`,
      "",
      result === "positiva"
        ? "Resultado: CONSTA REGISTRO (fictício). Ex.: ação de execução em andamento / ônus averbado."
        : "Resultado: NADA CONSTA (fictício).",
      "Visualização para análise prévia; não substitui a certidão oficial.",
    ]);
    return {
      status: "concluido",
      protocol: null,
      file: { bytes, fileName: `visualizacao-${subject.itemCode}.pdf`, mimeType: "application/pdf" },
      meta: { docType: `${subject.itemTitle} (visualização)`, issuer: "Provedor simulado", issuedAt: today, expiresAt: null, result },
      costCents: 0,
    };
  },
  async request(subject, today) {
    const protocol = `SIM-${today.replace(/-/g, "")}-${stableHash(subject.itemCode + subjectLine(subject) + Math.random()).toString(36).slice(0, 6).toUpperCase()}`;
    return {
      status: "aguardando_pagamento",
      protocol,
      costCents: SIMULATED_FEE_CENTS,
      boleto: { url: null, line: "00190.00009 01234.567890 12345.678901 1 00000000004590", due: addDays(today, 3) },
      message: "Boleto fictício gerado pelo provedor simulado.",
    };
  },
  async poll(protocol, subject, today) {
    const bytes = simplePdf("CERTIDÃO SIMULADA — SEM VALOR LEGAL", [
      `Item: ${subject.itemCode} — ${subject.itemTitle}`,
      `Referente a: ${subjectLine(subject)}`,
      `Data de emissão: ${today.split("-").reverse().join("/")}`,
      `Protocolo: ${protocol}`,
      "",
      `Resultado: ${simulatedOutcome(subject) === "positiva" ? "CONSTA REGISTRO" : "NADA CONSTA"} (documento fictício).`,
      "Pagamento do boleto considerado confirmado pelo provedor simulado.",
    ]);
    return {
      status: "concluido",
      protocol,
      file: { bytes, fileName: `certidao-${subject.itemCode}.pdf`, mimeType: "application/pdf" },
      meta: { docType: subject.itemTitle, issuer: "Provedor simulado", issuedAt: today, expiresAt: addDays(today, 30), result: simulatedOutcome(subject) },
      costCents: SIMULATED_FEE_CENTS,
    };
  },
};

const notActive: ProviderError = { status: "erro", error: "Integração com o Registro de Imóveis ainda não ativada." };

/**
 * Registro de Imóveis do Brasil (registrodeimoveis.org.br / ONR): visualização
 * e certidão da matrícula. Enquanto a chave e a documentação oficial não forem
 * recebidas, o provedor fica indisponível e diz o porquê — não chamamos
 * endpoints não documentados.
 */
export const registroImoveisProvider: CertidaoProvider = {
  id: "registro-imoveis",
  name: "Registro de Imóveis do Brasil (ONR)",
  availability() {
    if (!process.env.REGISTRO_IMOVEIS_API_KEY || !process.env.REGISTRO_IMOVEIS_API_URL) {
      return {
        available: false,
        reason: "Aguardando a chave de API do registrodeimoveis.org.br (configure REGISTRO_IMOVEIS_API_URL e REGISTRO_IMOVEIS_API_KEY).",
      };
    }
    return {
      available: false,
      reason: "Chave configurada, mas a integração depende da documentação oficial da API, que ainda não foi recebida.",
    };
  },
  supports: (code) => code === "IMV-01",
  missing(subject) {
    const m: string[] = [];
    if (!subject.asset?.matricula) m.push("número da matrícula");
    if (!subject.asset?.cns && !subject.asset?.cartorio) m.push("cartório (CNS ou nome)");
    if (!subject.asset?.uf) m.push("UF");
    return m;
  },
  preview: async () => notActive,
  request: async () => notActive,
  poll: async () => notActive,
};

export const PROVIDERS: CertidaoProvider[] = [registroImoveisProvider, simulatedProvider];

export function getProvider(id: string): CertidaoProvider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

/** Provedores que atendem o item nesta fase, com disponibilidade e pendências de dados. */
export function providerOptions(subject: CertidaoSubject, mode: CertMode = "emissao") {
  return PROVIDERS.filter((p) => p.supports(subject.itemCode, mode)).map((p) => {
    const av = p.availability();
    return { id: p.id, name: p.name, available: av.available, reason: av.available ? null : av.reason, missing: p.missing(subject) };
  });
}

export type ProviderChoice =
  | { ok: true; provider: CertidaoProvider }
  | { ok: false; reason: string };

/**
 * Escolhe o provedor de um item: o primeiro disponível e com os dados completos.
 * Se nenhum servir, devolve o motivo mais útil (dados faltando > indisponível).
 */
export function pickProvider(subject: CertidaoSubject, mode: CertMode): ProviderChoice {
  const candidates = PROVIDERS.filter((p) => p.supports(subject.itemCode, mode));
  if (!candidates.length) return { ok: false, reason: "Documento fornecido pelas partes (não há consulta online)." };
  let missing: string[] | null = null;
  let unavailable: string | null = null;
  for (const p of candidates) {
    const av = p.availability();
    if (!av.available) {
      unavailable ??= av.reason;
      continue;
    }
    const m = p.missing(subject);
    if (m.length) {
      missing ??= m;
      continue;
    }
    return { ok: true, provider: p };
  }
  if (missing) return { ok: false, reason: `Falta cadastrar: ${missing.join(", ")}.` };
  return { ok: false, reason: unavailable ?? "Nenhum provedor disponível." };
}
