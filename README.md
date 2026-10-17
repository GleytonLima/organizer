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
- **Comandos salvos**: barra de atalhos que executa no terminal ativo (botão direito para editar).
- **Git**: branch, mudanças (●), commits a enviar/baixar (↑↓) e conflitos, atualizados a cada 3 s.
- Arrastar terminais para reordenar ou mover entre grupos.

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
