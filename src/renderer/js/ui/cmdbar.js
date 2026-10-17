import { $, el, mount } from '../core/dom.js';
import { store } from '../core/store.js';
import { runInActive } from '../terminals/sessions.js';
import { editCommand } from '../actions/commands.js';
import { commandMenu } from './context-menus.js';
import { icon } from './icons.js';

export function renderCmdbar() {
  mount(
    $('#cmdbar'),
    store.state.commands.map((c) =>
      el('button', {
        class: 'chip',
        title: `${c.cmd}\nBotão direito para editar`,
        onclick: () => runInActive(c.cmd),
        oncontextmenu: (e) => commandMenu(e, c),
        text: c.label,
      }),
    ),
    el('button', { class: 'chip chip-add', title: 'Novo comando', onclick: () => editCommand() }, icon('plus')),
  );
}
