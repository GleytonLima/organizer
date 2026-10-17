# Bash Organizer — convenções

## Código
- **Nada de arquivos gigantes.** Mire em < 200 linhas por arquivo; passou de ~250, divida por responsabilidade.
- **Modularidade e reuso sempre.** Antes de escrever, procure um helper/componente existente (`core/dom.js`, `ui/components.js`, `ui/modal.js` → `field.*`, `ui/menu.js`).
- Renderer em ES modules (sem bundler). Estado só muda por ações em `js/actions/*` seguidas de `commit()`; a UI re-renderiza via `subscribe` em `ui/render.js`.
- Use `mount()` em vez de `replaceChildren()` (ignora `null`/`false`).

## Design
- Elegante e minimalista, bem arredondado (tokens `--r-*` em `styles/base.css`).
- Cores vêm do tema (`js/themes/themes.js`); nada de cor fixa em CSS fora dos tokens.
- Sem destaques berrantes nem cards com barra colorida à esquerda: cor de terminal/workspace é só uma bolinha.

## Modelo
Projeto (pasta raiz) → Grupos → Terminais. Mudou o formato salvo? Suba `version` e migre em `core/model.js`.

## Estrutura
```
src/main/        processo principal (index, window, pty, git, bash, system, files)
src/main/api/    servidor HTTP local (127.0.0.1 + token) e ponte main→renderer
src/main/shell/  bash-init.sh: integração com o shell (OSC 7 = pasta, OSC 6973 = início/fim de comando)
src/preload.js   ponte IPC (window.api)
src/renderer/
  js/core/       dom, model (fábricas + migração), store (estado, persistência, consultas), format
  js/themes/     paleta, temas, aplicação
  js/terminals/  sessões xterm+pty, layout (grade lado a lado), buffer, teclado, clipboard
  js/actions/    terminais, grupos, projetos, split (lado a lado), comandos salvos
  js/git/        polling de status
  js/api/        handlers da API local (resolve nomes/ids/caminhos)
  js/ui/         sidebar(+groups), topbar, split, cmdbar, statusbar, menu, modal, confirm, dnd, componentes
  styles/        base, layout, sidebar, topbar, overlays, status
bin/             CLI `bo` (bo.js + lib/: client, commands, mcp, tools, wait) e wrappers bash/cmd
```

## API local
Novo método: implemente em `js/api/handlers.js`, exponha no CLI (`bin/lib/commands.js`) e no MCP (`bin/lib/tools.js`).
