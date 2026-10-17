// `bo task <ação>`: o quadro de tarefas pela linha de comando (mesmos métodos do MCP).
const { request } = require('./client');

const line = (t) =>
  `${t.key}  [${t.column}]  ${t.title}${t.waiting ? `  ⏸ em espera: ${t.waiting.question}` : ''}${t.branch ? `  ⎇ ${t.branch}` : ''}`;

const ACTIONS = {
  list: { usage: 'list [--column C]', run: async (_pos, o) => (await request('task_list', { column: o.column })).map(line).join('\n') || '(sem tarefas)' },
  columns: {
    usage: 'columns',
    run: async () => (await request('task_columns')).columns.map((c) => `${c.name} — ${c.description || ''}`).join('\n'),
  },
  add: {
    usage: 'add <título...> [--desc D] [--column C]',
    run: async (pos, o) => line(await request('task_create', { title: pos.join(' '), description: o.desc, column: o.column })),
  },
  move: { usage: 'move <tarefa> <coluna...>', run: async ([task, ...col]) => line(await request('task_move', { task, column: col.join(' ') })) },
  report: {
    usage: 'report <tarefa> <texto...> [--progress N]',
    run: async ([task, ...text], o) => line(await request('task_report', { task, message: text.join(' '), progress: o.progress && Number(o.progress) })),
  },
  wait: { usage: 'wait <tarefa> <pergunta...>', run: async ([task, ...q]) => line(await request('task_input', { task, question: q.join(' ') })) },
  done: { usage: 'done [tarefa] [--summary S]', run: async ([task], o) => line(await request('task_complete', { task, summary: o.summary })) },
  waiting: { usage: 'waiting', run: async () => (await request('task_waiting')).map(line).join('\n') || '(nada em espera)' },
};

const taskHelp = () => ['bo task — quadro de tarefas', ...Object.values(ACTIONS).map((a) => `  bo task ${a.usage}`)].join('\n');

/** `pos` e `opts` já vêm do parser de bin/lib/commands.js. */
async function runTask({ pos, opts }) {
  const [name, ...rest] = pos;
  const action = ACTIONS[name];
  if (!action) return console.log(taskHelp());
  console.log(await action.run(rest, opts));
}

module.exports = { runTask };
