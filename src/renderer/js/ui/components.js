// Pequenos componentes reutilizados em várias partes da interface.
import { el, stop } from '../core/dom.js';
import { shortPath } from '../core/format.js';
import { gitFor, dirtyCount } from '../git/git.js';
import { getSession, processStatus } from '../terminals/sessions.js';
import { hasUnread } from '../notify/center.js';
import { currentTaskOf } from '../tasks/queries.js';
import { icon } from './icons.js';

export function iconButton(name, title, onClick, cls = '') {
  return el('button', { class: `icon-btn ${cls}`.trim(), title, 'aria-label': title, onclick: stop(onClick) }, icon(name));
}

export const dot = (color, cls = '') => el('span', { class: `dot ${cls}`.trim(), style: { background: color } });

/** Bolinha de aviso não lido para um conjunto de terminais (ou null). */
export const unreadDot = (terminalIds) =>
  hasUnread(terminalIds) ? el('span', { class: 'unread-dot', title: 'Aviso não lido' }) : null;

/** Ícone colorido (pasta do projeto, terminal). */
export function tintedIcon(name, color, cls = '') {
  const node = icon(name, cls);
  node.style.color = color;
  return node;
}

/** Detalhe git de um status já obtido: branch, mudanças, commits a enviar/baixar. */
export function gitDetail(g, { repo = null } = {}) {
  if (!g?.branch) return null;
  const dirty = dirtyCount(g);
  return el(
    'span',
    { class: 'git', title: g.root || '' },
    repo ? el('span', { class: 'git-repo', text: repo }) : null,
    icon('branch', 'git-icon'),
    el('span', { class: 'git-branch', text: g.branch }),
    g.conflicts ? el('span', { class: 'git-conflict', text: `${g.conflicts} conflito(s)` }) : null,
    dirty ? el('span', { class: 'git-dirty', title: `${g.staged} staged · ${g.changes} modificados · ${g.untracked} novos`, text: `•${dirty}` }) : null,
    g.ahead ? el('span', { class: 'git-sync', title: 'commits para enviar', text: `↑${g.ahead}` }) : null,
    g.behind ? el('span', { class: 'git-sync', title: 'commits para baixar', text: `↓${g.behind}` }) : null,
  );
}

/** Resumo git de uma pasta, com o nome do repositório (projetos podem ter vários repos). */
export const gitSummary = (cwd) => {
  const g = gitFor(cwd);
  return gitDetail(g, { repo: g?.repo });
};

/** Estado do processo do terminal: em execução, erro ou encerrado. Null quando ocioso. */
export function processBadge(id) {
  const status = processStatus(id);
  const s = getSession(id);
  const text = {
    running: s?.running?.cmd,
    error: `saiu com ${s?.lastExit}`,
    exited: 'shell encerrado',
  }[status];
  if (!text) return null;
  return el('span', { class: `proc proc-${status}`, title: text }, el('span', { class: 'proc-dot' }), el('span', { class: 'proc-text', text }));
}

/** Tarefa aberta que o agente deste terminal está tocando (ou null). */
function taskBadge(id) {
  const task = currentTaskOf(id);
  if (!task) return null;
  return el(
    'span',
    { class: `term-task${task.needsInput ? ' waiting' : ''}`, title: task.needsInput ? `Em espera: ${task.needsInput.question}` : task.title },
    icon(task.needsInput ? 'pause' : 'kanban'),
    el('span', { class: 'term-task-key', text: task.key }),
    el('span', { class: 'term-task-title', text: task.title }),
  );
}

/** Linha secundária de um terminal: tarefa > processo em execução > git > pasta. */
export const terminalMeta = (t) =>
  taskBadge(t.id) || processBadge(t.id) || gitSummary(t.cwd) || el('span', { class: 'term-path', text: shortPath(t.cwd) });
