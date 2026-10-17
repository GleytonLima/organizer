// Cartão de tarefa, usado no painel (compacto) e no quadro (completo).
import { el, stop } from '../../core/dom.js';
import { findTerm } from '../../core/store.js';
import { termLabel, timeAgo } from '../../core/format.js';
import { activate } from '../../actions/terminals.js';
import { icon } from '../icons.js';
import { draggable } from '../dnd.js';
import { taskMenu } from './menus.js';
import { openTask, isOpen } from './selection.js';

const lastReport = (task) => [...task.history].reverse().find((h) => h.type === 'report')?.text;

function progressBar(value) {
  if (value == null) return null;
  return el('div', { class: 'task-progress', title: `${value}%` }, el('span', { style: { width: `${value}%` } }));
}

/** Chips de origem: branch git e terminal do agente (clicar no terminal o abre). */
function originChips(task) {
  const origin = findTerm(task.terminalId);
  return [
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
    progressBar(task.progress),
    el('div', { class: 'task-chips' }, originChips(task)),
  );
}
