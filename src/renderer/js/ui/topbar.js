// Barra superior: título do terminal ativo (modo painel) ou abas (modo abas), tema e layout.
import { $, el, mount } from '../core/dom.js';
import { store, commit, activeEntry, currentProject, currentGroup, projectById, projectTerminals } from '../core/store.js';
import { termLabel } from '../core/format.js';
import { fitActive, processStatus } from '../terminals/sessions.js';
import { activate, newTerminal, closeTerminal, editTerminal } from '../actions/terminals.js';
import { createProject, openProject } from '../actions/projects.js';
import { gitFor, dirtyCount } from '../git/git.js';
import { iconButton, dot, gitSummary, processBadge } from './components.js';
import { terminalMenu, projectMenu, groupMenu, themeMenu } from './context-menus.js';

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
    dot(entry.t.color || entry.project.color),
    el('span', { class: 'title', text: termLabel(entry.t) }),
    processBadge(entry.t.id),
    gitSummary(entry.t.cwd, { detailed: true }),
  );
}

function projectSelect(project) {
  const onchange = (e) => {
    if (e.target.value === '__new') return createProject();
    const target = projectById(e.target.value);
    const first = projectTerminals(target)[0];
    if (target.open && first) activate(first.id);
    else openProject(target);
  };
  return el(
    'select',
    { class: 'ws-select', title: 'Projeto', onchange },
    store.state.projects.map((p) => el('option', { value: p.id, selected: p === project, text: p.name })),
    el('option', { value: '__new', text: 'Novo projeto…' }),
  );
}

function tab(project, t) {
  const g = gitFor(t.cwd);
  const status = processStatus(t.id);
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
    dot(t.color || project.color),
    el('span', { class: 'tab-name', text: termLabel(t) }),
    status !== 'idle' ? el('span', { class: `tab-status proc-${status}`, title: status }) : null,
    dirtyCount(g) ? el('span', { class: 'tab-dirty', title: 'alterações pendentes' }) : null,
    iconButton('close', 'Fechar', () => closeTerminal(t.id), 'reveal'),
  );
}

function groupTabs(project, group, labeled) {
  return [
    labeled ? el('button', { class: 'tab-group', onclick: (e) => groupMenu(e, group), oncontextmenu: (e) => groupMenu(e, group), text: group.name }) : null,
    group.terminals.map((t) => tab(project, t)),
  ];
}

function tabsArea() {
  const project = currentProject();
  const labeled = project.groups.length > 1;
  return el(
    'div',
    { class: 'tabs-area' },
    projectSelect(project),
    iconButton('more', 'Opções do projeto', (e) => projectMenu(e, project)),
    el('div', { class: 'tabs' }, project.open ? project.groups.map((g) => groupTabs(project, g, labeled)) : null),
    iconButton('plus', 'Novo terminal (Ctrl+Shift+T)', () => newTerminal(currentGroup(project))),
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
    tabs ? tabsArea() : [activeTitle(), el('div', { class: 'spacer' })], // a área de abas já ocupa o espaço livre
    iconButton('theme', 'Tema', themeMenu),
    layoutSwitch(),
  );
}
