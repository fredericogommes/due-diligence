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
