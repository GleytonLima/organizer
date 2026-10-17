# Bash Organizer

App desktop (Electron + xterm.js + node-pty) para organizar terminais Git Bash no Windows.

```bash
npm install
npm start
```

## Recursos

- **Layout**: painel de terminais à esquerda, à direita ou em abas (botões no canto superior direito).
- **Temas**: Grafite, Meia-noite, Âmbar, Floresta e Claro (botão ◐ no topo).
- **Projetos → grupos → terminais**: o projeto é a pasta raiz; grupos (ex.: "Agente", "Serviços") organizam os terminais.
  Projetos podem ser fechados (os terminais ficam salvos) e reabertos.
- **Estado do processo**: cada terminal mostra o comando em execução, ou se saiu com erro.
- **Confirmação ao apagar**: fechar um terminal com processo rodando, excluir grupo ou projeto pede confirmação.
- **Restaurar sessão**: ao reabrir o app, os terminais voltam na última pasta em que estavam.
- **Nome, cor e comando inicial** por terminal (duplo clique ou F2). Sem nome, o terminal mostra a pasta atual.
- **Lado a lado**: no menu de contexto de um grupo ou projeto, "Ver lado a lado" mostra todos os seus terminais
  ao mesmo tempo, em grade. Ativar um terminal de fora (ou o ✕ no topo) volta ao normal.
- **Comandos salvos**: barra de atalhos que executa no terminal ativo (duplo clique edita, ✕ remove com confirmação).
- **Projetos multi-repo**: um projeto é um nome + as **pastas que você escolhe** (repositórios clonados onde quer
  que estejam, mesmo numa pasta de clones compartilhada; pastas sem git como `devtools` também valem).
  Elas aparecem como chips no topo (repo, branch, mudanças, ↑↓), com ＋ para adicionar; cada terminal mostra o
  repo e a branch em que está. Agentes abrem terminais pelo nome: `open_terminal({ repo: "backend" })` / `bo open --repo backend`.
- Arrastar terminais para reordenar ou mover entre grupos.

## Agentes de IA e CLI `bo`

Todo terminal aberto pelo app tem o comando `bo` no PATH e sabe quem ele é (`BO_TERMINAL_ID`).
Terminais abertos a partir dele entram **no mesmo grupo** (ou no grupo indicado com `--group`).

```bash
bo open --name backend --cwd ../backend --group Serviços --run "npm run dev"
bo wait backend --match "listening" --timeout 60
bo list
bo read backend --lines 30
bo close backend --force
```

`bo help` lista todos os comandos (`project`, `open`, `list`, `send`, `read`, `wait`, `status`, `focus`, `close`, `notify`, `task`, `mem`).

Fora de um terminal do app (outro terminal, IDE), o `bo` e o MCP deduzem o projeto pela **pasta atual**: basta
estar dentro de uma das pastas do projeto. Agentes também podem criar o projeto: `create_project` / `bo project add`.

### Servidor MCP

O mesmo script oferece um servidor MCP (`bo mcp`) com as ferramentas `create_project`, `open_terminal`, `list_terminals`,
`send_input`, `read_output`, `wait_for_output`, `terminal_status`, `focus_terminal`, `close_terminal` e `notify_user`.
Para registrar no Claude Code, Devin etc., rode num terminal do app:

```bash
bo mcp-config
```

Rode o agente **dentro de um terminal do Bash Organizer** (ex.: o da pasta `devtools`): assim os terminais
que ele abrir ficam associados ao grupo dele. `close_terminal` recusa fechar processo em execução sem `force`.

A API escuta só em `127.0.0.1`, com token aleatório a cada início (em `%APPDATA%/Bash Organizer/api.json`).

## Quadro de tarefas (mini kanban para agentes)

Cada projeto tem um quadro. O botão de **Tarefas** (topo) abre um **painel lateral** (agrupado por coluna, com
"Em espera" no topo); dele, ⤢ abre o **quadro em tela cheia**. Clicar num cartão abre o **detalhe** (título,
coluna, descrição, histórico, terminal de origem e branch git).

- **Colunas configuráveis** (⚙): nome + descrição. A descrição orienta o agente sobre o que cada coluna significa.
  A primeira recebe tarefas novas; a última é a de concluído. Padrão: A fazer → Fazendo → Feito.
- **Em espera** é um estado (vale em qualquer coluna): o agente faz uma pergunta (`request_input`), você é avisado,
  e a sua resposta no detalhe é **digitada direto no terminal do agente** que perguntou.
- **Supervisor**: outro agente pode listar as esperas (`list_waiting_tasks`) e deixar uma sugestão
  (`suggest_reply`), que aparece pré-preenchida na sua resposta.
- A sidebar mostra, em cada terminal, a tarefa que o agente dele está tocando.

Ferramentas MCP: `list_columns`, `create_task`, `move_task`, `report_progress`, `request_input`, `complete_task`,
`list_tasks`, `get_task`, `list_waiting_tasks`, `suggest_reply`. No terminal: `bo task` (list, columns, add, move,
report, wait, done, waiting).

## Memória do projeto (decisões e notas)

Persistente entre sessões, em `%APPDATA%/Bash Organizer/memory.db` (SQLite embutido, sem dependência nativa extra).

- **Decisões**: uma frase com o porquê (máx. 280 caracteres, sem quebra de linha) — um mini ADR.
  Uma decisão nova pode **substituir** outra; a antiga sai das vigentes e fica no histórico.
- **Notas**: texto livre (convenções, comandos, armadilhas).
- Cada memória tem projeto, **repositório** (detectado pelo git do terminal do agente), tarefa atual e tags.
- **Busca por texto** sempre ligada (FTS5, ignora acentos). **Embeddings opcionais** (⚙ na aba Memória):
  Ollama local ou API compatível com OpenAI; com eles ligados a busca vira híbrida. A chave de API fica
  criptografada com o cofre do Windows. Se o provedor cair, a busca continua por texto.

Painel lateral → aba **Memória** (busca, filtro Tudo/Decisões/Notas). MCP: `record_decision`, `remember_note`,
`search_memory`, `list_decisions`, `forget_memory`. Terminal: `bo mem decide|note|search|decisions|forget`.

## Onde os dados ficam

`%APPDATA%/Bash Organizer/`: `state.json` (projetos, grupos, terminais, tarefas, comandos, tema),
`memory.db` (memória), `memory-settings.json` (embeddings), `window.json`, `api.json` (porta/token da sessão).

## Avisos (notificações)

Quando um terminal que você **não está vendo** pede atenção, ele ganha uma bolinha na sidebar (e no grupo/projeto),
o sino no topo acumula o aviso e, com o app fora de foco, aparece o **toast do Windows** — clicar leva ao terminal.

O que gera aviso:
- **bell** (``) e as sequências **OSC 9** / **OSC 777;notify** — qualquer CLI que já avise o terminal;
- **comandos longos** (≥ 15 s) que terminam;
- **`bo notify "mensagem" [--title T]`** e a ferramenta MCP **`notify_user`**.

Para o Claude Code avisar sempre que termina uma resposta ou precisa de você, use os hooks mostrados por `bo mcp-config`.

## Testes

```bash
npm test
```

Roda as suítes de ponta a ponta em `test/` (shell, tarefas, memória, projetos, lado a lado): cada uma abre o app com uma
pasta de dados temporária (não mexe nos seus projetos), fala com ele pelo MCP/CLI e termina com código ≠ 0 se algo falhar.
Uma suíte só: `node test/run.js memory`. As janelas aparecem durante a execução.

## Gerar o executável

```bash
npm run dist
```

Gera em `dist/`:
- `Bash Organizer-Setup-<versão>.exe` — instalador **por usuário** (não pede admin), cria atalhos no Menu Iniciar e na
  área de trabalho. Prefira este: o atalho do Menu Iniciar é o que permite ao Windows mostrar os **toasts**.
- `Bash Organizer-Portable-<versão>.exe` — um único `.exe`, sem instalação (os toasts podem não aparecer).

`npm run pack` gera só a pasta `dist/win-unpacked` (mais rápido, para testar). `npm run icon` regenera o ícone
a partir de `build/icon.svg`.

Os executáveis **não são assinados**: o Windows mostra o aviso do SmartScreen ("Mais informações → Executar assim mesmo").
Em máquinas corporativas com AppLocker/WDAC, um `.exe` não assinado pode ser bloqueado — nesse caso peça liberação à TI
ou rode a partir do código (`npm install` + `npm start`).

Para testar com dados isolados (sem mexer nos seus projetos): `BO_USER_DATA=<pasta> "Bash Organizer.exe"`.

## Atalhos

| Atalho | Ação |
| --- | --- |
| Ctrl+Shift+T | Novo terminal |
| Ctrl+Shift+W | Fechar terminal |
| Ctrl+Tab / Ctrl+Shift+Tab | Próximo / anterior |
| F2 | Editar terminal |
| Ctrl+C (com seleção) / Ctrl+V | Copiar / colar |
| Botão direito no terminal | Copia a seleção ou cola |

## Como funciona

Cada terminal roda `bash.exe --rcfile bash-init.sh -i`. O rcfile (gerado em `%APPDATA%/Bash Organizer`)
carrega `/etc/profile` e o seu `~/.bash_profile`/`~/.bashrc` normalmente e adiciona ao `PROMPT_COMMAND` um hook
que envia o diretório atual (OSC 7) e o início/fim de cada comando (OSC 6973) — veja `src/main/shell/bash-init.sh`.

O Git Bash é procurado em `C:\Program Files\Git`; para outro local, defina `GIT_BASH_PATH`.
Estado salvo em `%APPDATA%/Bash Organizer/state.json`. Só uma instância roda por vez.

Convenções de código e estrutura de pastas: veja [CLAUDE.md](CLAUDE.md).
