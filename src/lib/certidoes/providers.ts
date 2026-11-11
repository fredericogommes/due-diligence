/**
 * Provedores de certidão. Cada provedor diz quais itens do checklist atende,
 * o que precisa para pedir e como pedir/consultar. O servidor cuida de guardar
 * o arquivo e registrar o documento.
 */
import { simplePdf } from "./simple-pdf";

export type CertidaoSubject = {
  itemCode: string;
  itemTitle: string;
  /** Pessoa (nome + CPF/CNPJ) ou imóvel (matrícula + cartório) do item. */
  party?: { name: string; document: string | null };
  asset?: { description: string; matricula: string | null; cartorio: string | null; cns: string | null; municipio: string | null; uf: string | null };
};

export type ProviderResult =
  | { status: "concluido"; protocol: string | null; file: { bytes: Uint8Array; fileName: string; mimeType: "application/pdf" }; meta: { docType: string; issuer: string; issuedAt: string; expiresAt: string | null; result: "negativa" | "positiva" }; costCents: number | null }
  | { status: "pendente"; protocol: string; costCents: number | null; message: string }
  | { status: "erro"; error: string };

export type CertidaoProvider = {
  id: string;
  name: string;
  /** Se o provedor está utilizável neste ambiente; senão, o motivo. */
  availability(): { available: true } | { available: false; reason: string };
  /** O provedor atende este item? */
  supports(itemCode: string): boolean;
  /** O que falta para pedir (ex.: matrícula, CNS); lista vazia = pode pedir. */
  missing(subject: CertidaoSubject): string[];
  request(subject: CertidaoSubject, today: string): Promise<ProviderResult>;
  poll?(protocol: string, subject: CertidaoSubject, today: string): Promise<ProviderResult>;
};

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Provedor simulado: devolve uma certidão negativa fictícia em PDF.
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
  supports: () => true,
  missing: () => [],
  async request(subject, today) {
    const who = subject.party
      ? `${subject.party.name}${subject.party.document ? ` — ${subject.party.document}` : ""}`
      : subject.asset
        ? `${subject.asset.description}${subject.asset.matricula ? ` — matrícula ${subject.asset.matricula}` : ""}`
        : "Negócio";
    const protocol = `SIM-${today.replace(/-/g, "")}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const bytes = simplePdf("CERTIDÃO SIMULADA — SEM VALOR LEGAL", [
      `Item: ${subject.itemCode} — ${subject.itemTitle}`,
      `Referente a: ${who}`,
      `Data de emissão: ${today.split("-").reverse().join("/")}`,
      `Protocolo: ${protocol}`,
      "",
      "Resultado: NADA CONSTA (documento fictício gerado pelo provedor simulado).",
      "Este arquivo existe apenas para testar o fluxo de pedido de certidões do sistema.",
    ]);
    return {
      status: "concluido",
      protocol,
      file: { bytes, fileName: `certidao-simulada-${subject.itemCode}.pdf`, mimeType: "application/pdf" },
      meta: { docType: `${subject.itemTitle} (simulada)`, issuer: "Provedor simulado", issuedAt: today, expiresAt: addDays(today, 30), result: "negativa" },
      costCents: 0,
    };
  },
};

/**
 * Registro de Imóveis do Brasil (registrodeimoveis.org.br / ONR).
 * A chave de API é concedida pelo próprio portal ("Solicitar chave de API").
 * Enquanto a chave e a documentação oficial não forem recebidas, o provedor
 * fica indisponível e diz o porquê — não chamamos endpoints não documentados.
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
  async request() {
    return { status: "erro", error: "Integração com o Registro de Imóveis ainda não ativada." };
  },
};

export const PROVIDERS: CertidaoProvider[] = [registroImoveisProvider, simulatedProvider];

export function getProvider(id: string): CertidaoProvider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

/** Provedores que atendem o item, com disponibilidade e pendências de dados. */
export function providerOptions(subject: CertidaoSubject) {
  return PROVIDERS.filter((p) => p.supports(subject.itemCode)).map((p) => {
    const av = p.availability();
    return { id: p.id, name: p.name, available: av.available, reason: av.available ? null : av.reason, missing: p.missing(subject) };
  });
}
