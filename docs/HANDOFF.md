# Handoff — continuidade entre sessões e agentes (Claude Code / Codex)

> Registro compartilhado do trabalho em andamento. O histórico dos chats **não** é o registro do projeto: este arquivo, `docs/SITUACAO_DO_PROJETO.md` e `docs/adr/` são.
> Antes de começar: leia `CLAUDE.md`/`AGENTS.md`, `docs/SITUACAO_DO_PROJETO.md`, os ADRs e a última entrada abaixo.

## Regras comuns (resumo)

- Um agente por cópia de trabalho. Trabalho paralelo = branch/worktree própria e módulo combinado aqui.
- Nada de migração concorrente. Migração no Supabase real (`igcyltxllpzayivykerk`) só com autorização do Fred, e na ordem dos arquivos.
- Commits só com os arquivos da tarefa (sem `git add .`). Push, merge e deploy só com autorização. Um push no `main` publica sozinho na Vercel.
- Preservar a página `/macedo-keenan` (identidade MK) e as rotas existentes. Não trocar a marca.
- Conectores reais só com documentação e autorização. IA não recebe documentos reais sem autorização do fluxo.
- Testes com dados sintéticos (`npm test` usa PGlite com as migrações reais; não toca o Supabase).

## Especificação de referência

`MK-01-Especificacao-tecnica.md` (fora do repositório, na pasta do Codex do Fred: `Documents/Codex/2026-11-14/.../outputs/`). Conflitos com o código estão no ADR-0001.

---

## Ciclo 2026-11-14 — MK Fase 1 (isolamento e autorização)

| Campo | Valor |
|---|---|
| Responsável | Claude Code (sessão do Fred) |
| Branch | `feat/mk-f1-isolamento` (local, **não enviada**) |
| Commit base | `3012e05` (main = origin/main) |
| Commits | `0536e85` fatia 1 · `cc116b8` fatia 2 · `1e2752f` fatia 3 · commit de documentação deste ciclo |
| Módulos | banco (migrações M10–M12), membros/permissões, relatório (assinatura), documentos (download), auditoria |

### Feito

1. **FKs compostas por tenant (M10):** `deals (org_id, id)` único; todas as tabelas filhas com FK `(org_id, deal_id)`. O banco recusa relação entre organizações mesmo sem o trigger.
2. **Revisor jurídico explícito (M11, ADR-0002):** assinar/revisar versão exige `memberships.legal_reviewer`; só o dono concede; administrador não é revisor automaticamente. Backfill explícito para quem já assinava. Selo e caixa na tela da organização.
3. **Auditoria de acesso a documentos (M12):** `log_document_access` autoriza no banco e registra "download" antes do link temporário.
4. Suítes novas: `tests/db/isolamento.test.ts` (gate G02: leitura, escrita, exclusão, Storage, funções, cliente convidado, revogação, FK composta, auditoria de download) e `tests/db/revisor.test.ts`.

### Testes

- `npm test`: 175 passando (antes do ciclo: 151). `npm run typecheck` e `npm run lint`: sem erros.
- Os 7 testes de FK composta **falham** sem a M10 (verificado removendo a migração temporariamente).
- `/macedo-keenan`: sem diff de código no ciclo; texto, 16 links e rolagem iguais à produção em 390, 768 e 1440 px (hash do texto visível idêntico).
- Não executado: teste no navegador das telas alteradas contra o banco real, porque as migrações M10–M12 **não foram aplicadas** no Supabase.

### Pendências e bloqueios

- **Aplicar M10, M11 e M12 no Supabase** antes de levar a branch ao `main`: o download de documentos passa a chamar `log_document_access`, que não existe no banco atual. Requer autorização do Fred.
- Push/merge da branch: requer autorização.
- IA real: falta `ANTHROPIC_API_KEY` e avaliação do fluxo de dados (MK-01 §7).
- Fontes de certidão reais: Direct Data e ONR dependem de contrato/chave.
- E-mail de cadastro: SMTP próprio no Supabase.

### Reversão

Reverter os três commits da branch e, se as migrações tiverem sido aplicadas, executar a reversão descrita no topo de cada arquivo `supabase/migrations/2026111410*`–`2026111412*`.

### Próximas fatias (ordem MK-01)

1. Fase 1 (resto): convite com expiração já existe; falta revogar convites/sessões ao remover membro (sessão Supabase segue válida, mas a RLS já nega dados) e permissões de gestor/auditor.
2. Fase 2: transições de etapa como comandos com pré-condições; operação com múltiplos imóveis já existe (bens N por negócio).
3. Fase 3: `document_versions` imutáveis, validação real de MIME (assinatura do arquivo), quarentena, categorias e retenção.

---

## Ciclo 2026-11-14 (cont.) — MK Fase 3, fatia 1: validação real do arquivo enviado

| Campo | Valor |
|---|---|
| Responsável | Claude Code |
| Branch | `feat/mk-f3-documentos` (local, **empilhada** sobre `feat/mk-f1-isolamento`; não enviada) |
| Módulos | documentos (registro de upload) |

**Feito:** `registerDocument` baixa o objeto recém-enviado e confere no servidor tamanho, **tipo real pelos primeiros bytes** (PDF, JPG, PNG, WEBP) e hash SHA-256; grava tipo, tamanho e hash calculados no servidor; recusa e apaga do Storage o que não confere (`src/lib/file-signature.ts`). Sem migração.

**Testes:** `tests/file-signature.test.ts` (6). No navegador contra o Supabase: HTML renomeado para `.pdf` foi recusado e não ficou no Storage nem no banco; PDF verdadeiro anexado com hash gravado.

**Reversão:** reverter o commit (só código).

**Próximo na Fase 3:** `document_versions` imutáveis (nova versão sem apagar a anterior), quarentena antes de liberar para IA, categorias documentais e política de retenção (depende do jurídico da MK).

---

## Ciclo 2026-11-14 (madrugada) — afinar para a entrega

| Campo | Valor |
|---|---|
| Responsável | Claude Code |
| Branch | `feat/mk-entrega` (local, **contém tudo**: Fase 1 + Fase 3 + este ciclo; não enviada) |
| Commit base | `3012e05` (main) |

**Commits deste ciclo:** `b76b9d0` telas de erro/404/carregamento · `5668a41` aviso de evidência nova após versão revisada/assinada · `d41380a` estados dos achados com justificativa (M13) · `606cd72` versões de documentos (M14).

**Testes:** `npm test` 195 passando; typecheck, lint e build ok. No navegador (contra o Supabase atual, sem as migrações novas): aviso de evidência nova aparece no negócio e no relatório; página 404 em português; `/macedo-keenan` idêntica (hash do texto, 16 links, sem rolagem lateral) em 390/768/1440. **Não testado no navegador:** ações de estado de achado e "Nova versão" de documento, porque dependem de M13/M14 no banco.

### Para publicar (precisa de autorização do Fred)

1. Aplicar no Supabase, nesta ordem: `20261114100000_m10`, `…110000_m11`, `…120000_m12`, `…130000_m13`, `…140000_m14` (todas aditivas; reversão no topo de cada arquivo).
2. Testar no navegador: abrir documento (M12), assinar com revisor (M11), mudar estado de achado (M13), enviar nova versão (M14).
3. Juntar `feat/mk-entrega` ao `main` e enviar (publica na Vercel).

**Atenção:** a branch **não pode ir ao `main` antes das migrações**: abrir documento (M12), anexar documento (coluna `supersedes_id`, M14) e a tela de membros (M11) dependem delas.

**Relatório (Fase 6), sem migração:** seções "Fontes consultadas" (documento, origem, data, natureza: certidão oficial, visualização ou anexo) e "Limitações da análise" (inclui "ausência de registro não comprova ausência de risco", aviso de documentos fictícios do provedor simulado e de apontamentos ainda propostos). Ligadas por `showScope` só nas telas do sistema; `/macedo-keenan` e `/demo` não mudam (verificado: hash do texto igual).

### Próximas fatias

- IA com citação por página e incerteza (Fase 4) — depende da chave Anthropic e da avaliação do fluxo de dados.
- Transições de etapa com pré-condições (Fase 2), checklists por segmento (rural, terreno, empreendimento).
- Relatório: seção de limitações da análise e fontes consultadas (Fase 6).

---

## Publicação 2026-11-14 (autorizada pelo Fred)

- Migrações M10–M14 aplicadas no Supabase (`igcyltxllpzayivykerk`), na ordem, depois de conferir zero divergências de `org_id` entre negócios e tabelas filhas.
- Teste no navegador contra o banco migrado: abrir documento (gera evento "download"), apontamento mitigado com justificativa, nova versão de documento (versão 2 + anterior guardada), caixas de revisor jurídico na organização.
- `feat/mk-entrega` juntada ao `main` por fast-forward (commit `0a62d99`); CI verde; Vercel publicou em produção.
- Produção conferida: Gestão, Quadro e Negócios sem rolagem lateral; `/macedo-keenan` com o mesmo hash de texto e 16 links em 390/768/1440.
- Aviso do Supabase em aberto: proteção contra senhas vazadas desligada (Auth → Password security), ajuste de painel do dono.

---

## Ciclo 2026-11-14 (tarde) — página principal MK e login por perfil (pedido do Fred)

| Campo | Valor |
|---|---|
| Branch | `feat/mk-portal-login` (local; base `9e67d36`) |
| Migração | `20261114150000_m15_cadastro_publico_cliente.sql` (**não aplicada**: aguardando autorização) |

- `/` = página da MK (reexporta `/macedo-keenan`, que continua no ar). A antiga página de organizações foi para `/organizacoes` (links ajustados).
- Cabeçalho MK com "Entrar"; herói com "Solicitar due diligence" (`/login?perfil=cliente`).
- `/login` no visual MK: "Sou cliente" (entrar ou criar conta) e "Equipe do escritório" (só entrar). O servidor decide o destino pelos vínculos reais: equipe → `/gestao`; cliente → `/minhas-solicitacoes`; conta de cliente na aba da equipe é recusada.
- M15: `organizations.accepts_public_clients` + `join_public_client_org()`. Cliente que cria conta vira cliente do escritório marcado. Equipe não vira cliente.
- Testes: 200 passando; no navegador, os 4 cenários de login e a raiz MK conferidos.
- **Publicado em 15/11/2026** com autorização do Fred: M15 aplicada; escritório de demonstração renomeado para "Macedo & Keenan Advogados (demonstração)" e marcado como público; `main` = `729ff92`. Conferido em produção: raiz MK, 4 cenários de login e um cliente novo (`teste.novocliente@…`) entrando pela área do cliente e caindo em "Minhas solicitações". Cadastro de cliente novo por e-mail real ainda depende de SMTP próprio ou de desligar "Confirm email" no Supabase.
