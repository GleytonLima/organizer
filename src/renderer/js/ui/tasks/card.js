// Cartão de tarefa, usado no painel (compacto) e no quadro (completo).
import { el, stop } from '../../core/dom.js';
import { findTerm } from '../../core/store.js';
import { termLabel, timeAgo } from '../../core/format.js';
import { activate } from '../../actions/terminals.js';
import { icon } from '../icons.js';
import { draggable } from '../dnd.js';
import { taskMenu } from './menus.js';
import { openTask, isOpen } from './selection.js';
import { parentOf, subtasksOf, taskProject } from '../../tasks/queries.js';
import { isDoneColumn } from '../../tasks/columns.js';
import { tagsOf } from '../../tasks/tags.js';
import { toggleTaskTag } from '../../tasks/filter.js';

const lastReport = (task) => [...task.history].reverse().find((h) => h.type === 'report')?.text;

function progressBar(value) {
  if (value == null) return null;
  return el('div', { class: 'task-progress', title: `${value}%` }, el('span', { style: { width: `${value}%` } }));
}

/** Progresso: o informado pelo agente ou, numa tarefa com subtarefas, a fração delas concluída. */
function progressOf(task) {
  if (task.progress != null) return task.progress;
  const subs = subtasksOf(task);
  if (!subs.length) return null;
  const project = taskProject(task);
  return Math.round((subs.filter((s) => isDoneColumn(project, s.columnId)).length / subs.length) * 100);
}

/** Tags da tarefa: clicar filtra a lista por ela. */
const tagChips = (task) =>
  tagsOf(task).map((t) => el('button', { class: 'task-chip link tag', title: `Filtrar por #${t}`, onclick: stop(() => toggleTaskTag(t)) }, el('span', { text: `#${t}` })));

/** Chips de origem: tarefa-mãe, branch git e terminal do agente (clicar no terminal o abre). */
function originChips(task) {
  const origin = findTerm(task.terminalId);
  const parent = parentOf(task);
  return [
    parent ? el('button', { class: 'task-chip link', title: `Subtarefa de ${parent.key}: ${parent.title}`, onclick: stop(() => openTask(parent.id)) }, el('span', { text: `↳ ${parent.key}` })) : null,
    task.branch
      ? el('span', { class: 'task-chip', title: 'Repositório e branch' }, icon('branch'), el('span', { text: task.repo ? `${task.repo} · ${task.branch}` : task.branch }))
      : null,
    origin
      ? el('button', { class: 'task-chip link', title: 'Abrir terminal de origem', onclick: stop(() => activate(origin.t.id)) }, icon('terminal'), el('span', { text: termLabel(origin.t) }))
      : null,
  ];
}

export function taskCard(task, { compact = false } = {}) {
  const waiting = task.needsInput;
  const detail = waiting ? el('div', { class: 'task-question', text: waiting.question }) : lastReport(task) ? el('div', { class: 'task-last', text: lastReport(task) }) : null;
  const cls = ['task-card', compact && 'compact', waiting && 'waiting', isOpen(task.id) && 'selected'].filter(Boolean).join(' ');
  return el(
    'article',
    { class: cls, onclick: () => openTask(task.id), oncontextmenu: (e) => taskMenu(e, task), ...draggable('task', task.id) },
    el(
      'div',
      { class: 'task-card-top' },
      el('span', { class: 'task-key', text: task.key }),
      waiting ? el('span', { class: 'task-wait' }, icon('pause'), 'Em espera') : null,
      el('span', { class: 'spacer' }),
      el('span', { class: 'task-time', text: timeAgo(task.updatedAt) }),
    ),
    el('div', { class: 'task-title', text: task.title }),
    !compact && task.description ? el('div', { class: 'task-desc', text: task.description }) : null,
    detail,
    progressBar(progressOf(task)),
    el('div', { class: 'task-chips' }, tagChips(task), originChips(task)),
  );
}
