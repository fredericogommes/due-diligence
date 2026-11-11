# Due Diligence

Ferramenta para corretores e advogados montarem o **relatório preliminar de due diligence** de um negócio (imóvel ou empresa), a partir de certidões e documentos oficiais.

Stack: Next.js 16 (App Router) + TypeScript + Tailwind, Supabase (Postgres, Auth, Storage, RLS), deploy na Vercel.

## Etapas

| Etapa | Entrega | Situação |
|---|---|---|
| M0 | Login, organizações (escritório/imobiliária), membros e papéis, RLS | ✅ código e testes |
| M1 | Negócios, partes e bens; modelos de checklist (imóvel; cotas/trespasse) | — |
| M2 | Upload de documentos por item, status manual e validade | — |
| M3 | Leitura das certidões por IA, sugestão de status e riscos | — |
| M4 | Relatório preliminar em PDF (formato do parecer TETTU) | — |
| M5 | Integrações de certidões (ONR/registrodeimoveis.org.br, provedores) | — |

## Rodar localmente

1. Crie um projeto no [Supabase](https://supabase.com) — região **South America (São Paulo)**, por causa da LGPD.
2. Aplique as migrações de `supabase/migrations/` em ordem. Pelo painel: **SQL Editor** → cole o arquivo → Run. Ou pela CLI:
   ```bash
   npx supabase login
   npx supabase link --project-ref SEU_PROJECT_REF
   npx supabase db push
   ```
3. Copie `.env.example` para `.env.local` e preencha a URL e a chave publicável (Project Settings → API Keys).
4. Em **Authentication → URL Configuration**, cadastre `http://localhost:3100/auth/confirm` (e depois o domínio da Vercel) nas Redirect URLs.
5. Rode:
   ```bash
   npm install
   npm run dev -- -p 3100
   ```

## Testes

```bash
npm test          # vitest: validações + RLS do banco
npm run typecheck
npm run lint
npm run build
```

Os testes de banco rodam as **migrações reais** num Postgres em memória (PGlite) com um esqueleto do Supabase (`auth.uid()`, papéis `anon`/`authenticated`) — veja `tests/db/harness.ts`. Não precisa de Docker.

## Deploy na Vercel

Importe o repositório na Vercel e configure as variáveis `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `NEXT_PUBLIC_SITE_URL` (o domínio do app).

## Estrutura

```
src/app/              páginas (login, início) e Server Actions
src/app/auth/confirm  retorno do link de confirmação de e-mail
src/lib/supabase/     clientes do Supabase (servidor e proxy)
src/lib/validation.ts validações (zod), CNPJ
src/proxy.ts          renova a sessão e manda quem não está logado para /login
supabase/migrations/  SQL do banco + políticas RLS
tests/                vitest (tests/db = RLS)
```

## Segurança

- Toda tabela tem RLS; o acesso é por organização (`is_org_member`, `has_org_role`).
- Organização só é criada pela função `create_organization`, que torna o criador dono.
- A organização nunca fica sem dono (trigger `memberships_keep_owner`).
- O proxy é só checagem otimista; cada Server Action confere o usuário no servidor.
