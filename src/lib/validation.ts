import { z } from "zod";

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

/** Primeira mensagem de erro de uma validação, para mostrar no formulário. */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos.";
}
