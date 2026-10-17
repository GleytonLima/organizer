import { $, el, mount } from '../core/dom.js';
import { store } from '../core/store.js';
import { runInActive } from '../terminals/sessions.js';
import { editCommand, removeCommand } from '../actions/commands.js';
import { commandMenu } from './context-menus.js';
import { iconButton } from './components.js';
import { icon } from './icons.js';

const chip = (c) =>
  el(
    'div',
    {
      class: 'chip',
      role: 'button',
      tabindex: '0',
      title: `${c.cmd}\nDuplo clique para editar`,
      onclick: () => runInActive(c.cmd),
      ondblclick: () => editCommand(c),
      onkeydown: (e) => e.key === 'Enter' && runInActive(c.cmd),
      oncontextmenu: (e) => commandMenu(e, c),
    },
    el('span', { class: 'chip-label', text: c.label }),
    iconButton('close', 'Remover comando', () => removeCommand(c), 'reveal chip-remove'),
  );

export function renderCmdbar() {
  mount(
    $('#cmdbar'),
    store.state.commands.map(chip),
    el('button', { class: 'chip chip-add', title: 'Novo comando', onclick: () => editCommand() }, icon('plus')),
  );
}
