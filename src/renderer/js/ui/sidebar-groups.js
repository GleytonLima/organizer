// Grupos e itens de terminal dentro de um projeto, na sidebar.
import { el } from '../core/dom.js';
import { store } from '../core/store.js';
import { termLabel } from '../core/format.js';
import { activate, newTerminal, closeTerminal, editTerminal, moveTerminal } from '../actions/terminals.js';
import { toggleGroup } from '../actions/groups.js';
import { iconButton, tintedIcon, terminalMeta } from './components.js';
import { terminalMenu, groupMenu } from './context-menus.js';
import { draggable, dropTarget } from './dnd.js';
import { icon } from './icons.js';

function terminalItem(project, group, t) {
  const active = t.id === store.state.activeId;
  return el(
    'div',
    {
      class: `term-item${active ? ' active' : ''}`,
      title: t.cwd,
      onclick: () => activate(t.id),
      ondblclick: () => editTerminal(t.id),
      oncontextmenu: (e) => terminalMenu(e, t.id),
      ...draggable(t.id),
      ...dropTarget((id) => moveTerminal(id, group, t.id)),
    },
    tintedIcon('terminal', t.color || project.color, 'term-icon'),
    el('div', { class: 'term-text' }, el('div', { class: 'term-name', text: termLabel(t) }), el('div', { class: 'term-meta' }, terminalMeta(t))),
    iconButton('close', 'Fechar terminal', () => closeTerminal(t.id), 'reveal'),
  );
}

function groupHead(group) {
  return el(
    'div',
    {
      class: 'group-head',
      onclick: () => toggleGroup(group),
      oncontextmenu: (e) => groupMenu(e, group),
      ...dropTarget((id) => moveTerminal(id, group)),
    },
    icon('chevron', 'chevron'),
    el('span', { class: 'group-name', text: group.name }),
    iconButton('plus', 'Novo terminal no grupo', () => newTerminal(group), 'reveal'),
    iconButton('more', 'Opções do grupo', (e) => groupMenu(e, group), 'reveal'),
  );
}

/** Um grupo; com um único grupo no projeto, mostra só os terminais (sem cabeçalho). */
export function groupSection(project, group, { headless }) {
  const items = group.terminals.map((t) => terminalItem(project, group, t));
  if (headless) return el('div', { class: 'group headless' }, items);
  return el(
    'div',
    { class: `group${group.collapsed ? ' collapsed' : ''}` },
    groupHead(group),
    el('div', { class: 'group-body' }, items.length ? items : el('div', { class: 'group-empty', text: 'Solte terminais aqui' })),
  );
}
