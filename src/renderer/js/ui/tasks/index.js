// Ponto de entrada da UI de tarefas e memória: render do painel lateral, quadro e gaveta,
// e os botões "Tarefas" e "Memória" da barra superior.
import { el } from '../../core/dom.js';
import { store } from '../../core/store.js';
import { boardProject, waitingTasks } from '../../tasks/queries.js';
import { iconButton } from '../components.js';
import { renderSidePanel, toggleSideTab } from '../sidepanel.js';
import { renderBoard } from './board.js';
import { renderTaskDetail } from './detail.js';
import { selectedTask, closeTask } from './selection.js';

export function renderTasks() {
  renderSidePanel();
  renderBoard();
  renderTaskDetail();
}

const isOn = (tab) => store.state.taskView === 'panel' && store.state.sideTab === tab;

/** Botão "Tarefas" com contador de tarefas em espera do projeto atual. */
export function tasksButton() {
  const waiting = waitingTasks(boardProject()).length;
  const on = isOn('tasks') || store.state.taskView === 'board';
  const btn = iconButton('kanban', waiting ? `Tarefas — ${waiting} em espera` : 'Tarefas', () => toggleSideTab('tasks'), `tasks-btn${on ? ' on' : ''}`);
  if (waiting) btn.append(el('span', { class: 'bell-badge', text: waiting > 9 ? '9+' : waiting }));
  return btn;
}

export const memoryButton = () => iconButton('memory', 'Memória (decisões e notas)', () => toggleSideTab('memory'), `tasks-btn${isOn('memory') ? ' on' : ''}`);

export function initTasksUi() {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && selectedTask() && !document.body.classList.contains('modal-open')) closeTask();
  });
}
