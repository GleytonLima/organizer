// Pequenos componentes reutilizados em várias partes da interface.
import { el, stop } from '../core/dom.js';
import { gitFor, dirtyCount } from '../git/git.js';
import { icon } from './icons.js';

export function iconButton(name, title, onClick, cls = '') {
  return el('button', { class: `icon-btn ${cls}`.trim(), title, 'aria-label': title, onclick: stop(onClick) }, icon(name));
}

export const dot = (color, cls = '') => el('span', { class: `dot ${cls}`.trim(), style: { background: color } });

/** Resumo git compacto: branch, mudanças, commits a enviar/baixar. */
export function gitSummary(cwd, { detailed = false } = {}) {
  const g = gitFor(cwd);
  if (!g?.branch) return null;
  const dirty = dirtyCount(g);
  return el(
    'span',
    { class: 'git' },
    icon('branch', 'git-icon'),
    el('span', { class: 'git-branch', text: g.branch }),
    g.conflicts ? el('span', { class: 'git-conflict', text: `${g.conflicts} conflito(s)` }) : null,
    dirty
      ? el('span', {
          class: 'git-dirty',
          title: `${g.staged} staged · ${g.changes} modificados · ${g.untracked} novos`,
          text: detailed ? `${dirty} alteraç${dirty > 1 ? 'ões' : 'ão'}` : `•${dirty}`,
        })
      : null,
    g.ahead ? el('span', { class: 'git-sync', title: 'commits para enviar', text: `↑${g.ahead}` }) : null,
    g.behind ? el('span', { class: 'git-sync', title: 'commits para baixar', text: `↓${g.behind}` }) : null,
  );
}
