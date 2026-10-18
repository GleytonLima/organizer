// Consolidação da memória ao concluir uma tarefa (curto → longo prazo): o agente propõe memórias
// (suggest_memory), você aceita ou descarta na gaveta; concluir pede as sugestões ao agente livre e
// arquiva o progresso da tarefa (sai da busca padrão); reabrir o traz de volta.
const os = require('os');
const path = require('path');
const { suite, seed } = require('./harness');

process.env.BO_ACP_AGENT = JSON.stringify([process.execPath, path.join(__dirname, 'fixtures', 'fake-acp-agent.js')]);
process.env.FAKE_ACP_STORE = path.join(process.env.BO_TEST_DIR || os.tmpdir(), 'acp-sessions.json');

suite('consolidação da memória', {
  seed: (dir) => {
    const [repo] = seed.makeFolders(path.join(dir, 'repos'), ['app']);
    return seed.state([seed.project('pA', 'App', [repo], [seed.group('gA', 'Terminais', [seed.term('a1', 'a1', repo)])])]);
  },
}, async (t) => {
  const id = await t.js(`const A = await import('./js/actions/terminals.js'); A.newAgentTerminal(S.projectById('pA').groups[0]); return S.store.state.activeId;`);
  const sid = JSON.stringify(id);
  await t.waitFor(() => t.js(`return SE.getSession(${sid})?.state === 'pronto'`));
  const key = await t.js(`return (await import('./js/actions/tasks.js')).createTask(S.projectById('pA'), { title: 'Cache das listagens', terminalId: ${sid} }).key`);
  const task = () => t.js(`const x = S.store.state.tasks.find((k) => k.key === ${JSON.stringify(key)}); return { column: x.columnId, suggestions: (x.memorySuggestions || []).map((s) => [s.kind, s.text]), refs: x.memoryRefs || [], history: x.history.map((h) => h.text) }`);
  await t.js(`await api.memory.add({ scope: 'project', projectId: 'pA', project: 'App', kind: 'progress', taskKey: ${JSON.stringify(key)}, text: '${key}: cache pela metade, falta invalidar', progress: { status: 'falta invalidar' } })`);
  const moveTo = (which) => t.js(`(await import('./js/actions/tasks.js')).moveTask(S.store.state.tasks.find((k) => k.key === ${JSON.stringify(key)}), (await import('./js/tasks/columns.js')).${which}(S.projectById('pA')).id)`);
  const progress = () => t.js(`return (await api.memory.list({ projectId: 'pA', kind: 'progress', taskKey: ${JSON.stringify(key)} }))[0]?.status || 'open'`);

  // o agente propõe pelo MCP (e pelo CLI); decisão continua sendo uma frase
  const agent = await t.mcp('a1');
  const ok = await agent.tool('suggest_memory', { task: key, kind: 'decision', text: 'Cache de 60 s nas listagens porque a lista muda pouco e o banco sofria.' });
  t.check(ok.ok && ok.data.pending === 1, 'suggest_memory deixa a sugestão pendente na tarefa', ok.error);
  const bad = await agent.tool('suggest_memory', { task: key, kind: 'decision', text: 'linha 1\nlinha 2' });
  t.check(!bad.ok && /uma frase/.test(bad.error), 'decisão com quebra de linha é recusada', bad.error);
  const cli = await t.bo(['task', 'suggest', key, 'Invalide', 'o', 'cache', 'ao', 'salvar', '--kind', 'howto'], { terminal: 'a1' });
  t.includes(cli.stdout, '(howto)', 'bo task suggest também propõe');
  t.equal((await task()).suggestions.map(([k]) => k), ['decision', 'howto'], 'as duas sugestões ficam na tarefa');

  // concluir (você): arquiva o progresso e pede sugestões ao agente livre
  await moveTo('lastColumn');
  t.equal(await t.waitFor(async () => ((await progress()) === 'done' ? 'done' : null)), 'done', 'concluir arquiva o progresso da tarefa');
  const found = await t.js(`return (await api.memory.search('cache pela metade', { context: { projectId: 'pA' } })).items.map((m) => m.kind)`);
  t.check(!found.includes('progress'), 'progresso arquivado sai da busca padrão', JSON.stringify(found));
  t.check(await t.waitFor(() => t.js(`return SE.getSession(${sid}).body.innerText.includes('suggest_memory')`)), 'o agente livre recebe o pedido de sugestões');
  t.check((await task()).history.some((h) => h.includes('Pediu ao agente sugestões')), 'o pedido fica no histórico');
  await t.js(`SE.getSession(${sid}).cancel()`); // o agente falso pediria permissão para editar: encerra o turno

  // gaveta: editar e aceitar uma, descartar a outra
  await t.js(`(await import('./js/ui/tasks/selection.js')).openTask(S.store.state.tasks.find((k) => k.key === ${JSON.stringify(key)}).id)`);
  await t.waitFor(() => t.js(`return document.querySelectorAll('#task-detail [data-suggestion]').length === 2`));
  await t.js(`const box = document.querySelector('#task-detail [data-suggestion] textarea'); box.value = 'Cache de 60 s nas listagens porque a lista muda pouco.'; box.dispatchEvent(new Event('input'));
    [...box.closest('[data-suggestion]').querySelectorAll('button')].find((b) => b.textContent === 'Aceitar').click()`);
  const accepted = await t.waitFor(async () => ((await task()).refs.length === 1 ? task() : null));
  const [mem] = await t.js(`return api.memory.many(${JSON.stringify(accepted?.refs || [])})`);
  t.equal([mem?.kind, mem?.text, mem?.taskKey], ['decision', 'Cache de 60 s nas listagens porque a lista muda pouco.', key], 'aceitar (com o texto editado) cria a decisão vinculada à tarefa');
  await t.js(`[...document.querySelector('#task-detail [data-suggestion]').querySelectorAll('button')].find((b) => b.textContent === 'Descartar').click()`);
  const after = await t.waitFor(async () => ((await task()).suggestions.length === 0 ? task() : null));
  t.check(after && after.history.some((h) => h.startsWith('Aceitou')) && after.history.some((h) => h.startsWith('Descartou')), 'aceitar e descartar ficam no histórico');
  t.check(await t.waitFor(() => t.js(`return [...document.querySelectorAll('#task-detail button')].some((b) => b.textContent === 'Pedir ao agente')`)), 'concluída e sem sugestões: botão "Pedir ao agente"');

  // reabrir traz o progresso de volta; complete_task devolve o pedido ao agente que concluiu
  await moveTo('firstColumn');
  t.equal(await t.waitFor(async () => ((await progress()) === 'open' ? 'open' : null)), 'open', 'reabrir a tarefa reabre o progresso');
  const done = await agent.tool('complete_task', { task: key, summary: 'cache pronto' });
  t.check(done.ok && /suggest_memory/.test(done.data.next), 'complete_task responde com o pedido de memórias duráveis', JSON.stringify(done.data?.next));
  await t.js(`(await import('./js/ui/tasks/selection.js')).closeTask()`);
});
