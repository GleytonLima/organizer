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
Projeto (nome + `repos`: lista explícita de pastas, não uma pasta raiz) → Grupos → Terminais.
"Projeto em foco" (`state.focusProjectId`, `currentProject()`): painel, chips e novo terminal seguem o foco. Tarefas em `state.tasks` (projectId, columnId); colunas em `project.taskColumns`.
"Em espera" é `task.needsInput` (não é coluna).
Memória fica no `memory.db` (processo principal), com escopo global | project | folder (pasta por caminho; ver `src/main/memory/scope.js`); o renderer resolve projeto/repo/tarefa e chama via IPC (`api.memory`).
Tipos de memória em `js/memory/kinds.js` (o banco não tem CHECK de tipo: valide em `store.js`). Vínculos `refs: [{ id: gid, type: depends|related|contradicts }]`; só `depends` propaga impacto; mudar uma memória oferece marcar a cadeia "a revisar" (`ui/memory/impact.js`). Ideia: `status` open|converted|discarded; "virar tarefa" em `actions/idea-task.js`. Tarefa referencia memórias em `task.memoryRefs` (gids) e o `get_task` as entrega ao agente. Lista de tarefas: período em `tasks/period.js` (padrão última semana; em aberto sempre aparecem).
Sync (contrato em `../bo-memory-server/docs/API.md`): projeto sincroniza pela `project.syncKey` (workspace no servidor), pasta pelo remote git normalizado, global vai para o time; sem chave/remote fica só local. Conflito é marcado (`conflict`) e o usuário resolve (minha / do servidor / mescla); "Retomar" faz claim do progresso e cria a tarefa local (`actions/task-adopt.js`).
Pasta do terminal vem do bash em formato Windows (`pwd -W`, OSC 6973;cwd) — não converter caminhos MSYS à mão. Mudou o formato salvo? Suba `version` e migre em `core/model.js`.

## Estrutura
```
src/main/        processo principal (index, window, pty, git, bash, system, files)
src/main/api/    servidor HTTP local (127.0.0.1 + token) e ponte main→renderer
src/main/memory/  memória: db + migrations (node:sqlite + FTS5), store (decisão/nota/ideia/como fazer/progresso), refs + links (vínculos, cadeia de impacto, "a revisar"), search (texto/híbrida), embeddings (opcional)
src/main/sync/   sync da memória com o bo-memory-server: settings (URL + token no safeStorage), client, remote, mapping, rows, engine (push → pull a cada 30 s)
src/main/notifications.js  toast do Windows + piscar na barra de tarefas
src/main/shell/  bash-init.sh: integração com o shell (OSC 7 = pasta, OSC 6973 = início/fim de comando)
src/preload.js   ponte IPC (window.api)
src/renderer/
  js/core/       dom, model (fábricas + migração), store (estado, persistência, consultas), format
  js/themes/     paleta, temas, aplicação
  js/terminals/  sessões xterm+pty, layout (grade lado a lado), buffer, teclado, clipboard
  js/actions/    terminais, grupos, projetos, split (lado a lado), comandos salvos, tasks, task-waiting (espera → resposta)
  js/git/        polling de status
  js/api/        handlers da API local (resolve nomes/ids/caminhos)
  js/tasks/      quadro de tarefas: colunas por projeto (columns), consultas (queries), histórico/origem (history)
  js/notify/     central de avisos (center) e fontes: bell, OSC 9/777, comando longo (sources)
  js/ui/memory/  aba Memória do painel lateral (busca, filtros, diálogos, embeddings)
  js/ui/tasks/   painel, quadro, cartão, gaveta de detalhe (+ espera), diálogos (nova tarefa, colunas)
  js/ui/         sidebar(+groups), topbar, split, notifications (sino), cmdbar, statusbar, menu, modal, confirm, dnd, componentes
  styles/        base, layout, sidebar, topbar, overlays, status, tasks, tasks-board, tasks-detail, memory
build/           ícone (icon.svg → icon.png via render-icon.js) e recursos do electron-builder
test/            ponta a ponta: run.js (uma suíte por processo Electron), harness.js + lib/ (contexto, MCP, seed, checks), *.test.js
bin/             CLI `bo` (bo.js + lib/: client, commands(+task, +memory), mcp, tools(+tasks, +memory), wait) e wrappers bash/cmd
```

## API local
Novo método: implemente em `js/api/handlers.js`, exponha no CLI (`bin/lib/commands.js`) e no MCP (`bin/lib/tools.js`).

## Testes
`npm test` (ou `node test/run.js <suíte>`): sobe o app de verdade com dados isolados e verifica pelo MCP/CLI/renderer.
A suíte `sync` sobe o `../bo-memory-server/bin/bo-memory-server.exe` contra o PostgreSQL de testes (docker compose); sem eles, é pulada.
Mudou um comportamento coberto? Ajuste ou acrescente verificações no `test/<área>.test.js`; reuse o contexto do `harness.js`.
No processo principal, chame o `bo` só de forma assíncrona (`t.bo`): `execFileSync` trava a própria API.

## Empacotamento
`npm run dist` (electron-builder, config em package.json → build). `bin/**` e `node-pty` ficam fora do .asar
(asarUnpack): executáveis e scripts precisam existir em disco. Caminhos para eles: troque `app.asar` por `app.asar.unpacked`.

## Dogfooding
O histórico deste projeto (tarefas, decisões em uma frase, notas) está no próprio app, projeto "Bash Organizer".
Ao decidir algo, registre: `bo mem decide "<frase com o porquê>"`; consulte antes: `bo mem search <termos>` / `bo mem decisions`.
Tarefas: `bo task add|move|done`. Dentro da pasta do repo o projeto é deduzido sozinho.
