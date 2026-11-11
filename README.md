# Due Diligence

Ferramenta para corretores e advogados montarem o **relatório preliminar de due diligence** de um negócio (compra e venda de imóvel ou cessão de cotas / trespasse), a partir de certidões e documentos oficiais.

Stack: Next.js 16 (App Router) + TypeScript + Tailwind, Supabase (Postgres, Auth, Storage, RLS), Claude (leitura de documentos), deploy na Vercel.

## O que o sistema faz

| Etapa | Entrega |
|---|---|
| M0 | Login (e-mail e senha), organizações (escritório/imobiliária), membros e papéis, RLS |
| M1 | Negócios, partes e bens; checklist gerado automaticamente pelo modelo do negócio |
| M2 | Upload de documentos (PDF/imagem) por item, validade (impressa ou prazo de referência), documentos fora do checklist |
| M3 | Leitura das certidões por IA: tipo, emissor, datas, resultado, ônus e divergências; riscos e apontamentos |
| M4 | Relatório preliminar no formato do parecer de análise documental, com conclusão sugerida e parecer editável; imprimir/salvar em PDF |
| M5 | Pedido de certidões online por provedores (Registro de Imóveis — aguardando chave; simulado para testes) |

### Modelos de checklist

- **Compra e venda de imóvel** (25 itens): certidões do imóvel (matrícula com ônus, IPTU, título anterior…), do vendedor PF e cônjuge (CND federal, CNDT, distribuidores estadual/federal/trabalhista, protestos…), do vendedor PJ, identificação do comprador e procuração. Os itens aparecem conforme você cadastra bens e partes.
- **Cessão de cotas / trespasse (TETTU)** (35 itens): societário, regulatório/sanitário, fiscal, trabalhista, forense, imóvel e ativos, contábil-financeiro — o checklist da TETTU de 27/08/2026.

Novos modelos entram por migração SQL (`checklist_templates` + `template_items`).

### Conclusão sugerida (regras)

1. Algum risco **crítico** em aberto → **não recomendada**.
2. Item obrigatório **faltante** ou item atendido com documento **vencido** → **incompleta**.
3. Item **parcial** ou risco **alto/médio** em aberto → **viável com ressalvas**.
4. Caso contrário → **viável**.

O responsável pode trocar a conclusão e escrever o parecer na tela do relatório.

## Configurar

1. Crie um projeto no [Supabase](https://supabase.com) — região **South America (São Paulo)**, por causa da LGPD.
2. Aplique as migrações de `supabase/migrations/` **em ordem** (SQL Editor → cole cada arquivo → Run), ou pela CLI:
   ```bash
   npx supabase login
   npx supabase link --project-ref SEU_PROJECT_REF
   npx supabase db push
   ```
3. Copie `.env.example` para `.env.local` e preencha.
4. Em **Authentication → URL Configuration**, cadastre `http://localhost:3100/auth/confirm` e, depois, `https://SEU-DOMINIO/auth/confirm`.
5. Rode:
   ```bash
   npm install
   npm run dev -- -p 3100
   ```

### Variáveis de ambiente

| Variável | Obrigatória | Para quê |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | sim | Conexão com o Supabase |
| `NEXT_PUBLIC_SITE_URL` | sim | Link de confirmação de e-mail |
| `ANTHROPIC_API_KEY` | não | Ativa a leitura de documentos por IA |
| `ANTHROPIC_MODEL` | não | Modelo (padrão `claude-opus-5-5`) |
| `REGISTRO_IMOVEIS_API_URL`, `REGISTRO_IMOVEIS_API_KEY` | não | Integração com o registrodeimoveis.org.br (ver abaixo) |
| `CERTIDOES_SIMULADO` | não | `1` liga o provedor simulado também em produção (só para demonstração) |

## Certidões online (M5)

A camada `src/lib/certidoes/providers.ts` define provedores com a mesma interface: quais itens atendem, que dados faltam, `request` e `poll` (para pedidos com protocolo). Quando a certidão chega, o PDF vai para o Storage e é anexado ao item como documento de origem "api".

- **Registro de Imóveis do Brasil (ONR / registrodeimoveis.org.br)** — atende o item `IMV-01` (matrícula). A chave é pedida no próprio portal (“Solicitar chave de API”, na calculadora). **Enquanto a chave e a documentação oficial não chegarem, o provedor aparece desativado com o motivo** — não chamamos endpoints não documentados. Ao receber a documentação, implemente `request`/`poll` nesse provedor.
- **Simulado** — gera uma certidão negativa fictícia em PDF ("sem valor legal") para testar o fluxo. Desligado em produção.

## Leitura por IA e LGPD

Com `ANTHROPIC_API_KEY`, o botão **Ler com IA** envia o arquivo à API da Anthropic, que devolve os campos estruturados (tipo, emissor, datas, resultado, apontamentos, se corresponde ao item e o status sugerido). Os dados que o usuário já informou nunca são sobrescritos; o status do item só muda quando o usuário clica em "aplicar". Certidões têm dados pessoais (CPF, estado civil): registre a base legal e informe o cliente.

## Testes

```bash
npm test          # vitest: regras, relatório, IA (com dublê), provedores e RLS do banco
npm run typecheck
npm run lint
npm run build
```

Os testes de banco aplicam as **migrações reais** num Postgres em memória (PGlite) com um esqueleto do Supabase (`auth.uid()`, papéis `anon`/`authenticated`, `storage.objects`) — veja `tests/db/harness.ts`. Não precisa de Docker.

Em desenvolvimento, `/demo/relatorio` mostra um relatório completo com dados fictícios.

## Deploy na Vercel

Importe o repositório na Vercel e configure as variáveis acima. A tela do negócio declara `maxDuration = 300` para a leitura por IA de PDFs grandes (o limite efetivo depende do plano da Vercel).

## Estrutura

```
src/app/negocios/            lista, novo, detalhe ([id]) e relatório ([id]/relatorio)
src/app/negocios/*-actions   Server Actions (negócios, documentos, IA, riscos, certidões)
src/lib/checklist/           montagem do checklist e regras de validade
src/lib/analysis/            leitura por IA (schema, extração, apontamentos)
src/lib/report/              modelo do relatório e conclusão sugerida
src/lib/certidoes/           provedores de certidão e gerador de PDF simples
src/lib/supabase/            clientes do Supabase (servidor, navegador, proxy)
supabase/migrations/         SQL do banco + RLS + Storage + modelos
tests/                       vitest (tests/db = banco e RLS)
```

## Segurança

- Toda tabela tem RLS por organização (`is_org_member`, `has_org_role`); o `org_id` das tabelas filhas é sempre herdado do negócio por trigger.
- Arquivos num bucket privado; caminho `<org>/<negócio>/…`, com política de Storage pelo primeiro segmento; links de download temporários (5 min).
- Organização só é criada pela função `create_organization`; nunca fica sem dono.
- O proxy é checagem otimista; cada Server Action confere o usuário no servidor.
