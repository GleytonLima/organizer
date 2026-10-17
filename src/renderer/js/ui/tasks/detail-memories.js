// Seção "Memórias" da gaveta da tarefa: as decisões, como fazer e ideias que dão contexto à tarefa
// (vão para o agente no get_task). Vincula por busca, com sugestões parecidas com o título.
import { el } from '../../core/dom.js';
import { notify } from '../../core/store.js';
import { taskProject } from '../../tasks/queries.js';
import { memoryContext } from '../../memory/context.js';
import { kindOf } from '../../memory/kinds.js';
import { linkTaskMemories, unlinkTaskMemory, cachedTaskMemories } from '../../actions/task-memories.js';
import { iconButton } from '../components.js';
import { icon } from '../icons.js';

const DEBOUNCE_MS = 200;
const search = { taskId: null, query: '', items: [], open: false };
let timer = null;

async function suggest(task, query) {
  const q = query.trim() || task.title;
  const { items } = await api.memory.search(q, { context: memoryContext(taskProject(task)), limit: 8 });
  const taken = new Set(task.memoryRefs || []);
  Object.assign(search, { taskId: task.id, query, items: items.filter((m) => !taken.has(m.gid) && m.kind !== 'progress').slice(0, 5), open: true });
  notify();
}

async function add(task, m) {
  await linkTaskMemories(task, [m.gid]);
  Object.assign(search, { query: '', items: [], open: false });
  notify();
}

const memoryRow = (task, m) =>
  el(
    'div',
    { class: 'td-mem' },
    icon(kindOf(m.kind).icon, 'td-mem-icon'),
    el('span', { class: 'td-mem-text', title: m.text, text: m.text }),
    m.review ? el('span', { class: 'mem-flag static', title: m.review.reason, text: 'a revisar' }) : null,
    iconButton('close', 'Desvincular', () => unlinkTaskMemory(task, m.gid), 'reveal'),
  );

export function memoriesBox(task) {
  const linked = cachedTaskMemories(task);
  const mine = search.taskId === task.id && search.open;
  const input = el('input', {
    type: 'text',
    class: 'input',
    'data-draft': 'task-memory-query',
    placeholder: 'Vincular memória… (vazio: parecidas com o título)',
    spellcheck: 'false',
    onfocus: (e) => suggest(task, e.target.value),
    oninput: (e) => {
      clearTimeout(timer);
      const v = e.target.value;
      timer = setTimeout(() => suggest(task, v), DEBOUNCE_MS);
    },
    onkeydown: (e) => e.key === 'Escape' && Object.assign(search, { open: false }) && notify(),
  });
  input.value = search.taskId === task.id ? search.query : '';
  return el(
    'div',
    { class: 'td-memories' },
    linked.length ? linked.map((m) => memoryRow(task, m)) : el('div', { class: 'td-mem-empty', text: 'Nenhuma. Vincule decisões, “como fazer” e ideias que o agente precisa saber.' }),
    input,
    mine && search.items.length
      ? el(
          'div',
          { class: 'link-results' },
          search.items.map((m) => el('button', { type: 'button', class: 'link-suggestion', title: m.text, onclick: () => add(task, m) }, icon(kindOf(m.kind).icon), el('span', { text: m.text }))),
        )
      : null,
  );
}
