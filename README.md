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
- **Git**: branch, mudanças (●), commits a enviar/baixar (↑↓) e conflitos, atualizados a cada 3 s.
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

`bo help` lista todos os comandos (`open`, `list`, `send`, `read`, `wait`, `status`, `focus`, `close`, `notify`).

### Servidor MCP

O mesmo script oferece um servidor MCP (`bo mcp`) com as ferramentas `open_terminal`, `list_terminals`,
`send_input`, `read_output`, `wait_for_output`, `terminal_status`, `focus_terminal`, `close_terminal` e `notify_user`.
Para registrar no Claude Code, Devin etc., rode num terminal do app:

```bash
bo mcp-config
```

Rode o agente **dentro de um terminal do Bash Organizer** (ex.: o da pasta `devtools`): assim os terminais
que ele abrir ficam associados ao grupo dele. `close_terminal` recusa fechar processo em execução sem `force`.

A API escuta só em `127.0.0.1`, com token aleatório a cada início (em `%APPDATA%/Bash Organizer/api.json`).

## Avisos (notificações)

Quando um terminal que você **não está vendo** pede atenção, ele ganha uma bolinha na sidebar (e no grupo/projeto),
o sino no topo acumula o aviso e, com o app fora de foco, aparece o **toast do Windows** — clicar leva ao terminal.

O que gera aviso:
- **bell** (``) e as sequências **OSC 9** / **OSC 777;notify** — qualquer CLI que já avise o terminal;
- **comandos longos** (≥ 15 s) que terminam;
- **`bo notify "mensagem" [--title T]`** e a ferramenta MCP **`notify_user`**.

Para o Claude Code avisar sempre que termina uma resposta ou precisa de você, use os hooks mostrados por `bo mcp-config`.

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
