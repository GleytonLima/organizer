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

## Estrutura
```
src/main/        processo principal (index, window, pty, git, bash, system, files)
src/preload.js   ponte IPC (window.api)
src/renderer/
  js/core/       dom, store (estado + persistência), format
  js/themes/     paleta, temas, aplicação
  js/terminals/  sessões xterm+pty, teclado, clipboard
  js/actions/    terminais, workspaces, comandos salvos
  js/git/        polling de status
  js/ui/         sidebar, topbar, cmdbar, statusbar, menu, modal, componentes
  styles/        base, layout, sidebar, topbar, overlays
```
