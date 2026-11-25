# Ilha de Tarefas

App de desktop para Windows que fica no topo da tela como uma "ilha" preta, no estilo de um notch. Recolhida, é uma pílula que mostra quantas tarefas estão atrasadas ou vencem hoje. Ao clicar, abre um painel com três abas.

Feito com [Tauri 2](https://tauri.app), React e TypeScript.

## O que faz

**Tarefas recorrentes**
- Tarefas mensais (todo dia N), semanais, anuais ou por evento (sem dia fixo, reinicia todo mês).
- Cada período tem seu próprio registro: concluída, data de conclusão e observação.
- A pílula avisa o que está atrasado e o que vence hoje.

**Consultas e textos prontos (Obsidian)**
- Lê o vault do Obsidian e transforma cada bloco ` ```sql ` em uma consulta que dá para copiar.
- A nota "Textos prontos" vira uma lista de textos, um por seção `## título`.
- Marcadores `{{campo}}` viram campos a preencher antes de copiar.
- Busca e leitor de notas com links `[[nota]]` que abrem no Obsidian.

**Claude**
- Conversa com o [Claude Code](https://claude.com/claude-code) usando o vault como pasta de trabalho.
- Escolha de modelo, nível de esforço e modo de permissão (de só leitura até acesso total).

**Ilha**
- Pode ser arrastada: perto da borda de cima gruda no topo como notch; em qualquer outro lugar vira uma pílula solta.
- Opção de iniciar com o Windows.
- Na primeira execução, um assistente ajuda a escolher o vault e verifica se o Claude Code está instalado.

## Requisitos

- Windows 10 ou 11
- [Obsidian](https://obsidian.md), para as abas Consultas e Claude
- [Claude Code](https://claude.com/claude-code) instalado e logado, para a aba Claude

As tarefas funcionam sem nenhum dos dois.

## Rodar a partir do código

Pré-requisitos: [Node.js](https://nodejs.org) 18+, [Rust](https://rustup.rs) e os [pré-requisitos do Tauri para Windows](https://tauri.app/start/prerequisites/).

```bash
npm install
npm run app          # abre o app em modo de desenvolvimento
npm run instalador   # gera o instalador .exe
```

O instalador fica em `src-tauri/target/release/bundle/nsis/`.

## Onde ficam os dados

Tudo fica no seu computador, em `%APPDATA%\app.ilha.tarefas\`:

- `dados.json`: tarefas, histórico, configurações e a conversa com o Claude
- `posicao.json`: onde a ilha foi deixada na tela

## Importar tarefas de uma planilha

O script `scripts/importar_planilha.py` converte uma planilha `.xlsx` de tarefas mensais em `src/seed.json`, que é usado como ponto de partida quando ainda não existe `dados.json`.

```bash
pip install openpyxl
npm run importar -- "minha planilha.xlsx"
```

## Estrutura

```
src/                 interface (React)
  components/        abas, formulários, painel
  lib/               regras de tarefas, leitura do vault, integração com o Claude
src-tauri/src/       parte nativa (Rust): janela, posição da ilha, arquivos, Claude Code
scripts/             importação de planilha
```
