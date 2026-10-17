// Painel lateral: workspaces e seus terminais, com arrastar-e-soltar.
import { $, el, mount } from '../core/dom.js';
import { store } from '../core/store.js';
import { termLabel, shortPath } from '../core/format.js';
import { getSession } from '../terminals/sessions.js';
import { activate, newTerminal, closeTerminal, editTerminal, moveTerminal } from '../actions/terminals.js';
import { createWorkspace, openWorkspace, toggleCollapsed } from '../actions/workspaces.js';
import { iconButton, dot, gitSummary } from './components.js';
import { terminalMenu, workspaceMenu } from './context-menus.js';
import { icon } from './icons.js';

let dragId = null;

const dropTarget = (onDrop) => ({
  ondragover: (e) => dragId && e.preventDefault(),
  ondrop: (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragId) onDrop(dragId);
  },
});

function terminalItem(ws, t) {
  const active = t.id === store.state.activeId;
  const exited = getSession(t.id)?.exited;
  return el(
    'div',
    {
      class: `term-item${active ? ' active' : ''}${exited ? ' exited' : ''}`,
      title: t.cwd,
      draggable: 'true',
      onclick: () => activate(t.id),
      ondblclick: () => editTerminal(t.id),
      oncontextmenu: (e) => terminalMenu(e, t.id),
      ondragstart: () => (dragId = t.id),
      ondragend: () => (dragId = null),
      ...dropTarget((id) => moveTerminal(id, ws, t.id)),
    },
    dot(t.color || ws.color),
    el(
      'div',
      { class: 'term-text' },
      el('div', { class: 'term-name', text: termLabel(t) }),
      el('div', { class: 'term-meta' }, gitSummary(t.cwd) || el('span', { class: 'term-path', text: shortPath(t.cwd) })),
    ),
    iconButton('close', 'Fechar terminal', () => closeTerminal(t.id), 'reveal'),
  );
}

function workspaceGroup(ws) {
  const head = el(
    'div',
    {
      class: 'ws-head',
      title: ws.cwd,
      onclick: () => toggleCollapsed(ws),
      oncontextmenu: (e) => workspaceMenu(e, ws),
      ...dropTarget((id) => moveTerminal(id, ws, null)),
    },
    icon('chevron', 'ws-chevron'),
    el('span', { class: 'ws-name', text: ws.name }),
    el('span', { class: 'ws-count', text: ws.terminals.length || '' }),
    iconButton('plus', 'Novo terminal', () => newTerminal(ws), 'reveal'),
    iconButton('more', 'Opções', (e) => workspaceMenu(e, ws), 'reveal'),
  );

  const body = ws.open
    ? ws.terminals.map((t) => terminalItem(ws, t))
    : el('button', { class: 'ws-closed', onclick: () => openWorkspace(ws), text: 'Fechado · abrir' });

  const cls = ['ws', ws.collapsed && 'collapsed', !ws.open && 'closed'].filter(Boolean).join(' ');
  return el('section', { class: cls }, head, el('div', { class: 'ws-body' }, body));
}

export function renderSidebar() {
  mount(
    $('#sidebar'),
    el('div', { class: 'sidebar-head' }, el('span', { class: 'eyebrow', text: 'Workspaces' }), iconButton('plus', 'Novo workspace', createWorkspace)),
    el('div', { class: 'ws-list' }, store.state.workspaces.map(workspaceGroup)),
  );
}
