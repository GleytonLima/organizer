// Ponto de entrada da UI de tarefas: render do painel, quadro e gaveta + botão da barra superior.
import { el } from '../../core/dom.js';
import { store } from '../../core/store.js';
import { boardProject, waitingTasks } from '../../tasks/queries.js';
import { setTaskView } from '../../actions/tasks.js';
import { iconButton } from '../components.js';
import { renderTaskPanel } from './panel.js';
import { renderBoard } from './board.js';
import { renderTaskDetail } from './detail.js';
import { selectedTask, closeTask } from './selection.js';

export function renderTasks() {
  renderTaskPanel();
  renderBoard();
  renderTaskDetail();
}

/** Botão "Tarefas" (abre/fecha o painel) com contador de tarefas em espera do projeto atual. */
export function tasksButton() {
  const view = store.state.taskView;
  const waiting = waitingTasks(boardProject()).length;
  const btn = iconButton('kanban', waiting ? `Tarefas — ${waiting} em espera` : 'Tarefas', () => setTaskView(view === 'off' ? 'panel' : 'off'), `tasks-btn${view !== 'off' ? ' on' : ''}`);
  if (waiting) btn.append(el('span', { class: 'bell-badge', text: waiting > 9 ? '9+' : waiting }));
  return btn;
}

export function initTasksUi() {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && selectedTask() && !document.body.classList.contains('modal-open')) closeTask();
  });
}
