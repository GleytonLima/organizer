import { $, el, mount } from '../core/dom.js';
import { store, activeEntry } from '../core/store.js';
import { shortPath } from '../core/format.js';
import { syncIndicator } from './sync-indicator.js';
import { awsIndicator } from './cloud/aws.js';
import { openSettings } from './settings/view.js';

export function renderStatusbar() {
  const entry = activeEntry();
  mount(
    $('#statusbar'),
    entry
      ? [
          el('span', { text: entry.project.name }),
          entry.project.groups.length > 1 ? [el('span', { class: 'sep', text: '/' }), el('span', { text: entry.group.name })] : null,
          el('span', { class: 'sep', text: '/' }),
          el('button', { class: 'link', title: 'Abrir no Explorer', onclick: () => api.openPath(entry.t.cwd), text: shortPath(entry.t.cwd) }),
        ]
      : el('span', { text: store.info.bash || 'Git Bash não encontrado' }),
    el('span', { class: 'spacer' }),
    el('span', { class: 'hint', text: 'Ctrl+Shift+T novo  ·  Ctrl+Tab alternar  ·  F2 editar' }),
    awsIndicator(),
    syncIndicator(() => openSettings('server')),
  );
}
