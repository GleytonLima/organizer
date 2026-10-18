// Painel Insights: cenário conhecido (tarefas com histórico e eventos gravados) → números certos em
// cada cartão; coleta de verdade pelo terminal; preços estimam o custo; escopo e período.
const path = require('path');
const { suite, seed } = require('./harness');

const DAY = 86400000;
const HOUR = 3600000;
const now = Date.now();
const COLS = [{ id: 'c1', name: 'A fazer' }, { id: 'c2', name: 'Fazendo' }, { id: 'c3', name: 'Feito' }];
const ev = (at, type, text, extra = {}) => ({ at, by: 'agente', type, text, ...extra });
const task = (id, key, created, columnId, history, extra = {}) => ({
  id, key, projectId: 'p1', columnId, title: key, description: '', terminalId: null, progress: null, needsInput: null, parentId: null, tags: [],
  createdAt: created, updatedAt: history.at(-1)?.at ?? created, history: [ev(created, 'created', 'Criada em “A fazer”'), ...history], ...extra,
});

const TASKS = [
  // concluída em 2 dias; uma espera de 1 h; "moved" antigo (sem `to`, só o texto)
  task('t1', 'IN-1', now - 10 * DAY, 'c3', [ev(now - 9 * DAY, 'input', 'Pergunta'), ev(now - 9 * DAY + HOUR, 'reply', 'Resposta'), ev(now - 8 * DAY, 'moved', 'Movida para “Feito”')]),
  // concluída em 1 dia, reaberta e concluída de novo
  task('t2', 'IN-2', now - 5 * DAY, 'c3', [ev(now - 4 * DAY, 'moved', 'Movida para “Feito”', { to: 'c3' }), ev(now - 3 * DAY, 'moved', 'Movida para “Fazendo”', { to: 'c2' }), ev(now - 2 * DAY, 'moved', 'Movida para “Feito”', { to: 'c3' })]),
  // aberta, esperando você há 2 h
  task('t3', 'IN-3', now - DAY, 'c1', [ev(now - 2 * HOUR, 'input', 'Qual porta?')], { needsInput: { question: 'Qual porta?', at: now - 2 * HOUR } }),
  // falha de teste do Playwright (tarefa criada pelo app) com um relato de nova falha
  task('t4', 'IN-4', now - DAY, 'c1', [ev(now - HOUR, 'report', 'falhou de novo')], { title: 'Testes Playwright falhando em e2e' }),
];

suite('insights', {
  seed: (dir) => {
    const [work] = seed.makeFolders(dir, ['app'], { git: false });
    const p = { ...seed.project('p1', 'app', [work], [seed.group('g1', 'Terminais', [seed.term('sh', 'sh', work)])]), taskColumns: COLS };
    const other = seed.project('p2', 'outro', [work], [seed.group('g2', 'Outros', [])]);
    return seed.state([p, other], { tasks: TASKS.map((t) => ({ ...t, title: t.title })) });
  },
}, async (t) => {
  t.check(await t.shellReady('sh'), 'terminal pronto');
  // eventos do agente e de comandos (como a coleta grava)
  await t.js(`const rec = (kind, data) => api.metrics.record({ ts: Date.now() - 3600000, kind, projectId: 'p1', taskId: 't1', terminalId: 'sh', data });
    rec('agent.turn', { stopReason: 'end_turn', ms: 40000, usage: { in: 1000, out: 500, cacheRead: 200000, cacheWrite: 10000 }, model: 'opus', tools: 3 });
    rec('agent.turn', { stopReason: 'end_turn', ms: 20000, usage: { in: 500, out: 250, cacheRead: 100000, cacheWrite: 0 }, model: 'haiku', tools: 1 });
    rec('agent.turn', { stopReason: 'cancelled', ms: 5000, usage: null, model: 'opus', tools: 0 });
    rec('agent.permission', { kind: 'allow_once', ms: 30000 });
    rec('agent.permission', { kind: 'reject_once', ms: 90000 });
    rec('command', { program: 'npm', exit: 1, ms: 3000 });
    rec('command', { program: 'npm', exit: 130, ms: 9000 });
    api.metrics.record({ ts: Date.now() - 3600000, kind: 'agent.turn', projectId: 'p2', data: { stopReason: 'end_turn', usage: { in: 99999999 } } });`);
  // comando de verdade no terminal: a coleta grava só o programa, com o código de saída
  await t.type('sh', 'SEGREDO=abc false');
  const real = await t.waitFor(async () => {
    const evs = await t.js(`return (await api.metrics.query({ since: 0 })).filter((e) => e.kind === 'command' && e.terminalId === 'sh' && e.data.program === 'false')`);
    return evs.length ? evs[0] : null;
  });
  t.equal([real?.data.program, real?.data.exit, real?.projectId, JSON.stringify(real).includes('SEGREDO')], ['false', 1, 'p1', false], 'comando do terminal vira evento com o programa e o código de saída (sem a linha inteira)');

  await t.js(`S.store.state.focusProjectId = 'p1'; S.store.state.insights = { period: '30d', scope: 'project', prices: null }; (await import('./js/actions/tasks.js')).setTaskView('insights')`);
  const cardText = (id) => t.js(`return document.querySelector('#board [data-card="${id}"]')?.innerText.replace(/\\s+/g, ' ') || ''`);
  await t.waitFor(async () => (await cardText('cost')).includes('mil'));
  const flow = await cardText('flow');
  t.check(/Fluxo 2 tarefas concluídas/i.test(flow) && flow.includes('1 d 12 h') && /em aberto agora 2/.test(flow), 'fluxo: 2 concluídas, lead time mediano 1,5 dia, 2 em aberto', flow);
  const waiting = await cardText('waiting');
  t.check(/esperas 2/.test(waiting) && /esperando agora 1/.test(waiting) && /3 h/.test(waiting), 'espera humana: 2 esperas, 1 em aberto, 3 h no total', waiting);
  const cost = await cardText('cost');
  t.check(/312 mil/.test(cost) && /turnos do agente 3/.test(cost) && !cost.includes('100 mi'), 'custo: 312 mil tokens do projeto (o outro projeto fica de fora)', cost);
  const agent = await cardText('agent');
  t.check(/67%/.test(agent) && /interrompidos 1 de 3/.test(agent) && /permissões negadas 1 de 2/.test(agent), 'assertividade: 2 de 3 turnos sem interrupção, 1 permissão negada', agent);
  const rework = await cardText('rework');
  t.check(/Playwright\) 2/.test(rework) && /comandos com erro 2 de 4/.test(rework) && /Retrabalho 1 tarefa reaberta/i.test(rework), 'retrabalho: 1 reaberta, 2 falhas de teste, 2 de 4 comandos com erro (o false real conta; Ctrl+C não)', rework);

  // preços → custo estimado
  await t.js(`document.querySelector('#board .btn.ghost').click()`);
  await t.waitFor(() => t.modal.open());
  await t.modal.fill?.({});
  await t.js(`const set = (k, v) => { const i = [...document.querySelectorAll('#modal .field')].find((f) => f.querySelector('label').textContent === k).querySelector('input'); i.value = v; i.dispatchEvent(new Event('input')); };
    set('Entrada', '3'); set('Saída', '15'); set('Leitura de cache', '0,3'); set('Escrita de cache', '3,75');`);
  await t.modal.submit();
  t.includes(await t.waitFor(async () => { const c = await cardText('cost'); return /US\$/.test(c) && c; }), 'US$', 'com preços, o custo em US$ aparece estimado');

  // todos os projetos: entra o turno do outro projeto
  await t.js(`(await import('./js/metrics/insights.js')).setInsights({ scope: 'all' })`);
  t.check(await t.waitFor(async () => (await cardText('cost')).includes('mi ')), 'em "Todos os projetos" entram os eventos do outro projeto');
  const shots = process.env.BO_TEST_SHOTS;
  if (shots) require('fs').writeFileSync(path.join(shots, 'insights.png'), (await t.wc.capturePage()).toPNG());
  await t.js(`(await import('./js/actions/tasks.js')).setTaskView('off')`);
});
