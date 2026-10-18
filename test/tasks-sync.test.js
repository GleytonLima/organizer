// Quadro de tarefas do workspace: o que a Ana (este app) cria sobe com o nome dela no histórico; o que
// Bruno (outra máquina, via HTTP) cria chega; chave repetida offline é renumerada; conflito é
// fundido sem perguntar; exclusões sincronizam; "Em espera" fica só local.
const { suite, seed } = require('./harness');
const { startMemoryServer } = require('./lib/memory-server');

process.env.BO_SYNC_INTERVAL_MS = '600000'; // só as rodadas que o teste pede

suite('quadro de tarefas sincronizado', {
  seed: (dir) => {
    const [app] = seed.makeFolders(dir, ['app']);
    const p = seed.project('pA', 'App', [app], [seed.group('gA', 'Agente', [seed.term('a1', 'a1', app)])]);
    p.syncKey = 'app';
    p.taskColumns = [{ id: 'k1', name: 'A fazer', description: '' }, { id: 'k2', name: 'Fazendo', description: '' }, { id: 'k3', name: 'Feito', description: '' }];
    return seed.state([p]);
  },
}, async (t) => {
  const srv = await startMemoryServer();
  if (srv.skip) return t.check(true, `(pulado: ${srv.skip})`);
  process.env.BO_SYNC_URL = srv.url;
  process.env.BO_SYNC_TOKEN = srv.tokenA;
  const bruno = srv.as(srv.tokenB);
  // duas vezes: a primeira pode só alcançar uma rodada que já estava em andamento
  const round = () => t.js(`const S2 = await import('./js/tasks/sync.js'); await S2.syncTasksNow(); await S2.syncTasksNow(); return true`);
  const server = async () => Object.fromEntries(((await bruno('POST', '/v1/tasks/pull', { since: 0, workspaces: ['app'] })).data?.items || []).map((i) => [i.key, i]));
  const local = () => t.js(`return Object.fromEntries(S.store.state.tasks.map((x) => [x.key, { id: x.id, title: x.title, columnId: x.columnId, by: x.history.map((h) => h.by) }]))`);
  const a = await t.mcp('a1');
  try {
    // 1. Ana cria: sobe com o nome dela no histórico; "Em espera" não sobe.
    const t1 = (await a.tool('create_task', { title: 'Login com SSO' })).data;
    await a.tool('request_input', { task: t1.key, question: 'Entra ID ou Keycloak?' });
    await round();
    let srvTasks = await server();
    const up = srvTasks[t1.key];
    t.equal(up?.task?.title, 'Login com SSO', 'tarefa criada aqui sobe para o workspace');
    t.check(up?.task?.history?.every((h) => h.by !== 'você'), 'no servidor, "você" vira o nome de quem fez', JSON.stringify(up?.task?.history?.map((h) => h.by)));
    t.check(up && !('needsInput' in up.task) && !('terminalId' in up.task), '"Em espera" e o terminal de origem ficam só locais');

    // 2. Bruno cria uma tarefa com a chave que a Ana vai usar a seguir (APP-2): chega aqui como APP-2…
    const put = await bruno('POST', '/v1/tasks/push', { changes: [{ op: 'upsert', workspace: 'app', baseRev: 0, id: 'bruno1', key: 'APP-2', task: { title: 'Cadastro', columnId: 'k1', history: [{ at: 1, by: 'Bruno', type: 'created', text: 'Criada' }] } }] });
    t.equal(put.data?.results?.[0]?.key, 'APP-2', 'Bruno grava no servidor');
    // …mas a Ana já tinha criado offline a dela com a mesma chave: a dela é renumerada.
    await t.js(`S.store.state.projects[0].taskSeq = 1; S.commit()`); // como se não tivesse visto a do Bruno
    const t2 = (await a.tool('create_task', { title: 'Tela de perfil' })).data;
    t.equal(t2?.key, 'APP-2', 'Ana cria offline com a mesma chave');
    await round();
    const mine = await local();
    t.equal(mine['APP-2']?.title, 'Cadastro', 'tarefa do Bruno chega com a chave dele');
    const renamed = Object.entries(mine).find(([, v]) => v.title === 'Tela de perfil');
    t.equal(renamed?.[0], 'APP-3', 'a da Ana é renumerada para a próxima livre');
    t.check(mine['APP-2']?.by.includes('Bruno'), 'histórico do Bruno chega com o nome dele');
    const t3 = (await a.tool('create_task', { title: 'Depois da renumeração' })).data;
    t.equal(t3?.key, 'APP-4', 'a sequência local segue à frente das chaves do servidor');

    // 3. Conflito: Bruno muda o título, Ana move a tarefa antes de receber → os dois valem.
    srvTasks = await server();
    const cur = srvTasks[t1.key];
    await bruno('POST', '/v1/tasks/push', { changes: [{ op: 'upsert', workspace: 'app', baseRev: cur.rev, id: cur.id, key: cur.key, task: { ...cur.task, title: 'Login com SSO (Entra ID)' } }] });
    // você move (mover pelo agente encerraria a espera — é o comportamento do app)
    await t.js(`const A = await import('./js/actions/tasks.js'); A.moveTask(S.store.state.tasks.find((x) => x.key === ${JSON.stringify(t1.key)}), 'k2', { by: 'você' })`);
    await round();
    const merged = (await local())[t1.key];
    t.equal([merged?.title, merged?.columnId], ['Login com SSO (Entra ID)', 'k2'], 'fusão sem perguntar: título do Bruno, coluna da Ana');
    const after = (await server())[t1.key];
    t.equal([after?.task?.title, after?.task?.columnId], ['Login com SSO (Entra ID)', 'k2'], 'a fusão sobe para o servidor');
    t.check(await t.js(`return !!S.store.state.tasks.find((x) => x.key === ${JSON.stringify(t1.key)}).needsInput`), 'a espera local continua depois da fusão');

    // 4. Exclusões: Bruno apaga a dele; Ana apaga uma dela.
    const b = (await server())['APP-2'];
    await bruno('POST', '/v1/tasks/push', { changes: [{ op: 'delete', workspace: 'app', baseRev: b.rev, id: b.id }] });
    await t.js(`S.store.state.tasks = S.store.state.tasks.filter((x) => x.key !== 'APP-4'); S.commit()`);
    await round();
    t.check(!(await local())['APP-2'], 'tarefa apagada pelo Bruno some daqui');
    t.check((await server())['APP-4']?.deleted, 'tarefa apagada aqui vira exclusão no servidor');
  } finally {
    srv.stop();
  }
});
