# ADR-0001 — Adaptação da especificação MK-01 ao código existente

- **Status:** aceito (14/11/2026)
- **Contexto:** a especificação `MK-01-Especificacao-tecnica.md` (v1.0, 14/11/2026) foi escrita **sem acesso ao repositório** (ela própria registra isso no §1). Descreve um alvo; não prova o que existe. O código deste repositório é a fonte do estado atual.

## Conflitos e decisões

| # | Especificação MK-01 | Código existente | Opções | Impacto | Decisão |
|---|---|---|---|---|---|
| 1 | Stack aberta; sugere monólito modular, API REST `/v1`, PostgreSQL, fila/outbox | Next.js 16 (App Router, Server Actions) + Supabase (Postgres, Auth, Storage, RLS), deploy Vercel | (a) manter; (b) criar API REST separada | (b) duplicaria autenticação e regras | **(a) manter.** Server Actions são a "API" interna. A API B2B `/v1` fica para a fase F6, como Route Handlers no mesmo projeto. |
| 2 | Coluna `tenant_id` em todas as tabelas | Coluna `org_id` (organização = tenant) em todas as tabelas de negócio, com RLS | (a) renomear; (b) manter `org_id` | Renomear quebraria migrações, tipos e testes sem ganho | **(b) `org_id` = tenant_id.** |
| 3 | FKs compostas `(tenant_id, id)` | `org_id` herdado do negócio por trigger | (a) só trigger; (b) trigger + FK composta | (b) garante no banco | **(b)** — migração M10 (fatia 1). Relações entre filhos do mesmo negócio (documento↔item, achado↔documento) seguem por trigger de "mesmo negócio" (M2/M3/M5); FK composta nelas fica como melhoria futura. |
| 4 | Perfis: admin, gestor, analista, revisor jurídico, solicitante, cliente convidado, auditor, suporte, serviço | Enum `member_role`: owner, admin, advogado, corretor, cliente | (a) trocar o enum; (b) manter papéis e acrescentar permissões explícitas | (a) mexe em políticas e dados existentes | **(b).** Mapeamento: owner/admin = administrador; advogado = analista; corretor = solicitante; cliente = cliente convidado. Revisor jurídico = permissão explícita `legal_reviewer` (ADR-0002). Gestor, auditor, suporte e serviço: backlog. |
| 5 | Estados da operação `draft … closed/cancelled` | `deals.status` (rascunho, em_analise, concluido, cancelado) + `deals.stage` do kanban (qualificacao, consulta, analise, emissao, concluido) | (a) trocar pelos estados da MK-01; (b) manter e mapear | (a) quebraria quadro, gestão e painel do cliente | **(b) manter**, com o mapeamento: draft/collecting ≈ qualificacao; analyzing/pending_information ≈ consulta+analise; in_review/approved ≈ versão do relatório revisado/assinado; delivered ≈ emissao; closed ≈ concluido. Transições "como comandos auditados" já são auditadas (audit_log); validação de pré-condições por transição é backlog. |
| 6 | `documents` + `document_versions` imutáveis | Cada arquivo é uma linha de `documents` (caminho, sha256, origem, datas); `storage_path` e `deal_id` não mudam após gravados; não há cadeia de versões | (a) criar `document_versions`; (b) manter | (a) é o caminho certo, mas exige migrar uploads e telas | **Backlog da Fase 3** (próxima fatia de documentos). Até lá, nova versão = novo documento no mesmo item. |
| 7 | Achados com estados `proposed … dismissed` e `finding_evidence` | `findings` com `resolved` (bool), `source` (ia/manual/consulta), ligação a documento/item/análise | (a) estados completos; (b) manter | — | **Backlog da Fase 5.** |
| 8 | Revisão referencia snapshot imutável | `report_versions.snapshot` (jsonb imutável, M6); assinatura exige revisor | — | — | **Já atende** a parte de snapshot. Invalidação automática quando chega evidência material nova: backlog (Fase 5). |
| 9 | Conectores desligados até autorização | Provedor ONR desligado com motivo; provedor simulado marcado "sem valor legal" | — | — | **Já atende.** Simulado continua ligado só em demonstração (`CERTIDOES_SIMULADO=1`). |
| 10 | IA: citações por documento/versão/página, incerteza, revisão | Leitura por IA com schema zod; IA não muda status sozinha; sem citação por página | — | — | **Backlog da Fase 4.** A IA real continua desligada (sem `ANTHROPIC_API_KEY`) e não recebe documentos reais sem autorização. |
| 11 | "Landing MK" a preservar | O site institucional fica em macedokeenan.adv.br (fora deste repositório). Aqui existe a página de demonstração `/macedo-keenan` (PR #1), com cabeçalho/rodapé no visual do site e fluxo fictício no navegador | — | — | **Preservar `/macedo-keenan` sem alteração** (zero mudanças intencionais). O site externo não é editado por este projeto. |
| 12 | Marca | Interface interna com nome "Due Diligence"; `/macedo-keenan` com a marca MK | — | — | Nenhuma troca de marca. Não usar Tech4You na interface. |

## Consequências

- Nomes e contratos existentes ficam estáveis; novos recursos entram como migrações aditivas.
- Cada fase da MK-01 é dividida em fatias pequenas, registradas em `docs/HANDOFF.md`.
