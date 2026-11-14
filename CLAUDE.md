@AGENTS.md

# Due Diligence — instruções para o Claude

Antes de qualquer trabalho, leia **`docs/SITUACAO_DO_PROJETO.md`**. Ele diz o estado do projeto, as decisões tomadas e o que falta para concluir.
A conversa que construiu o projeto está em `docs/conversa/CONVERSA.md`, com o PRD completo na primeira mensagem.

- Fale com o dono em português do Brasil. Código e nomes de variáveis em inglês.
- Trabalhe por etapas testáveis. Antes de declarar uma etapa pronta, rode `npm test`, `npm run typecheck`, `npm run lint` e `npm run build`.
- Não afirme que algo funciona sem ter verificado. Até o Supabase real existir, login, upload e IA não foram testados de ponta a ponta.
- Não invente endpoints de terceiros (ONR/cartórios) e não burle captcha.
- Mudou alguma decisão, etapa ou pendência? Atualize `docs/SITUACAO_DO_PROJETO.md` no mesmo commit.
- Dev server na porta 3100. No Windows, não edite arquivos com `Set-Content` do PowerShell 5.1, porque ele corrompe UTF-8.
- Continuidade entre sessões e com o Codex: `docs/HANDOFF.md` (tarefa atual, branch, commit base, pendências) e decisões em `docs/adr/`.
