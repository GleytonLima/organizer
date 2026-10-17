// Sync da memória com o bo-memory-server: envio e recebimento, escopos (projeto pela chave de
// sincronização, pasta pelo remote git, global), conflito e resolução, exclusões e progresso/Retomar.
// "Ana" é este app; "Bruno" é outra máquina falando direto com o servidor.
const path = require('path');
const { execFileSync } = require('child_process');
const { suite, seed } = require('./harness');
const { startMemoryServer } = require('./lib/memory-server');

process.env.BO_SYNC_INTERVAL_MS = '600000'; // só as rodadas que o teste pede (e as logo após gravar)

suite('memória: sync com o servidor', {
  seed: (dir) => {
    const [backend] = seed.makeFolders(path.join(dir, 'repos'), ['backend']);
    execFileSync('git', ['remote', 'add', 'origin', 'git@github.com:Time/Backend.git'], { cwd: backend });
    return seed.state([seed.project('pA', 'App', [backend], [seed.group('gA', 'Terminais', [seed.term('a1', 'a1', backend)])])]);
  },
}, async (t) => {
  const srv = await startMemoryServer();
  if (srv.skip) return t.check(true, `(pulado: ${srv.skip})`);
  process.env.BO_SYNC_URL = srv.url;
  process.env.BO_SYNC_TOKEN = srv.tokenA;
  const bruno = srv.as(srv.tokenB);
  const a = await t.mcp('a1');
  const sync = () => t.bo(['mem', 'sync'], { terminal: 'a1' });
  const serverList = async (q) => (await bruno('GET', `/v1/memories?${q}`)).data?.items || [];
  const local = (id) => t.js(`return await api.memory.get(${JSON.stringify(id)})`);
  const panelText = () => t.js(`return document.querySelector('#taskpanel')?.innerText || ''`);
  const shot = async (name) => process.env.BO_TEST_SHOTS && require('fs').writeFileSync(path.join(process.env.BO_TEST_SHOTS, `sync-${name}.png`), (await t.wc.capturePage()).toPNG());

  try {
    // Projeto sem chave de sincronização: fica só local. Global vai para o time.
    const d1 = (await a.tool('record_decision', { text: 'Usamos filas porque o processamento é assíncrono.' })).data;
    const g1 = (await a.tool('record_decision', { text: 'Commits em português porque o time fala português.', scope: 'global' })).data;
    t.includes((await sync()).stdout, 'Sincronizado', 'bo mem sync sincroniza com o servidor');
    t.check(!(await serverList('workspace=app&scope=project')).length, 'projeto sem chave de sincronização não sobe');
    t.check((await serverList('')).some((m) => m.id === g1.gid && m.author?.name === 'Ana'), 'decisão global sobe com a autora');

    // Com a chave, as memórias do projeto sobem; a de pasta vai pelo remote normalizado.
    const proj = await a.tool('create_project', { name: 'App', syncKey: 'app' });
    t.equal(proj.data?.syncKey, 'app', 'create_project define a chave de sincronização');
    const n1 = (await a.tool('remember_note', { text: 'O backend sobe na porta 8080.', scope: 'folder', folder: 'backend' })).data;
    await t.wait(300);
    await sync();
    t.check((await serverList('workspace=app&kind=decision')).some((m) => m.id === d1.gid), 'decisão do projeto sobe pela chave de sincronização');
    const folderNote = (await serverList('folder=github.com/time/backend')).find((m) => m.id === n1.gid);
    t.equal(folderNote?.folder, 'github.com/time/backend', 'nota de pasta sobe com o remote normalizado');

    // Recebimento: o que Bruno grava chega ao app.
    const fromB = await bruno('POST', '/v1/memories', { kind: 'decision', scope: 'project', workspace: 'app', text: 'Deploy às sextas não, porque ninguém fica de plantão.' });
    await sync();
    const decisions = (await a.tool('list_decisions')).data || [];
    const got = decisions.find((d) => d.gid === fromB.data?.id);
    t.check(got && got.source === 'Bruno', 'decisão de outro dev chega com o autor', JSON.stringify(decisions.map((d) => [d.text, d.source])));

    // Conflito: Bruno edita, Ana edita a mesma memória antes de receber.
    const before = (await serverList('workspace=app&kind=decision')).find((m) => m.id === d1.gid);
    const edited = await bruno('PUT', `/v1/memories/${d1.gid}`, { ...before, text: 'Usamos filas (RabbitMQ) porque o processamento é assíncrono.', baseRev: before.rev });
    t.equal(edited.status, 200, 'outro dev edita a decisão no servidor');
    await t.js(`await api.memory.update(${JSON.stringify(d1.id)}, { text: 'Usamos filas (SQS) porque o processamento é assíncrono.' })`);
    await sync();
    const conflicted = await t.waitFor(async () => (await local(d1.id))?.conflict && local(d1.id));
    t.includes(conflicted?.conflict?.text, 'RabbitMQ', 'edição concorrente fica marcada em conflito com a versão do servidor');
    t.includes((await t.bo(['mem', 'decisions'], { terminal: 'a1' })).stdout, '[em conflito]', 'bo mem decisions mostra o conflito');
    await t.js(`S.store.state.sideTab = 'memory'; S.store.state.taskView = 'panel'; S.commit();`);
    const shown = await t.waitFor(async () => /em conflito/.test(await panelText()) && panelText());
    t.includes(shown, 'em conflito — resolver', 'aba Memória marca a memória em conflito');
    t.match(shown, /sincronizado às \d/, 'rodapé da aba Memória mostra o estado do sync');
    await shot('conflito');

    // Mescla: grava e sobe sobre a versão do servidor.
    const merged = 'Usamos filas (SQS na nuvem, RabbitMQ local) porque o processamento é assíncrono.';
    await t.js(`await api.sync.resolve(${JSON.stringify(d1.id)}, 'merge', ${JSON.stringify(merged)})`);
    await sync();
    t.equal((await serverList('workspace=app&kind=decision')).find((m) => m.id === d1.gid)?.text, merged, 'mescla resolvida sobe para o servidor');
    t.equal((await local(d1.id))?.conflict ?? null, null, 'conflito resolvido some do app');

    // Exclusões nos dois sentidos (tombstones).
    await a.tool('forget_memory', { id: n1.id });
    await sync();
    t.check(!(await serverList('folder=github.com/time/backend')).some((m) => m.id === n1.gid), 'apagar no app apaga no servidor');
    await bruno('DELETE', `/v1/memories/${fromB.data.id}?baseRev=${fromB.data.rev}`);
    await sync();
    t.check(!((await a.tool('list_decisions')).data || []).some((d) => d.gid === fromB.data.id), 'apagar no servidor apaga no app');

    // Progresso: salvar, outro dev retoma; depois o app retoma de volta e a tarefa volta ao quadro.
    const task = (await a.tool('create_task', { title: 'Login com refresh token', description: 'Sessão de 30 dias.' })).data;
    const saved = await a.tool('save_progress', { task: task.key, status: 'Login feito; falta o refresh.', nextSteps: ['Implementar refresh', 'Testar expiração'] });
    t.equal(saved.data?.kind, 'progress', 'save_progress grava uma memória de progresso');
    await sync();
    const onServer = (await serverList('workspace=app&kind=progress')).find((m) => m.taskKey === task.key);
    t.equal(onServer?.progress?.nextSteps, ['Implementar refresh', 'Testar expiração'], 'progresso sobe com os próximos passos');
    t.equal(onServer?.progress?.task?.title, 'Login com refresh token', 'progresso leva o título da tarefa');
    const claimed = await bruno('POST', `/v1/progress/app/${task.key}/claim`);
    t.equal(claimed.data?.progress?.owner?.name, 'Bruno', 'outro dev retoma a tarefa no servidor');
    await sync();
    t.equal((await local(saved.data.id))?.progress?.owner?.name, 'Bruno', 'o app vê com quem a tarefa está');
    await t.js(`[...document.querySelectorAll('#taskpanel .mem-filters .chip')].find((c) => c.textContent === 'Progresso').click()`);
    const prog = await t.waitFor(async () => /com Bruno/.test(await panelText()) && panelText());
    t.check(prog && prog.includes('Implementar refresh') && prog.includes('Login com refresh token'), 'aba Memória mostra o progresso, os próximos passos e o dono', prog);
    await shot('progresso');

    // Nesta máquina a tarefa some do quadro; "Retomar" a traz de volta com o status no histórico.
    await t.js(`S.store.state.tasks = S.store.state.tasks.filter((x) => x.key !== ${JSON.stringify(task.key)}); S.commit();`);
    const adopted = await t.js(
      `const m = await api.sync.claim(${JSON.stringify(saved.data.id)});
       const task = A.adoptTaskFromProgress(S.projectById('pA'), m);
       return { key: task.key, title: task.title, owner: m.progress.owner.name, last: task.history.at(-1).text };`,
      { A: './js/actions/task-adopt.js' },
    );
    t.equal([adopted.key, adopted.title, adopted.owner], [task.key, 'Login com refresh token', 'Ana'], 'Retomar faz o claim e recria a tarefa local');
    t.includes(adopted.last, 'Implementar refresh', 'a tarefa retomada traz os próximos passos no histórico');

    // Vínculos, "a revisar" e ideias sincronizam nos dois sentidos.
    const base = (await a.tool('record_decision', { text: 'Respostas em até 2 s porque o app é interativo.' })).data;
    const dep = (await a.tool('remember_note', { text: 'Cache de 60 s nas listagens.', links: [{ id: base.id, type: 'depends' }] })).data;
    const idea = (await a.tool('remember_note', { kind: 'idea', text: 'Painel de latência por rota.' })).data;
    await sync();
    const onSrv = (await serverList('workspace=app&kind=note')).find((m) => m.id === dep.gid);
    t.equal(onSrv?.refs, [{ id: base.gid, type: 'depends' }], 'vínculo sobe para o servidor pelo gid');
    const links = (await bruno('GET', `/v1/memories/${base.gid}/links`)).data;
    t.equal(links?.impact?.map((l) => l.id), [dep.gid], 'servidor calcula a cadeia de impacto do que o app enviou');
    t.equal((await serverList('workspace=app&kind=idea')).find((m) => m.id === idea.gid)?.status, 'open', 'ideia sobe aberta');
    await bruno('POST', '/v1/memories/review', { ids: [dep.gid], reason: 'Mudou: respostas em até 1 s', source: base.gid });
    await sync();
    t.includes((await local(dep.id))?.review?.reason, 'até 1 s', 'marca "a revisar" feita pela web chega ao app');
    await a.tool('mark_reviewed', { id: dep.id });
    await sync();
    t.equal((await serverList('workspace=app&kind=note')).find((m) => m.id === dep.gid)?.review ?? null, null, 'revisar no app tira a marca no servidor');
  } finally {
    srv.stop();
  }
});
