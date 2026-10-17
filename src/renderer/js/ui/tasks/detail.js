// Gaveta de detalhe da tarefa (à direita): título, coluna, espera/resposta, descrição e histórico.
import { $, el, mount, stop } from '../../core/dom.js';
import { findTerm } from '../../core/store.js';
import { termLabel, timeAgo } from '../../core/format.js';
import { columnsOf } from '../../tasks/columns.js';
import { taskProject } from '../../tasks/queries.js';
import { updateTask, deleteTask } from '../../actions/tasks.js';
import { activate } from '../../actions/terminals.js';
import { iconButton } from '../components.js';
import { icon } from '../icons.js';
import { selectedTask, closeTask } from './selection.js';
import { waitingBox } from './detail-waiting.js';

// Rascunhos por tarefa: sobrevivem aos re-renders (git, processos…) enquanto você digita.
const drafts = new Map();
const draftOf = (task) => {
  if (!drafts.has(task.id)) drafts.set(task.id, {});
  return drafts.get(task.id);
};

function saveField(task, key) {
  const draft = draftOf(task);
  if (draft[key] === undefined) return;
  updateTask(task, { [key]: draft[key] });
  draft[key] = undefined;
}

function editable(task, key, { multiline = false, placeholder = '' } = {}) {
  const draft = draftOf(task);
  const node = el(multiline ? 'textarea' : 'input', {
    class: multiline ? 'input textarea td-desc' : 'td-title',
    'data-draft': key,
    placeholder,
    ...(multiline ? { rows: 5 } : { type: 'text' }),
    oninput: (e) => (draft[key] = e.target.value),
    onblur: () => saveField(task, key),
    onkeydown: (e) => !multiline && e.key === 'Enter' && e.target.blur(),
  });
  node.value = draft[key] ?? task[key];
  return node;
}

const columnSelect = (task) =>
  el(
    'select',
    { class: 'input select td-column', title: 'Coluna', onchange: (e) => updateTask(task, { columnId: e.target.value }) },
    columnsOf(taskProject(task)).map((c) => el('option', { value: c.id, selected: c.id === task.columnId, text: c.name })),
  );

function meta(task) {
  const origin = findTerm(task.terminalId);
  const item = (label, value) => el('div', { class: 'td-meta-item' }, el('span', { class: 'td-meta-label', text: label }), value);
  return el(
    'div',
    { class: 'td-meta' },
    item('Terminal', origin ? el('button', { class: 'link', onclick: stop(() => activate(origin.t.id)) }, icon('terminal'), termLabel(origin.t)) : el('span', { text: '—' })),
    item('Repositório', el('span', { text: task.repo ? `${task.repo} · ${task.branch || '?'}` : task.branch || '—' })),
    item('Progresso', el('span', { text: task.progress == null ? '—' : `${task.progress}%` })),
    item('Criada', el('span', { text: timeAgo(task.createdAt) })),
  );
}

const history = (task) =>
  el(
    'ol',
    { class: 'td-history' },
    [...task.history].reverse().map((h) =>
      el('li', { class: `td-event ev-${h.type}` }, el('div', { class: 'td-event-meta', text: `${h.by} · ${timeAgo(h.at)}` }), el('div', { text: h.text })),
    ),
  );

/** Re-render preservando foco e cursor do campo em edição. */
function remount(node, children) {
  const active = document.activeElement;
  const key = node.contains(active) ? active.dataset.draft : null;
  const sel = key ? [active.selectionStart, active.selectionEnd] : null;
  mount(node, children);
  const again = key && node.querySelector(`[data-draft="${key}"]`);
  if (again) {
    again.focus();
    again.setSelectionRange?.(...sel);
  }
}

export function renderTaskDetail() {
  const node = $('#task-detail');
  const task = selectedTask();
  node.classList.toggle('hidden', !task);
  if (!task) return;
  remount(node, [
    el(
      'header',
      { class: 'td-header' },
      el('span', { class: 'task-key', text: task.key }),
      columnSelect(task),
      el('span', { class: 'spacer' }),
      iconButton('trash', 'Excluir tarefa', async () => (await deleteTask(task)) && closeTask(), 'td-delete'),
      iconButton('collapse', 'Fechar', closeTask),
    ),
    editable(task, 'title', { placeholder: 'Título' }),
    task.needsInput ? waitingBox(task, draftOf(task)) : null,
    meta(task),
    el('label', { class: 'td-label', text: 'Descrição' }),
    editable(task, 'description', { multiline: true, placeholder: 'Contexto, critérios de pronto…' }),
    el('label', { class: 'td-label', text: 'Histórico' }),
    history(task),
  ]);
}
