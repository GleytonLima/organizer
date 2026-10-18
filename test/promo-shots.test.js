// Telas reais do app para o vídeo de apresentação (../bo-promo). Não é teste: roda só pelo nome,
//   node test/run.js promo-shots
// Semeia um projeto de exemplo, roda comandos de verdade, cria tarefas e memórias pelo MCP e salva
// os prints em ../bo-promo/public/shots, com um manifesto (shots.json) da posição de cada elemento
// em destaque (0–1), para o vídeo apontar exatamente para ele.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { suite, seed } = require('./harness');
const { startMemoryServer } = require('./lib/memory-server');

process.env.BO_SYNC_INTERVAL_MS = '600000';
const OUT = process.env.BO_PROMO_SHOTS || path.resolve(__dirname, '..', '..', 'bo-promo', 'public', 'shots');
const PS1 = String.raw`PS1='\[\e[36m\]\W\[\e[0m\] › '; clear`; // prompt curto: só a pasta (sem usuário e máquina)
const start = (cmd) => `${PS1}${cmd}`;

// "npm run dev" de verdade em cada repositório de exemplo: um script Node que imprime um log colorido e fica rodando
const LOGS = {
  'loja-api': {
    dev: ['[32m✓[0m Postgres conectado', '[32m✓[0m Fila de webhooks pronta', '[36m▲[0m API em [1mhttp://localhost:8080[0m', '[2mPOST /pedidos 201 · 38 ms[0m', '[2mGET  /produtos 200 · 12 ms[0m'],
    worker: ['[33m[worker][0m fila pagamentos: 3 jobs', '[33m[worker][0m [32mok[0m pix#8841 confirmado', '[33m[worker][0m [32mok[0m pix#8842 confirmado'],
  },
  'loja-web': { dev: ['', '  [35mVITE[0m v6.2  pronto em [1m312 ms[0m', '', '  [32m➜[0m  Local:  [36mhttp://localhost:5173/[0m', '  [2m➜  Rede: use --host[0m'] },
};
function npmScripts(dir, name) {
  const scripts = {};
  for (const [script, lines] of Object.entries(LOGS[name])) {
    fs.writeFileSync(path.join(dir, `${script}.js`), `for (const l of ${JSON.stringify(lines)}) console.log(l);
setInterval(() => {}, 1e6);
`);
    scripts[script] = `node ${script}.js`;
  }
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name, version: '1.4.0', private: true, scripts }, null, 2));
}

/** Histórico de semanas de tarefas concluídas (com esperas respondidas) — para o Insights ter o que mostrar. */
function pastTasks(projectId) {
  const H = 3600e3, D = 24 * H, now = Date.now();
  const titles = ['Login com Google', 'Página de produto', 'Carrinho persistente', 'Frete por CEP', 'E-mail de confirmação', 'Busca com filtros', 'Painel de pedidos', 'Avaliações de produto', 'Lista de desejos'];
  return titles.map((title, i) => {
    const created = now - (26 - i * 3) * D;
    const doing = created + 3 * H, ask = doing + (5 + i) * H, reply = ask + (8 + (i % 4) * 9) * 60e3, done = reply + (10 + i * 2) * H;
    const history = [
      { at: created, by: 'agente', type: 'created', text: 'Criada em “A fazer”' },
      { at: doing, by: 'agente', type: 'moved', text: 'Movida para “Fazendo”', to: 'k2' },
      { at: ask, by: 'agente', type: 'input', text: 'Em espera: posso seguir com a abordagem proposta?' },
      { at: reply, by: 'você', type: 'reply', text: 'Respondeu no terminal: pode seguir' },
      { at: done, by: 'agente', type: 'moved', text: 'Movida para “Feito”', to: 'k3' },
    ];
    return { id: `old${i}`, key: `LO-${i + 1}`, projectId, columnId: 'k3', title, description: '', terminalId: null, progress: null, needsInput: null, parentId: null, tags: [], createdAt: created, updatedAt: done, history };
  });
}

suite('telas para o vídeo', {
  seed: (dir) => {
    const repos = path.join(dir, 'repos');
    const [api, web, infra] = seed.makeFolders(repos, ['loja-api', 'loja-web', 'infra'], { branches: { 'loja-api': 'feat/pix' } });
    for (const r of [api, web, infra]) execFileSync('git', ['remote', 'add', 'origin', `git@github.com:loja/${path.basename(r)}.git`], { cwd: r });
    npmScripts(api, 'loja-api');
    npmScripts(web, 'loja-web');
    const p = seed.project('p1', 'Loja Online', [api, web, infra], [
      seed.group('g1', 'Serviços', [seed.term('api', 'api', api, start('npm run dev')), seed.term('web', 'web', web, start('npm run dev')), seed.term('wk', 'worker', api, start('npm run worker'))]),
      seed.group('g2', 'Agente', [seed.term('ag', 'agente', api, PS1)]),
    ]);
    const site = seed.project('p2', 'Site institucional', [web], [seed.group('g3', 'Terminais', [seed.term('s1', 'dev', web)])]);
    const docs = seed.project('p3', 'Documentação', [infra], [seed.group('g4', 'Terminais', [seed.term('d1', 'docs', infra)])]);
    p.taskColumns = [{ id: 'k1', name: 'A fazer', description: 'Tarefas registradas que ainda não começaram.' }, { id: 'k2', name: 'Fazendo', description: 'Em execução agora.' }, { id: 'k3', name: 'Feito', description: 'Concluídas.' }];
    p.taskSeq = 9;
    [site.collapsed, docs.collapsed] = [true, true];
    return seed.state([p, site, docs], { tasks: pastTasks('p1'), activeId: 'api', commands: [{ id: 'c1', label: 'status', cmd: 'git status' }, { id: 'c2', label: 'testes', cmd: 'npm test' }] });
  },
}, async (t) => {
  fs.mkdirSync(OUT, { recursive: true });
  t.win.setContentSize(1600, 900);
  await t.wait(500);
  const manifest = {};
  // posição (0–1) de elementos na tela, para os destaques do vídeo
  const regions = (sel) =>
    t.js(`const out = {}; const W = innerWidth, H = innerHeight;
      for (const [k, s] of Object.entries(${JSON.stringify(sel)})) { const e = document.querySelector(s); if (!e) continue;
        const r = e.getBoundingClientRect(); out[k] = [r.x / W, r.y / H, r.width / W, r.height / H].map((v) => Math.round(v * 1000) / 1000); }
      return out;`);
  async function shot(name, sel = {}) {
    await t.wait(900);
    // barra de status: caminho legível (os repositórios de exemplo moram numa pasta temporária)
    await t.js(`const l = document.querySelector('#statusbar .link'); const s = String.fromCharCode(92);
      if (l) l.textContent = ['~', 'projetos', l.textContent.split(s).pop()].join(s)`);
    await t.wc.capturePage(); // a primeira captura às vezes vem antes do último quadro
    await t.wait(250);
    const img = await t.wc.capturePage();
    fs.writeFileSync(path.join(OUT, `${name}.png`), img.toPNG());
    manifest[name] = { file: `shots/${name}.png`, ...img.getSize(), regions: await regions(sel) };
    t.check(true, `print: ${name}`);
  }

  // 1. Terminais do grupo lado a lado, rodando de verdade.
  for (const id of ['api', 'web', 'wk']) await t.js(`T.activate('${id}')`);
  await t.js(`(await import('./js/actions/split.js')).splitGroup(S.store.state.projects[0].groups[0])`);
  await t.waitFor(async () => (await t.lines('wk', 10)).includes('confirmado') && (await t.lines('web', 10)).includes('5173'), { timeout: 40000 });
  await shot('workspace', { sidebar: '#sidebar', split: '#terminals', topbar: '#topbar', group: '.group' });

  // 3. Quadro: tarefas criadas e movidas por um agente (MCP), uma em espera com sugestão.
  t.check(await t.shellReady('ag'), 'terminal do agente pronto');
  await t.type('ag', 'clear');
  const agent = await t.mcp('ag');
  const task = async (title, extra = {}) => (await agent.tool('create_task', { title, ...extra })).data;
  const pix = await task('Checkout com Pix', { description: 'Pagamento instantâneo no carrinho' });
  await agent.tool('move_task', { task: pix.key, column: 'Fazendo' });
  await agent.tool('report_progress', { task: pix.key, message: 'QR code gerado e validado no sandbox', progress: 60 });
  const hook = await task('Webhook de pagamento');
  await agent.tool('move_task', { task: hook.key, column: 'Fazendo' });
  await agent.tool('request_input', { task: hook.key, question: 'Uso fila SQS ou RabbitMQ para os webhooks?' });
  const sup = await t.mcp('');
  await sup.tool('suggest_reply', { task: hook.key, suggestion: 'SQS: o resto da infra já está na AWS.' });
  await task('Tela de pedidos');
  await task('Cupom de desconto');
  const load = await task('Testes de carga do carrinho');
  await agent.tool('complete_task', { task: load.key, summary: 'p95 em 180 ms com 500 usuários' });
  await t.js(`(await import('./js/actions/tasks.js')).setTaskView('board')`);
  await shot('board', { board: '#board', waiting: '.kb-waiting' });

  // 4. Em espera: a pergunta do agente, a sugestão pré-preenchida e o botão que responde no terminal.
  await t.js(`const A = await import('./js/actions/tasks.js'); A.setTaskView('panel');
    (await import('./js/ui/tasks/selection.js')).openTask(S.store.state.tasks.find((x) => x.key === ${JSON.stringify(hook.key)}).id)`);
  await shot('waiting', { drawer: '#task-detail', waitbox: '.td-waiting', panel: '#taskpanel' });
  await t.js(`(await import('./js/ui/tasks/selection.js')).closeTask()`);

  // 5. Memória: decisões em uma frase e busca sem acento.
  await agent.tool('record_decision', { text: 'Pagamentos usam Pix via Stripe porque o time já integra com a API deles.', tags: 'pagamentos' });
  await agent.tool('record_decision', { text: 'Webhooks passam por fila porque o gateway reenvia e não podemos duplicar pedidos.', tags: 'pagamentos,infra' });
  await agent.tool('remember_note', { text: 'Para subir local: docker compose up -d && npm run dev (API na 8080).', tags: 'setup' });
  await agent.tool('record_decision', { text: 'Commits em português porque o time inteiro fala português.', scope: 'global' });
  // Agente: o que ele vê e usa pelo CLI `bo` (o mesmo vale pelo MCP)
  await t.js(`(await import('./js/actions/tasks.js')).setTaskView('off'); T.activate('ag')`);
  // espaço na frente: se o primeiro caractere se perder na corrida com o prompt, nada quebra
  await t.type('ag', ' clear; bo task list; echo; bo mem decisions');
  await t.waitFor(async () => !(await t.lines('ag', 40)).includes('command not found') || null, { timeout: 2000 });
  await t.waitFor(async () => (await t.lines('ag', 40)).includes('Webhooks passam'), { timeout: 20000 });
  await shot('agent', { terminal: '#terminals', sidebar: '#sidebar' });
  await t.js(`S.store.state.sideTab = 'memory'; (await import('./js/actions/tasks.js')).setTaskView('panel');
    (await import('./js/ui/memory/state.js')).setQuery('pagamento')`);
  await t.waitFor(() => t.js(`return (document.querySelector('#taskpanel')?.innerText || '').includes('Stripe')`), { timeout: 10000 });
  await shot('memory', { panel: '#taskpanel' });

  // 6. Insights do projeto.
  await t.js(`(await import('./js/actions/tasks.js')).setTaskView('insights')`);
  await shot('insights', { board: '#board' });

  // 7. Configurações: Local e conectado ao servidor do time.
  await t.js(`(await import('./js/ui/settings/view.js')).openSettings('server')`);
  await shot('settings-local', { card: '.set-card', indicator: '.sync-indicator' });
  const srv = await startMemoryServer();
  if (!srv.skip) {
    try {
      await t.js(`await api.sync.loginToken(${JSON.stringify(srv.url)}, ${JSON.stringify(srv.tokenA)})`);
      await t.js(`(await import('./js/actions/projects.js')).setSyncKey(S.store.state.projects[0], 'loja-online'); await api.sync.now()`);
      await t.js(`(await import('./js/ui/settings/view.js')).openSettings('server')`);
      await t.waitFor(async () => (await t.js(`return document.querySelector('.sync-indicator')?.innerText`)).includes('Sincronizado'));
      // conta e endereço apresentáveis (o servidor de teste roda em 127.0.0.1)
      await t.js(`const h = document.querySelector('.set-account .set-hint'); if (h) h.textContent = 'ana@empresa.com · memoria.empresa.com'`);
      await shot('settings-team', { card: '.set-card', indicator: '.sync-indicator' });
    } finally {
      srv.stop();
    }
  }
  await t.js(`(await import('./js/actions/tasks.js')).setTaskView('off')`);
  fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify(manifest, null, 2));
});
