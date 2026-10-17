// Painel lateral: projetos → grupos → terminais.
import { $, el, mount } from '../core/dom.js';
import { store, projectTerminals } from '../core/store.js';
import { newTerminal, moveTerminal } from '../actions/terminals.js';
import { createProject, openProject, toggleProject } from '../actions/projects.js';
import { iconButton, tintedIcon, unreadDot } from './components.js';
import { projectMenu } from './context-menus.js';
import { dropTarget } from './dnd.js';
import { groupSection } from './sidebar-groups.js';
import { icon } from './icons.js';

function projectHead(project) {
  return el(
    'div',
    {
      class: 'project-head',
      title: project.cwd,
      onclick: () => toggleProject(project),
      oncontextmenu: (e) => projectMenu(e, project),
      ...dropTarget('terminal', (id) => moveTerminal(id, project.groups[0])),
    },
    icon('chevron', 'chevron'),
    tintedIcon('folder', project.color, 'project-icon'),
    el('span', { class: 'project-name', text: project.name }),
    unreadDot(projectTerminals(project).map((t) => t.id)),
    iconButton('plus', 'Novo terminal', () => newTerminal(project.groups[0]), 'reveal'),
    iconButton('more', 'Opções do projeto', (e) => projectMenu(e, project), 'reveal'),
  );
}

function projectSection(project) {
  const headless = project.groups.length === 1;
  const body = project.open
    ? project.groups.map((g) => groupSection(project, g, { headless }))
    : el('button', { class: 'project-closed', onclick: () => openProject(project), text: 'Fechado · abrir' });
  const cls = ['project', project.collapsed && 'collapsed', !project.open && 'closed'].filter(Boolean).join(' ');
  return el('section', { class: cls }, projectHead(project), el('div', { class: 'project-body' }, body));
}

export function renderSidebar() {
  mount(
    $('#sidebar'),
    el('div', { class: 'sidebar-head' }, el('span', { class: 'eyebrow', text: 'Projetos' }), iconButton('plus', 'Novo projeto', createProject)),
    el('div', { class: 'project-list' }, store.state.projects.map(projectSection)),
  );
}
