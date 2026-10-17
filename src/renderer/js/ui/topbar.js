// Barra superior: título do terminal ativo (modo painel) ou abas (modo abas), tema e layout.
import { $, el, mount } from '../core/dom.js';
import { store, commit, activeEntry, currentWs, wsById } from '../core/store.js';
import { termLabel } from '../core/format.js';
import { fitActive } from '../terminals/sessions.js';
import { activate, newTerminal, closeTerminal, editTerminal } from '../actions/terminals.js';
import { createWorkspace, openWorkspace } from '../actions/workspaces.js';
import { gitFor, dirtyCount } from '../git/git.js';
import { iconButton, dot, gitSummary } from './components.js';
import { terminalMenu, workspaceMenu, themeMenu } from './context-menus.js';

const LAYOUTS = [
  { id: 'left', icon: 'layoutLeft', title: 'Painel à esquerda' },
  { id: 'right', icon: 'layoutRight', title: 'Painel à direita' },
  { id: 'tabs', icon: 'layoutTabs', title: 'Abas' },
];

function setLayout(layout) {
  store.state.layout = layout;
  commit();
  requestAnimationFrame(fitActive);
}

function activeTitle() {
  const entry = activeEntry();
  if (!entry) return null;
  return el(
    'div',
    { class: 'active-title' },
    dot(entry.t.color || entry.ws.color),
    el('span', { class: 'title', text: termLabel(entry.t) }),
    gitSummary(entry.t.cwd, { detailed: true }),
  );
}

function workspaceSelect(ws) {
  const onchange = (e) => {
    if (e.target.value === '__new') return createWorkspace();
    const target = wsById(e.target.value);
    if (target.open && target.terminals.length) activate(target.terminals[0].id);
    else openWorkspace(target);
  };
  return el(
    'select',
    { class: 'ws-select', title: 'Workspace', onchange },
    store.state.workspaces.map((w) => el('option', { value: w.id, selected: w === ws, text: w.name })),
    el('option', { value: '__new', text: 'Novo workspace…' }),
  );
}

function tab(ws, t) {
  const g = gitFor(t.cwd);
  return el(
    'div',
    {
      class: `tab${t.id === store.state.activeId ? ' active' : ''}`,
      title: t.cwd + (g?.branch ? `\n${g.branch}` : ''),
      onclick: () => activate(t.id),
      ondblclick: () => editTerminal(t.id),
      oncontextmenu: (e) => terminalMenu(e, t.id),
      onauxclick: (e) => e.button === 1 && closeTerminal(t.id),
    },
    dot(t.color || ws.color),
    el('span', { class: 'tab-name', text: termLabel(t) }),
    dirtyCount(g) ? el('span', { class: 'tab-dirty', title: 'alterações pendentes' }) : null,
    iconButton('close', 'Fechar', () => closeTerminal(t.id), 'reveal'),
  );
}

function tabsArea() {
  const ws = currentWs();
  return el(
    'div',
    { class: 'tabs-area' },
    workspaceSelect(ws),
    iconButton('more', 'Opções do workspace', (e) => workspaceMenu(e, ws)),
    el('div', { class: 'tabs' }, ws?.open ? ws.terminals.map((t) => tab(ws, t)) : null),
    iconButton('plus', 'Novo terminal (Ctrl+Shift+T)', () => newTerminal(ws)),
  );
}

function layoutSwitch() {
  return el(
    'div',
    { class: 'segmented', role: 'group', 'aria-label': 'Layout' },
    LAYOUTS.map((l) => iconButton(l.icon, l.title, () => setLayout(l.id), store.state.layout === l.id ? 'on' : '')),
  );
}

export function renderTopbar() {
  const tabs = store.state.layout === 'tabs';
  mount(
    $('#topbar'),
    tabs ? tabsArea() : activeTitle(),
    el('div', { class: 'spacer' }),
    iconButton('theme', 'Tema', themeMenu),
    layoutSwitch(),
  );
}
