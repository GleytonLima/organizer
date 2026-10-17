# Bash Organizer

App desktop (Electron + xterm.js + node-pty) para organizar terminais Git Bash no Windows.

```bash
npm install
npm start
```

## Recursos

- **Layout**: painel de terminais à esquerda, à direita ou em abas (botões no canto superior direito).
- **Temas**: Grafite, Meia-noite, Âmbar, Floresta e Claro (botão ◐ no topo).
- **Workspaces por projeto**: grupos com pasta e cor; podem ser fechados (os terminais ficam salvos) e reabertos.
- **Restaurar sessão**: ao reabrir o app, os terminais voltam na última pasta em que estavam.
- **Nome, cor e comando inicial** por terminal (duplo clique ou F2). Sem nome, o terminal mostra a pasta atual.
- **Comandos salvos**: barra de atalhos que executa no terminal ativo (botão direito para editar).
- **Git**: branch, mudanças (●), commits a enviar/baixar (↑↓) e conflitos, atualizados a cada 3 s.
- Arrastar terminais para reordenar ou mover entre workspaces.

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
que envia o diretório atual (OSC 7) — é assim que o app sabe a pasta de cada terminal.

O Git Bash é procurado em `C:\Program Files\Git`; para outro local, defina `GIT_BASH_PATH`.
Estado salvo em `%APPDATA%/Bash Organizer/state.json`. Só uma instância roda por vez.

Convenções de código e estrutura de pastas: veja [CLAUDE.md](CLAUDE.md).
