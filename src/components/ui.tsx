"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";

export const inputClass =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-text outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:opacity-60";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-subtle">{hint}</span>}
    </label>
  );
}

export function SubmitButton({
  children,
  pendingText = "Salvando…",
  variant = "primary",
  ...rest
}: ComponentProps<"button"> & { pendingText?: string; variant?: "primary" | "secondary" | "danger" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || rest.disabled} className={buttonClass(variant)} {...rest}>
      {pending ? pendingText : children}
    </button>
  );
}

export function buttonClass(variant: "primary" | "secondary" | "danger" = "primary"): string {
  const base = "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60";
  if (variant === "secondary") return `${base} border border-line bg-surface text-text hover:bg-muted`;
  if (variant === "danger") return `${base} border border-danger/40 bg-surface text-danger hover:bg-danger/10`;
  return `${base} bg-brand text-white hover:bg-brand-strong`;
}

export function ButtonLink({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "secondary" }) {
  return (
    <Link href={href} className={buttonClass(variant)}>
      {children}
    </Link>
  );
}

export function FormMessage({ error, info }: { error?: string; info?: string }) {
  if (error) return <p className="text-sm text-danger" role="alert">{error}</p>;
  if (info) return <p className="text-sm text-ok" role="status">{info}</p>;
  return null;
}
