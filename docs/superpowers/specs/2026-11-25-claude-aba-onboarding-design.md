# Ilha 0.2 — onboarding zerado + aba Claude

## Objetivo
Distribuir a Ilha para outras pessoas (instalador NSIS) começando vazia, com um
assistente de primeira execução que integra o vault do Obsidian, e uma aba
"Claude" conectada ao vault via Claude Code CLI.

## Primeira execução
- `src/seed.json` vazio (`tasks: []`, `log: {}`). Dados reais continuam em
  `%APPDATA%\app.ilha.tarefas\dados.json` (o seed só é usado se ele não existir).
- `settings.onboarded` ausente ⇒ `Onboarding` ocupa o painel:
  1. Vault: lista todos os vaults de `%APPDATA%\obsidian\obsidian.json` (aberto
     primeiro) + "Escolher outra pasta…" (diálogo nativo, `tauri-plugin-dialog`
     chamado pelo Rust). Pode pular.
  2. Claude: verifica se o executável `claude` existe; se não, mostra como
     instalar. Aviso de acesso total.
- Ao concluir: `settings = { onboarded: true, vaultPath }`.

## Aba Claude
- Rust:
  - `claude_find` → caminho do `claude.exe`/`claude.cmd` (PATH, `~\.local\bin`, `%APPDATA%\npm`).
  - `claude_send(run, prompt, cwd, session?)` → `claude -p --output-format stream-json
    --verbose --dangerously-skip-permissions --append-system-prompt … [--resume id]`,
    prompt pela stdin, cwd = vault, sem janela de console. Emite `claude-line`
    `{run, line}` por linha e `claude-done` `{run, code, stderr}`. Uma execução por vez.
  - `claude_stop` → `taskkill /T /F` na árvore.
  - `claude_forget(session)` → apaga `<id>.jsonl` (e pasta `<id>/`) em `~\.claude\projects\*`.
- Front:
  - `lib/claude.ts`: tipos `ChatMsg`/`Chat`, `parseLine` (init → sessão; assistant
    → texto e ferramentas resumidas; result com erro → mensagem de erro).
  - `lib/useClaude.ts`: montado no `App` (sobrevive a trocar de aba/recolher).
    Persiste `data.chat = { sessionId, messages }` (máx. 300 mensagens). Se a sessão
    não existir mais, reenvia sem `--resume`.
  - `components/ClaudeView.tsx`: cabeçalho com vault + "Apagar conversa" (confirmação
    inline, apaga também o .jsonl), lista de mensagens (Markdown existente; links
    [[nota]] abrem no Obsidian), compositor (Enter envia, Shift+Enter quebra, Parar).
  - Pílula mostra ponto azul enquanto o Claude trabalha.
  - `ModelPicker`: modelo (Padrão/Fable/Opus/Sonnet/Haiku → `--model`) e esforço
    (Padrão/Baixo…Máximo → `--effort low|medium|high|xhigh|max`), salvos em
    `settings.claudeModel` / `settings.claudeEffort`; valem a partir da próxima mensagem.
- Erros: CLI não encontrado, vault ausente, saída ≠ 0 (stderr resumido, dica de login).

  - Permissão (`settings.claudePermission`, também escolhida no onboarding):
    Acesso total (`--dangerously-skip-permissions`, padrão), Automático (`auto`),
    Editar notas (`acceptEdits`), Só leitura (`dontAsk`). Ponto colorido no botão.

## Ilha arrastável (`src-tauri/src/position.rs`)
- Segurar e mover a pílula → `drag_island` (arraste nativo do Windows); ao soltar
  (detectado com `GetAsyncKeyState`) grava a âncora em `posicao.json` e emite `island-placed`.
- A menos de 28px da borda de cima gruda no topo (notch com orelhas); fora disso é
  pílula solta com 4 cantos arredondados.
- Painel abre para baixo; se não couber, para cima. Sempre dentro do monitor.
- Engrenagem → "Voltar a ilha para o topo".

## Fora do escopo
Várias conversas, escolha de modelo, anexos, aprovação de permissões.

## Distribuição
Versão 0.2.0; `npm run instalador` → `src-tauri/target/release/bundle/nsis/*.exe`.
Requisitos do amigo: Obsidian, Claude Code instalado e logado.
