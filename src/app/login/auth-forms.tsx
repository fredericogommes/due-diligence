"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState, type LoginProfile } from "./actions";

const input =
  "w-full rounded-md border border-[var(--mk-line)] bg-white px-3 py-2.5 text-sm text-[var(--mk-ink)] outline-none focus:border-[var(--mk-gold)] focus:ring-2 focus:ring-[var(--mk-gold)]/25";

const PROFILES: Record<LoginProfile, { title: string; text: string }> = {
  cliente: { title: "Sou cliente", text: "Quero solicitar e acompanhar uma due diligence" },
  equipe: { title: "Equipe do escritório", text: "Acesso administrativo (contas já existentes)" },
};

/**
 * Duas entradas: cliente (entrar ou criar conta) e equipe (só entrar; contas
 * criadas por convite). O servidor confere o vínculo real de quem entrou.
 */
export function AuthForms({ initialProfile = "cliente" }: { initialProfile?: LoginProfile }) {
  const [profile, setProfile] = useState<LoginProfile>(initialProfile);
  const [mode, setMode] = useState<"entrar" | "cadastrar">("entrar");
  const [signInState, signInAction, signingIn] = useActionState<AuthState, FormData>(signIn, {});
  const [signUpState, signUpAction, signingUp] = useActionState<AuthState, FormData>(signUp, {});
  const creating = profile === "cliente" && mode === "cadastrar";
  const state = creating ? signUpState : signInState;
  const pending = creating ? signingUp : signingIn;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mk-serif text-2xl font-bold text-[var(--mk-navy)]">Acesse sua conta</h2>
        <p className="mt-1 text-sm text-[var(--mk-ink-soft)]">Escolha como você quer entrar.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Tipo de acesso">
        {(Object.keys(PROFILES) as LoginProfile[]).map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={profile === p}
            onClick={() => {
              setProfile(p);
              if (p === "equipe") setMode("entrar");
            }}
            className={`rounded-lg border p-4 text-left transition-colors ${
              profile === p ? "border-[var(--mk-gold)] bg-[var(--mk-gold-pale)] ring-1 ring-[var(--mk-gold)]" : "border-[var(--mk-line)] bg-white hover:border-[var(--mk-gold)]/60"
            }`}
          >
            <span className="block text-sm font-semibold text-[var(--mk-navy)]">{PROFILES[p].title}</span>
            <span className="mt-0.5 block text-xs text-[var(--mk-ink-soft)]">{PROFILES[p].text}</span>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-[var(--mk-line)] bg-white p-6 shadow-sm">
        {profile === "cliente" ? (
          <div className="mb-5 grid grid-cols-2 rounded-md bg-[var(--mk-paper)] p-1 text-sm" role="tablist">
            {(["entrar", "cadastrar"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`rounded px-3 py-1.5 font-medium ${mode === m ? "bg-white text-[var(--mk-navy)] shadow-sm" : "text-[var(--mk-ink-soft)]"}`}
              >
                {m === "entrar" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>
        ) : (
          <p className="mb-5 text-xs text-[var(--mk-ink-soft)]">
            Contas da equipe são criadas por convite do administrador do escritório.
          </p>
        )}

        <form action={creating ? signUpAction : signInAction} className="space-y-4">
          <input type="hidden" name="profile" value={profile} />
          {creating && (
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Nome completo</span>
              <input name="fullName" required autoComplete="name" className={input} />
            </label>
          )}
          <label className="block space-y-1 text-sm">
            <span className="font-medium">E-mail</span>
            <input name="email" type="email" required autoComplete="email" className={input} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Senha</span>
            <input name="password" type="password" required minLength={8} autoComplete={creating ? "new-password" : "current-password"} className={input} />
          </label>

          {state.error && <p className="text-sm text-[var(--mk-danger)]" role="alert">{state.error}</p>}
          {state.info && <p className="text-sm text-[var(--mk-ok)]" role="status">{state.info}</p>}

          <button type="submit" disabled={pending} className="mk-btn-gold w-full rounded-md px-4 py-2.5 text-sm font-semibold disabled:opacity-60">
            {pending ? "Aguarde…" : creating ? "Criar conta de cliente" : profile === "equipe" ? "Entrar na gestão" : "Entrar na área do cliente"}
          </button>
        </form>
      </div>
    </div>
  );
}
