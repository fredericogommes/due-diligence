# Situação do projeto — Due Diligence

> **Para quem chega agora (pessoa ou Claude):** este arquivo resume o estado do projeto em **11/11/2026** e o que falta
> para concluí-lo. Leia este arquivo e depois o [README](../README.md). A conversa original que construiu o projeto
> está em [`docs/conversa/CONVERSA.md`](conversa/CONVERSA.md); comece por ela se precisar do PRD completo ou do motivo de uma decisão.

## 1. O que é

É uma ferramenta web para **corretores e advogados**. Ela monta o **relatório preliminar de due diligence** de um negócio a partir de certidões e documentos oficiais. O relatório cobre o bem e as partes envolvidas.

- **Contexto:** jurídico imobiliário de TETTU / Redeplan / Macedo e Keenan.
- **Modelos usados:**
  - o parecer de due diligence da TETTU para a AME Clínica Veterinária (31/08/2026);
  - o checklist de cotas sociais da TETTU (27/08/2026).
- **Onde está o PRD:** foi gerado pela Tech4You em 10/11/2026 e colado na primeira mensagem da conversa (seções 1–8, inclusive as instruções de processo).

**Tipos de negócio que o app atende:**
- compra e venda de imóvel;
- cessão de cotas / trespasse.

**Fluxo:**
1. cadastrar o negócio, as partes e os bens;
2. o checklist é gerado automaticamente;
3. anexar as certidões;
4. a IA lê cada documento e aponta riscos;
5. sai um relatório no formato do parecer TETTU, com conclusão sugerida e um parecer editável;
6. imprimir ou salvar em PDF.

## 2. Estado atual (resumo honesto)

| Item | Estado |
|---|---|
| Código das etapas M0–M6 | **Pronto e commitado** (branch `main`, sem remoto) |
| Testes automáticos | **122 passando** (`npm test`), além de typecheck, lint e build sem erros |
| Banco Supabase real | **Não existe ainda.** As migrações só rodaram no PGlite (Postgres em memória) dentro dos testes |
| Login, cadastro, upload e IA no navegador | **Nunca testados de ponta a ponta**, porque dependem do Supabase real |
| Tela verificada no navegador | `/demo/relatorio` (relatório com dados fictícios, só em desenvolvimento) e o redirecionamento para `/login` |
| Leitura por IA | Implementada e testada com dublê. **Nunca chamou a API real** (falta `ANTHROPIC_API_KEY`) |
| Certidões online (ONR) | Arquitetura pronta; o provedor fica **desativado de propósito** até chegarem a chave e a documentação oficial |
| Deploy (Vercel) | **Não feito** |
| GitHub / CI | Workflow pronto em `.github/workflows/ci.yml` (lint, typecheck, testes, build, gitleaks). **Falta criar o repositório** e enviar o código |

`.env.local` existe, mas tem apenas os **valores de exemplo** (`https://SEU-PROJETO...`). Ele não vai no backup e não está no Git.

## 3. Stack e decisões técnicas

- **Next.js 16.4.6** (App Router), React 19.3, TypeScript, Tailwind 4. Esta versão do Next mudou bastante; leia o `AGENTS.md`.
  - O antigo `middleware` agora é `src/proxy.ts`.
  - Com cache components / PPR, dados dinâmicos precisam ficar dentro de `<Suspense>`.
  - Tipos `PageProps<"/rota">` e `LayoutProps`, gerados por `next typegen`.
  - A documentação da versão instalada fica em `node_modules/next/dist/docs/`.
- **Supabase** via `@supabase/ssr`: Postgres, Auth (e-mail e senha), Storage (bucket privado `documentos`) e RLS em toda tabela.
- **zod v4** para validação (`z.uuid()`, `z.email()`, `z.iso.date()`).
- **IA: Anthropic SDK 1.8**.
  - Chamada: `client.beta.messages.parse` com `betaZodOutputFormat`, modelo `claude-opus-5-5` (configurável por `ANTHROPIC_MODEL`).
  - O PDF vai como bloco `document` em base64, com `effort: "medium"` e fallback de servidor.
  - Código em `src/lib/analysis/extract.ts`.
- **Testes:** Vitest 5 + PGlite. `tests/db/harness.ts` cria um esqueleto do Supabase (`auth.users`, `auth.uid()`, papéis `anon`/`authenticated`, `storage.objects`) e aplica as **migrações reais**. Não precisa de Docker, que não está instalado no PC do dono.
- **Relatório:** página HTML com CSS de impressão A4; o "PDF" sai pela impressão do navegador. Não há gerador de PDF no servidor.
- **Porta de desenvolvimento: 3100** (`npm run dev -- -p 3100`). No PC do dono a porta 3000 é de outro projeto.
- **Arquivos com acentos:** os fontes são UTF-8 com fim de linha LF. No Windows, **não edite com `Set-Content`/`Get-Content` do PowerShell 5.1**, porque eles corrompem os acentos. Use um editor normal, ou Python com `encoding="utf-8"`.

### Decisões de produto tomadas na conversa

O dono respondeu "Sim, siga" às suposições propostas. Daí saíram estas decisões:

1. **Certidões entram por upload.** A integração com cartório fica atrás de uma camada de provedores (`src/lib/certidoes/providers.ts`).
   - O registrodeimoveis.org.br / ONR **não tem API pública documentada**.
   - O portal tem um botão "Solicitar chave de API" na calculadora de emolumentos, mas não se sabe se essa API faz pedido de certidão ou só calcula valores.
   - **Regra:** não inventar endpoints e não burlar captcha. As demais certidões (Receita/PGFN, TST, TJ, TRF, TRT) têm captcha.
2. **Status dos itens:** faltante, parcial, completo ou dispensado. "Vencido" é calculado pela validade.
3. **Validade de um documento:**
   - vale a data impressa no documento;
   - sem ela, data de emissão + `validity_days` do item do modelo;
   - "a vencer" quando faltam 7 dias ou menos.
4. **A IA nunca decide sozinha.**
   - Ela não sobrescreve o que o usuário digitou.
   - Ela não muda o status do item: só sugere, e o usuário clica em "aplicar".
   - O relatório é sempre um rascunho para revisão de um advogado.
5. **Conclusão sugerida** (`src/lib/report/build.ts`, função `suggestConclusion`):
   - algum risco crítico em aberto → inviável;
   - algum item obrigatório faltante ou documento vencido → incompleta;
   - algum item parcial ou risco alto/médio → viável com ressalvas;
   - nos demais casos → viável.
6. **Multi-organização** (escritório ou imobiliária), com RLS por `org_id` e papéis owner, admin, advogado e corretor.
7. **Dados no Supabase em São Paulo**, por causa da LGPD: há CPF, estado civil e documentos pessoais.

### Perguntas que o dono **não** respondeu explicitamente (continuam em aberto)

- O produto é de uso interno (TETTU/M&K) ou será vendido a vários escritórios, com cobrança? O código já é multi-organização, mas não tem cobrança.
- Quem paga os emolumentos das certidões pedidas online?
- Identidade visual: padrão TETTU (Calibri, marinho e roxo) ou marca própria? Hoje o app tem um tema neutro, com tokens em `src/app/globals.css`.
- Convênio com o ONR ou um provedor pago (ex.: Infosimples) para as certidões?

## 4. O que cada etapa entregou

| Etapa | Commit | Entrega |
|---|---|---|
| M0 | `0d24a51` | Login, cadastro e confirmação por e-mail; organizações; papéis; RLS; `create_organization` (o criador vira dono e a organização nunca fica sem dono) |
| M1 | `cc574e7` | Negócios, partes (PF/PJ, papel, estado civil, regime de bens) e bens (imóvel/empresa). O checklist é gerado por trigger a partir do modelo. Modelos: **IMV-CV-v1** (25 itens) e **TETTU-COTAS-v1** (35 itens) |
| M2 | `1240051` | Upload para o Storage (`<org>/<negócio>/<uuid>-arquivo`, até 20 MB, PDF/imagem). Liga o arquivo ao item, calcula a validade e trata documentos fora do checklist |
| M3 | `287d785` | "Ler com IA": tipo, emissor, datas, resultado, ônus e divergências. Gera riscos (`findings`) com gravidade e permite riscos manuais |
| M4 | `f53fccf` | Relatório no formato do parecer TETTU, conclusão sugerida, parecer editável (`deal_opinions`) e impressão em A4 |
| M6 | (ver git log) | Gestão de membros (convites pelo e-mail da pessoa, troca de papel, remoção, sair), log de auditoria (`audit_log`, só nomes dos campos alterados, sem valores) e versões do relatório (`report_versions`: rascunho → revisado → assinado, conteúdo congelado em `snapshot`) |
| M5 | `cfa7daa` | Pedidos de certidão (`certificate_requests`) com protocolo e consulta. Provedores: ONR (desativado, mostra o motivo) e simulado (PDF fictício, desligado em produção) |

## 5. Mapa do código

```
supabase/migrations/      8 migrações, aplicar EM ORDEM (m0 → m6)
src/proxy.ts              proteção otimista das rotas (redireciona para /login)
src/app/                  login, auth/confirm, página inicial (organizações)
src/app/negocios/         lista, novo, [id] (detalhe), [id]/historico, [id]/relatorio e [id]/relatorio/versoes/[n]; *-actions.ts = Server Actions
src/app/organizacoes/     [id] = membros, convites e histórico da organização
src/app/demo/relatorio    relatório fictício (fora de produção)
src/lib/checklist/        montagem do checklist (build.ts) e validade (validity.ts)
src/lib/analysis/         schema zod da extração, chamada à IA, geração de riscos
src/lib/report/           modelo do relatório e conclusão sugerida
src/lib/certidoes/        provedores, dados do "sujeito" da certidão, gerador de PDF simples
src/lib/deals/load.ts     carrega tudo de um negócio de uma vez
src/lib/supabase/         clientes do servidor, do navegador e do proxy
tests/                    unitários; tests/db = banco e RLS sobre as migrações reais
```

**Tabelas** (todas com RLS por organização):
- `profiles`, `organizations`, `memberships`
- `checklist_templates`, `template_items`
- `deals`, `parties`, `assets`, `deal_items`, `documents`, `document_analyses`, `findings`, `deal_opinions`, `certificate_requests`
- `invitations`, `report_versions`, `audit_log` (M6)
- **Herança de organização:** o `org_id` das tabelas filhas é herdado do negócio por trigger e nunca vem do cliente.

## 6. O que falta para concluir

### A. Bloqueante: depende do dono do projeto
1. **Criar o projeto no Supabase** (região South America / São Paulo).
   - Aplicar as migrações: SQL Editor em ordem, ou `npx supabase link` + `npx supabase db push`.
   - Preencher o `.env.local` (`.env.example` mostra os campos).
   - Cadastrar `http://localhost:3100/auth/confirm` em Authentication → URL Configuration.
2. **`ANTHROPIC_API_KEY`** para ligar a leitura por IA. Registrar a base legal de LGPD, porque os documentos vão para a API da Anthropic.
3. **Chave e documentação da API do registrodeimoveis.org.br.** O texto do pedido está pronto em [`PEDIDO_CHAVE_REGISTRO_IMOVEIS.md`](PEDIDO_CHAVE_REGISTRO_IMOVEIS.md).

### B. Trabalho técnico que vem logo depois do Supabase
1. **Teste de ponta a ponta no navegador com o Supabase real.** O roteiro:
   1. cadastro e confirmação por e-mail;
   2. criar organização;
   3. criar um negócio de cada tipo;
   4. cadastrar partes e bens e ver o checklist;
   5. upload, download pelo link temporário e validade;
   6. "Ler com IA" com uma certidão de verdade;
   7. riscos;
   8. relatório e impressão;
   9. pedido no provedor simulado.

   Corrigir o que aparecer. Pontos de maior risco:
   - políticas do Storage com o Supabase real;
   - trigger `handle_new_user`;
   - `getClaims` com chave publicável nova.
2. **Deploy na Vercel**, com as mesmas variáveis e `NEXT_PUBLIC_SITE_URL` no domínio final. A tela do negócio declara `maxDuration = 300` (o limite real depende do plano).
3. **GitHub privado + CI** (lint, typecheck, test, build) e varredura de segredos.

### C. Funcionalidades que ainda não existem
- **Convite por e-mail automático:** hoje o convite fica no sistema e o dono avisa a pessoa; não há envio de e-mail (precisaria de um serviço como Resend ou do `inviteUserByEmail` com chave de serviço).
- **PDF assinado guardado na versão:** cada versão congela o conteúdo e imprime sempre igual, mas o PDF com assinatura digital (ICP-Brasil) não é anexado à versão.
- **Retenção do log de auditoria:** o log cresce sem limite; definir prazo de guarda junto com a política de LGPD.
- **Provedor ONR real** (`registroImoveisProvider.request`/`poll` em `src/lib/certidoes/providers.ts`), depois da documentação oficial.
- **Outro provedor** (ex.: Infosimples), se o dono escolher esse caminho.
- **Identidade visual** definitiva (ver as perguntas em aberto).
- **Novos modelos de checklist:** entram por migração SQL (`checklist_templates` + `template_items`).
- **LGPD:** política de retenção e exclusão de documentos; termo/aviso ao cliente final.

## 7. Como rodar

```bash
npm install
npm test            # 94 testes, inclusive banco/RLS em PGlite — não precisa de Supabase
npm run typecheck
npm run lint
npm run build
npm run dev -- -p 3100   # http://localhost:3100/demo/relatorio funciona sem Supabase
```

Node usado: **v24**.

## 8. Regras de trabalho combinadas com o dono

- **Idioma:** comunicação e interface em português do Brasil; código e nomes em inglês.
- **Etapas:** o projeto foi feito por etapas (M0…M5), cada uma testável e com commit próprio. O dono autorizou seguir sem parar entre etapas.
- **Chamadas externas:** nunca inventar endpoints de terceiros nem burlar captcha.
- **Verificação:** não afirmar que algo funciona sem ter verificado. Se não foi testado, dizer que não foi.
