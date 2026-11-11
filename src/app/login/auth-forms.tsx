"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState } from "./actions";

const input =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export function AuthForms() {
  const [mode, setMode] = useState<"entrar" | "cadastrar">("entrar");
  const [signInState, signInAction, signingIn] = useActionState<AuthState, FormData>(signIn, {});
  const [signUpState, signUpAction, signingUp] = useActionState<AuthState, FormData>(signUp, {});
  const state = mode === "entrar" ? signInState : signUpState;
  const pending = mode === "entrar" ? signingIn : signingUp;

  return (
    <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6 shadow-sm">
      <div className="mb-6 grid grid-cols-2 rounded-md bg-muted p-1 text-sm" role="tablist">
        {(["entrar", "cadastrar"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`rounded px-3 py-1.5 font-medium ${mode === m ? "bg-surface text-brand shadow-sm" : "text-subtle"}`}
          >
            {m === "entrar" ? "Entrar" : "Criar conta"}
          </button>
        ))}
      </div>

      <form action={mode === "entrar" ? signInAction : signUpAction} className="space-y-4">
        {mode === "cadastrar" && (
          <label className="block space-y-1 text-sm">
            <span>Nome completo</span>
            <input name="fullName" required autoComplete="name" className={input} />
          </label>
        )}
        <label className="block space-y-1 text-sm">
          <span>E-mail</span>
          <input name="email" type="email" required autoComplete="email" className={input} />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Senha</span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === "entrar" ? "current-password" : "new-password"}
            className={input}
          />
        </label>

        {state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
        {state.info && <p className="text-sm text-ok" role="status">{state.info}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-60"
        >
          {pending ? "Aguarde…" : mode === "entrar" ? "Entrar" : "Criar conta"}
        </button>
      </form>
    </div>
  );
}
