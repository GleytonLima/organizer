// Quadro de tarefas: agente cria e move, pede uma decisão (Em espera), supervisor sugere,
// você responde pela gaveta da tarefa e a resposta chega no terminal de origem; agente conclui.
const { suite, seed } = require('./harness');

const TASK_UI = { A: './js/actions/tasks.js', SEL: './js/ui/tasks/selection.js' };

suite('tarefas', {
  seed: (dir) => {
    const [app, site] = seed.makeFolders(dir, ['minha-app', 'site']);
    return seed.state([
      seed.project('p1', 'minha-app', [app], [
        seed.group('g1', 'Agente', [seed.term('dev1', 'devtools', app)]),
        seed.group('g2', 'Serviços', [seed.term('be', 'backend', app)]),
      ]),
      seed.project('p2', 'site', [site], [seed.group('g3', 'Site', [])]), // outro projeto, para o escopo "todos"
    ]);
  },
}, async (t) => {
  t.check(await t.shellReady('dev1'), 'terminal do agente pronto');
  const agent = await t.mcp('dev1');

  const cols = await agent.tool('list_columns');
  t.equal(cols.data?.columns.map((c) => c.name), ['A fazer', 'Fazendo', 'Feito'], 'colunas padrão do projeto');

  const created = await agent.tool('create_task', { title: 'Subir backend local', description: 'npm run dev e validar /health' });
  const task = created.data || {};
  t.check(created.ok && /^[A-Z]+-\d+$/.test(task.key || ''), 'create_task devolve uma chave', created.error || task.key);
  t.equal(task.column, 'A fazer', 'tarefa nova entra na primeira coluna');
  t.equal(task.terminal, 'devtools', 'terminal de origem é o do agente');

  const moved = await agent.tool('move_task', { column: 'fazendo', note: 'começando' }); // sem `task`: a atual do terminal
  t.equal(moved.data?.column, 'Fazendo', 'move_task aceita nome sem acento/maiúsculas');
  const wrong = await agent.tool('move_task', { column: 'Em Homologação' });
  t.check(!wrong.ok && /Coluna não encontrada/.test(wrong.error), 'coluna inexistente é recusada com erro claro', wrong.error);

  const question = 'Qual porta usar para o backend: 3000 ou 8080?';
  const waiting = await agent.tool('request_input', { question });
  t.equal(waiting.data?.waiting?.question, question, 'request_input deixa a tarefa em espera');
  t.check(await t.js(`return !!S.store.state.tasks[0].needsInput`), 'estado da tarefa: needsInput preenchido');

  // Supervisor: outro agente, sem terminal.
  const sup = await t.mcp('');
  const list = await sup.tool('list_waiting_tasks', { project: 'minha-app' });
  t.equal(list.data?.map?.((x) => x.key), [task.key], 'supervisor vê a tarefa em espera');
  const answer = 'Use 8080 porque a 3000 e do frontend';
  const sug = await sup.tool('suggest_reply', { task: task.key, suggestion: answer });
  t.equal(sug.data?.waiting?.suggestion, answer, 'suggest_reply guarda a sugestão');

  // Você: abre a tarefa, a resposta vem pré-preenchida, envia ao terminal.
  await t.js(`A.setTaskView('panel'); SEL.openTask(S.store.state.tasks[0].id)`, TASK_UI);
  const draft = await t.waitFor(() => t.js(`return document.querySelector('[data-draft=reply]')?.value`));
  t.equal(draft, answer, 'resposta pré-preenchida com a sugestão');
  await t.js(`document.querySelector('.td-waiting .btn.primary').click()`);
  const arrived = await t.waitFor(async () => (await t.lines('dev1', 30)).includes(answer));
  t.check(arrived, 'resposta chega no terminal de origem');
  t.check(await t.waitFor(() => t.js(`return S.store.state.tasks[0].needsInput === null`)), 'espera encerrada após responder');
  const backend = await t.lines('be', 30);
  t.check(!backend.includes(answer), 'resposta não vai para outro terminal');

  const done = await agent.tool('complete_task', { task: task.key, summary: 'Rodando na 8080' });
  t.equal(done.data?.column, 'Feito', 'complete_task move para a última coluna');
  const detail = await agent.tool('get_task', { task: task.key });
  const types = (detail.data?.history || []).map((h) => h.type);
  t.check(['created', 'moved', 'input', 'reply'].every((x) => types.includes(x)), 'histórico registra criação, movimento, espera e resposta', JSON.stringify(types));

  const cli = await t.bo(['task', 'list'], { terminal: 'dev1' });
  t.check(cli.code === 0 && cli.stdout.includes(task.key), '`bo task list` mostra a tarefa', cli.stderr || cli.stdout);

  // subtarefas: criar pela API e pelo CLI, ver na mãe, progresso pela fração concluída
  const parent = (await agent.tool('create_task', { title: 'Tarefa grande' })).data;
  const sub1 = (await agent.tool('create_task', { title: 'Parte 1', parent: parent.key })).data;
  const sub2 = await t.bo(['task', 'add', 'Parte 2', '--parent', parent.key], { terminal: 'dev1' });
  t.equal(sub1?.parent, parent.key, 'create_task com parent cria uma subtarefa');
  t.includes(sub2.stdout, `↳ ${parent.key}`, '`bo task add --parent` cria uma subtarefa');
  await agent.tool('complete_task', { task: sub1.key });
  const big = (await agent.tool('get_task', { task: parent.key })).data;
  t.equal(big?.subtasks?.map((s) => s.title), ['Parte 1', 'Parte 2'], 'get_task lista as subtarefas');
  t.check(big.history.some((h) => h.text.includes(`Nova subtarefa ${sub1.key}`)), 'a mãe registra cada subtarefa no histórico');
  await t.js(`SEL.openTask(S.store.state.tasks.find((x) => x.key === ${JSON.stringify(parent.key)}).id)`, TASK_UI);
  const drawer = await t.waitFor(async () => {
    const txt = await t.js(`return document.querySelector('#task-detail').innerText`);
    return txt.includes('Parte 2') && txt;
  });
  t.check(drawer && drawer.includes('Parte 1') && drawer.includes('Nova subtarefa'), 'gaveta da mãe mostra as subtarefas', drawer);
  t.equal(await t.js(`return document.querySelector('.task-card.selected .task-progress span')?.style.width || null`), '50%', 'progresso da mãe = metade das subtarefas concluída');
  await t.js(`SEL.openTask(S.store.state.tasks.find((x) => x.key === ${JSON.stringify(sub1.key)}).id)`, TASK_UI);
  t.check(await t.waitFor(async () => (await t.js(`return document.querySelector('#task-detail').innerText`)).includes(`Subtarefa de ${parent.key}`)), 'gaveta da subtarefa leva à mãe');
  const loose = (await agent.tool('create_task', { title: 'Solta' })).data;
  t.includes((await t.bo(['task', 'parent', loose.key, parent.key], { terminal: 'dev1' })).stdout, `↳ ${parent.key}`, '`bo task parent` torna uma tarefa existente subtarefa');
  const cycle = await agent.tool('set_task_parent', { task: parent.key, parent: loose.key });
  t.check(!cycle.ok, 'ciclo (mãe virar filha da própria subtarefa) é recusado', JSON.stringify(cycle));
  await t.js(`SEL.closeTask()`, TASK_UI);

  // lista do painel: busca, chips, "Mostrar mais" e escopo "Todos os projetos"
  await t.js(`S.store.state.focusProjectId = 'p1'; S.store.state.taskScope = 'project'; S.store.state.sideTab = 'tasks'; A.setTaskView('panel');
    const p1 = S.projectById('p1'); for (let i = 1; i <= 25; i++) A.createTask(p1, { title: 'Lote ' + i });
    A.createTask(S.projectById('p2'), { title: 'Página de preços' });`, TASK_UI);
  const titles = () => t.js(`return [...document.querySelectorAll('#taskpanel .tp-list .task-title')].map((x) => x.textContent)`);
  const search = (q) => t.js(`const i = document.querySelector('#taskpanel [data-draft="task-query"]'); i.value = ${JSON.stringify(q)}; i.dispatchEvent(new Event('input'))`);
  const todo = () => t.js(`const s = document.querySelector('#taskpanel .tp-section[data-section]:not([data-section="__waiting"])'); return { count: +s.querySelector('.tp-count').textContent, cards: s.querySelectorAll('.task-card').length, more: s.querySelector('.tp-more')?.textContent || null }`);
  const first = await t.waitFor(async () => ((await todo()).count >= 25 ? todo() : null));
  t.equal([first?.cards, first?.more], [20, `Mostrar mais ${first.count - 20}`], 'seção grande mostra 20 tarefas e "Mostrar mais"');
  await t.js(`document.querySelector('#taskpanel .tp-more').click()`);
  t.equal((await t.waitFor(async () => ((await todo()).more === null ? todo() : null)))?.cards, first.count, '"Mostrar mais" abre o resto');
  await search('subir BACKEND');
  t.equal(await t.waitFor(async () => ((await titles()).length === 1 ? titles() : null)), ['Subir backend local'], 'busca por texto (sem diferenciar maiúsculas)');
  await search(task.key);
  t.equal(await t.waitFor(async () => ((await titles()).length === 1 ? titles() : null)), ['Subir backend local'], 'busca pela chave da tarefa');
  await search('');
  await t.js(`S.store.state.tasks.find((x) => x.title === 'Lote 3').memoryRefs = ['m-1']; S.commit(); document.querySelector('#taskpanel [data-chip="memory"]').click()`);
  t.equal(await t.waitFor(async () => ((await titles()).length === 1 ? titles() : null)), ['Lote 3'], 'chip "Com memória" mostra só as tarefas com memória vinculada');
  await t.js(`document.querySelector('#taskpanel [data-chip="memory"]').click()`);
  t.check(!(await titles()).includes('Página de preços'), 'no projeto em foco, as tarefas de outro projeto não aparecem');
  await t.js(`document.querySelector('#taskpanel .tp-scope').click()`);
  await t.js(`[...document.querySelectorAll('.menu-item')].find((b) => b.textContent.includes('Todos os projetos')).click()`);
  const groups = await t.waitFor(() => t.js(`const g = [...document.querySelectorAll('#taskpanel .tp-group-name')].map((x) => x.textContent); return g.length > 1 ? g : null`));
  t.equal(groups, ['minha-app', 'site'], '"Todos os projetos" mostra um bloco por projeto');
  t.includes(await t.js(`return document.querySelector('#taskpanel .tp-scope').textContent`), 'Todos os projetos', 'o topo mostra o escopo escolhido');
  t.check((await titles()).includes('Página de preços'), 'tarefas dos outros projetos aparecem');
  await search('preços');
  t.equal(await t.waitFor(async () => ((await titles()).length === 1 ? titles() : null)), ['Página de preços'], 'a busca vale para todos os projetos');
  await search('');

  // tags: pela API/MCP, CLI, gaveta e cartão; filtro por tag (chip ou "#tag") e por memória
  const tagged = (await agent.tool('create_task', { title: 'História do Jira', tags: ['jira:PROJ-123', ' front end '] })).data;
  t.equal(tagged?.tags, ['jira:PROJ-123', 'front-end'], 'create_task aceita tags (espaços viram hífen, grafia mantida)');
  t.equal((await agent.tool('tag_task', { task: tagged.key, tags: ['JIRA:proj-123', 'api'] })).data?.tags, ['jira:PROJ-123', 'front-end', 'api'], 'tag_task acrescenta sem duplicar (ignora maiúsculas)');
  t.includes((await t.bo(['task', 'tag', tagged.key, 'api', '--remove'], { terminal: 'dev1' })).stdout, '#front-end', '`bo task tag --remove` tira a tag e mostra as restantes');
  const byTag = (await t.bo(['task', 'list', '--tag', 'JIRA:PROJ-123'], { terminal: 'dev1' })).stdout.trim().split('\n');
  t.check(byTag.length === 1 && byTag[0].startsWith(tagged.key), '`bo task list --tag` filtra pela tag', byTag.join(' | '));
  await t.js(`SEL.openTask(S.store.state.tasks.find((x) => x.key === ${JSON.stringify(tagged.key)}).id)`, TASK_UI);
  await t.waitFor(() => t.js(`return !!document.querySelector('#task-detail .td-tag-input')`));
  await t.js(`const i = document.querySelector('#task-detail .td-tag-input'); i.value = 'urgente'; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`);
  const drawerTags = () => t.js(`return [...document.querySelectorAll('#task-detail .td-tag')].map((x) => x.textContent)`);
  t.equal(await t.waitFor(async () => ((await drawerTags()).length === 3 ? drawerTags() : null)), ['#jira:PROJ-123', '#front-end', '#urgente'], 'a gaveta acrescenta tags pela caixa (Enter)');
  await t.js(`[...document.querySelectorAll('#task-detail .td-tag')].find((x) => x.textContent === '#urgente').querySelector('.td-tag-x').click()`);
  t.equal(await t.waitFor(async () => ((await drawerTags()).length === 2 ? drawerTags() : null)), ['#jira:PROJ-123', '#front-end'], 'o × da gaveta tira a tag');
  await t.js(`SEL.closeTask()`, TASK_UI);
  t.check(await t.waitFor(() => t.js(`return [...document.querySelectorAll('#taskpanel .tp-tags .chip.tag')].some((c) => c.textContent === '#front-end')`)), 'as tags em uso aparecem como filtros no painel');
  await t.js(`[...document.querySelectorAll('#taskpanel .task-chip.tag')].find((c) => c.textContent === '#jira:PROJ-123').click()`);
  t.equal(await t.waitFor(async () => ((await titles()).length === 1 ? titles() : null)), ['História do Jira'], 'clicar na tag do cartão filtra a lista por ela');
  await t.js(`document.querySelector('#taskpanel .tp-tags .chip.tag.on').click()`);
  await search('#front-END');
  t.equal(await t.waitFor(async () => ((await titles()).length === 1 ? titles() : null)), ['História do Jira'], '"#tag" na busca filtra pela tag');
  await search('');
  await t.js(`document.querySelector('#taskpanel [data-chip="by-memory"]').click()`);
  t.equal(await t.waitFor(() => t.js(`return document.querySelector('.picker-card [type=submit]')?.textContent || null`)), 'Filtrar', '"Por memória…" abre o seletor com o botão "Filtrar" (não "Salvar vínculos")');
  await t.js(`document.querySelector('.picker-card .btn.ghost').click()`);
  await t.js(`const f = await import('./js/tasks/filter.js'); f.setMemoryFilter([{ gid: 'm-1', text: 'Decisão X' }])`);
  t.equal(await t.waitFor(async () => ((await titles()).length === 1 ? titles() : null)), ['Lote 3'], 'filtro por memória mostra as tarefas que a referenciam');
  t.includes(await t.js(`return document.querySelector('#taskpanel .chip-memory').textContent`), 'Memória: Decisão X', 'o chip mostra a memória escolhida');
  await t.js(`document.querySelector('#taskpanel .chip-memory .chip-x').click()`);
  t.check(await t.waitFor(async () => (await titles()).length > 1), 'o × tira o filtro por memória');
  // aviso de tarefa (ex.: "Concluída") no sino: clicar abre a gaveta da tarefa e marca como lido
  await t.js(`const c = await import('./js/notify/center.js'); c.clearNotifications();
    const tk = S.store.state.tasks.find((x) => x.key === ${JSON.stringify(tagged.key)});
    c.pushNotification({ taskId: tk.id, label: tk.key, body: 'Concluída: ' + tk.title });`);
  await t.js(`document.querySelector('.bell-btn').click()`);
  await t.waitFor(() => t.js(`return [...document.querySelectorAll('.menu-item')].some((b) => b.textContent.includes('Concluída: História do Jira'))`));
  await t.js(`[...document.querySelectorAll('.menu-item')].find((b) => b.textContent.includes('Concluída: História do Jira')).click()`);
  t.includes(await t.waitFor(() => t.js(`const d = document.querySelector('#task-detail:not(.hidden) .task-key'); return d && d.textContent`)), tagged.key, 'clicar no aviso de uma tarefa abre a tarefa');
  t.equal(await t.js(`return (await import('./js/notify/center.js')).unreadCount()`), 0, 'e o aviso fica lido');
  await t.js(`SEL.closeTask()`, TASK_UI);
  await t.js(`S.store.state.taskScope = 'project'; A.setTaskView('off')`, TASK_UI);
});
