// Quadro de tarefas: agente cria e move, pede uma decisão (Em espera), supervisor sugere,
// você responde pela gaveta da tarefa e a resposta chega no terminal de origem; agente conclui.
const { suite, seed } = require('./harness');

const TASK_UI = { A: './js/actions/tasks.js', SEL: './js/ui/tasks/selection.js' };

suite('tarefas', {
  seed: (dir) => {
    const [app] = seed.makeFolders(dir, ['minha-app']);
    return seed.state([
      seed.project('p1', 'minha-app', [app], [
        seed.group('g1', 'Agente', [seed.term('dev1', 'devtools', app)]),
        seed.group('g2', 'Serviços', [seed.term('be', 'backend', app)]),
      ]),
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
  await t.js(`SEL.closeTask(); A.setTaskView('off')`, TASK_UI);
});
