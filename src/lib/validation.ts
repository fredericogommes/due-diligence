import { z } from "zod";
import {
  ASSET_KINDS, DEAL_KINDS, ITEM_STATUSES, MARITAL_STATUSES, PARTY_KINDS, PARTY_ROLES, PROPERTY_REGIMES, UFS,
} from "./domain";
import { ALLOWED_MIME, DOC_RESULTS, MAX_DOCUMENT_BYTES } from "./documents";

/** Remove pontuação de CPF/CNPJ. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Valida os dígitos verificadores de um CNPJ (14 dígitos, sem pontuação). */
export function isValidCnpj(raw: string): boolean {
  const cnpj = onlyDigits(raw);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const digit = (base: string) => {
    let weight = base.length - 7;
    let sum = 0;
    for (const ch of base) {
      sum += Number(ch) * weight--;
      if (weight < 2) weight = 9;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const d1 = digit(cnpj.slice(0, 12));
  const d2 = digit(cnpj.slice(0, 12) + d1);
  return cnpj.endsWith(`${d1}${d2}`);
}

export const credentialsSchema = z.object({
  email: z.email("E-mail inválido."),
  password: z.string().min(8, "A senha precisa de ao menos 8 caracteres."),
});

export const signUpSchema = credentialsSchema.extend({
  fullName: z.string().trim().min(2, "Informe seu nome.").max(120),
});

export const organizationSchema = z.object({
  name: z.string().trim().min(2, "O nome precisa de ao menos 2 caracteres.").max(120, "Nome muito longo."),
  cnpj: z
    .string()
    .trim()
    .transform(onlyDigits)
    .refine((v) => v === "" || isValidCnpj(v), "CNPJ inválido.")
    .optional(),
});

/** Valida os dígitos verificadores de um CPF. */
export function isValidCpf(raw: string): boolean {
  const cpf = onlyDigits(raw);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (base: string) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += Number(base[i]) * (base.length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  const d1 = digit(cpf.slice(0, 9));
  const d2 = digit(cpf.slice(0, 9) + d1);
  return cpf.endsWith(`${d1}${d2}`);
}

/** Campo de texto opcional: string vazia vira undefined. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "Texto muito longo.")
    .transform((v) => (v === "" ? undefined : v))
    .optional();

/** Enum opcional vindo de <select>: "" vira undefined. */
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), z.enum(values).optional());

export const dealSchema = z.object({
  orgId: z.uuid("Escolha a organização."),
  kind: z.enum(DEAL_KINDS, "Escolha o tipo de negócio."),
  title: z.string().trim().min(2, "Dê um nome ao negócio.").max(200),
  price: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return undefined;
      // aceita 1.234.567,89 ou 1234567.89
      const n = Number(v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v);
      if (!Number.isFinite(n) || n < 0) {
        ctx.addIssue({ code: "custom", message: "Valor inválido." });
        return z.NEVER;
      }
      return Math.round(n * 100) / 100;
    })
    .optional(),
  notes: optionalText(5000),
});

export const partySchema = z
  .object({
    dealId: z.uuid(),
    kind: z.enum(PARTY_KINDS, "Escolha PF ou PJ."),
    role: z.enum(PARTY_ROLES, "Escolha o papel da parte."),
    name: z.string().trim().min(2, "Informe o nome.").max(200),
    document: z.string().trim().transform(onlyDigits).optional(),
    maritalStatus: optionalEnum(MARITAL_STATUSES),
    propertyRegime: optionalEnum(PROPERTY_REGIMES),
    notes: optionalText(2000),
  })
  .superRefine((p, ctx) => {
    if (p.document) {
      const ok = p.kind === "pf" ? isValidCpf(p.document) : isValidCnpj(p.document);
      if (!ok) ctx.addIssue({ code: "custom", path: ["document"], message: p.kind === "pf" ? "CPF inválido." : "CNPJ inválido." });
    }
    if (p.kind === "pj" && (p.maritalStatus || p.propertyRegime)) {
      ctx.addIssue({ code: "custom", path: ["maritalStatus"], message: "Estado civil só se aplica a pessoa física." });
    }
    if (p.propertyRegime && p.maritalStatus !== "casado" && p.maritalStatus !== "uniao_estavel") {
      ctx.addIssue({ code: "custom", path: ["propertyRegime"], message: "Regime de bens só para casado(a) ou união estável." });
    }
  })
  .transform((p) => ({ ...p, document: p.document || undefined }));

export const assetSchema = z
  .object({
    dealId: z.uuid(),
    kind: z.enum(ASSET_KINDS, "Escolha o tipo de bem."),
    description: z.string().trim().min(2, "Descreva o bem.").max(300),
    matricula: optionalText(40),
    cartorio: optionalText(200),
    cns: z.string().trim().transform(onlyDigits).optional(),
    inscricaoIptu: optionalText(60),
    address: optionalText(300),
    municipio: optionalText(120),
    uf: optionalEnum(UFS),
    cnpj: z.string().trim().transform(onlyDigits).optional(),
  })
  .superRefine((a, ctx) => {
    if (a.cns && a.cns.length !== 6) ctx.addIssue({ code: "custom", path: ["cns"], message: "O CNS do cartório tem 6 dígitos." });
    if (a.cnpj && !isValidCnpj(a.cnpj)) ctx.addIssue({ code: "custom", path: ["cnpj"], message: "CNPJ inválido." });
  })
  .transform((a) => {
    const imovel = a.kind === "imovel";
    return {
      ...a,
      matricula: imovel ? a.matricula : undefined,
      cartorio: imovel ? a.cartorio : undefined,
      cns: imovel && a.cns ? a.cns : undefined,
      inscricaoIptu: imovel ? a.inscricaoIptu : undefined,
      cnpj: !imovel && a.cnpj ? a.cnpj : undefined,
    };
  });

export const itemUpdateSchema = z.object({
  itemId: z.uuid(),
  status: z.enum(ITEM_STATUSES),
  notes: optionalText(2000),
});

const optionalDate = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.iso.date("Data inválida.").optional(),
);

/** Metadados de um documento (o que o usuário informa ou a IA extrai). */
export const documentMetaSchema = z
  .object({
    dealItemId: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.uuid().optional()),
    docType: optionalText(200),
    issuer: optionalText(200),
    issuedAt: optionalDate,
    expiresAt: optionalDate,
    result: z.enum(DOC_RESULTS).default("indeterminado"),
    notes: optionalText(2000),
  })
  .refine((d) => !d.issuedAt || !d.expiresAt || d.expiresAt >= d.issuedAt, {
    path: ["expiresAt"],
    message: "A validade não pode ser anterior à emissão.",
  });

export const registerDocumentSchema = z.intersection(
  documentMetaSchema,
  z.object({
    dealId: z.uuid(),
    path: z.string().min(10).max(500),
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.enum(ALLOWED_MIME, "Tipo de arquivo não aceito (use PDF, JPG, PNG ou WEBP)."),
    sizeBytes: z.number().int().positive().max(MAX_DOCUMENT_BYTES, "Arquivo maior que 20 MB."),
    sha256: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  }),
);

/** Converte FormData em objeto simples (só campos de texto). */
export function formToObject(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

/** Primeira mensagem de erro de uma validação, para mostrar no formulário. */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos.";
}
