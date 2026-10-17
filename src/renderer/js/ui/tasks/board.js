// Quadro kanban em tela cheia: uma coluna por etapa, cartões arrastáveis.
// Os terminais continuam rodando por baixo; só a área principal troca.
import { $, el, mount } from '../../core/dom.js';
import { store } from '../../core/store.js';
import { boardProject, tasksByColumn, waitingTasks, taskById } from '../../tasks/queries.js';
import { moveTask, setTaskView } from '../../actions/tasks.js';
import { iconButton } from '../components.js';
import { dropTarget } from '../dnd.js';
import { taskCard } from './card.js';
import { newTaskDialog, columnsDialog } from './dialogs.js';
import { periodButton } from './period-button.js';

function column(project, { column: col, tasks }) {
  return el(
    'section',
    { class: 'kb-column', ...dropTarget('task', (id) => moveTask(taskById(id), col.id)) },
    el(
      'header',
      { class: 'kb-col-head', title: col.description || '' },
      el('span', { class: 'kb-col-name', text: col.name }),
      el('span', { class: 'kb-col-count', text: tasks.length }),
      el('span', { class: 'spacer' }),
      iconButton('plus', `Nova tarefa em “${col.name}”`, () => newTaskDialog(project, col.id)),
    ),
    col.description ? el('div', { class: 'kb-col-desc', text: col.description }) : null,
    el('div', { class: 'kb-col-body' }, tasks.map((t) => taskCard(t))),
  );
}

export function renderBoard() {
  const show = store.state.taskView === 'board';
  $('#main').classList.toggle('board-mode', show);
  const board = $('#board');
  board.classList.toggle('hidden', !show);
  if (!show) return;
  const project = boardProject();
  const waiting = waitingTasks(project).length;
  mount(
    board,
    el(
      'header',
      { class: 'kb-header' },
      el('h2', { class: 'kb-title', text: project.name }),
      waiting ? el('span', { class: 'kb-waiting', text: `${waiting} em espera` }) : null,
      el('span', { class: 'spacer' }),
      periodButton(),
      el('button', { class: 'btn primary', onclick: () => newTaskDialog(project), text: 'Nova tarefa' }),
      iconButton('settings', 'Configurar colunas', () => columnsDialog(project)),
      iconButton('collapse', 'Recolher para o painel', () => setTaskView('panel')),
      iconButton('close', 'Voltar aos terminais', () => setTaskView('off')),
    ),
    el('div', { class: 'kb-columns' }, tasksByColumn(project).map((c) => column(project, c))),
  );
}
