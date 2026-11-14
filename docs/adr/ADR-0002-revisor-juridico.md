# ADR-0002 — Revisor jurídico como permissão explícita

- **Status:** aceito (14/11/2026) — migração M11, commit cc116b8.
- **Contexto:** até a M6, dono, administrador e advogado revisavam e assinavam versões do relatório só pelo papel. A MK-01 (§5) pede que o administrador **não** receba aprovação jurídica automaticamente.

## Opções

1. Novo valor `revisor` no enum `member_role` — uma pessoa só tem um papel; um advogado-administrador perderia um dos dois.
2. **Permissão booleana `memberships.legal_reviewer`**, independente do papel.
3. Tabela de permissões granulares (`roles/permissions`) — mais flexível, mas grande demais para esta fatia.

## Decisão

Opção 2. Regras (trigger `memberships_legal_reviewer` + função `is_legal_reviewer`):

- Revisar e assinar versão exige `legal_reviewer = true` (e não ser cliente).
- Só o **dono** concede ou retira; o valor enviado ao criar o vínculo é ignorado. Advogado nasce revisor; dono, administrador e corretor não.
- Mudar o papel para cliente retira a permissão.
- Toda mudança fica no `audit_log` (campo "permissão de revisor jurídico").

**Backfill:** vínculos existentes owner/admin/advogado receberam `true` de forma explícita, para não tirar de ninguém, sem aviso, a capacidade que já tinham. O dono pode retirar na tela da organização.

## Em aberto

- Segregação autor × aprovador (quem salvou a versão não pode assiná-la) — proposta da MK-01 "por padrão". Não aplicada ainda porque escritórios pequenos podem ter um só advogado; decidir com o jurídico da MK.
- Migrar para permissões granulares (opção 3) quando surgirem gestor, auditor e suporte.

## Reversão

Remover o trigger e as funções novas, recriar `report_versions_before_update` da M6 e remover a coluna `legal_reviewer`.
