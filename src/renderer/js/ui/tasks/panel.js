// Aba "Tarefas" do painel lateral (lista agrupada): "Em espera" no topo e uma seção por coluna.
import { el } from '../../core/dom.js';
import { notify } from '../../core/store.js';
import { tasksByColumn, waitingTasks, taskById } from '../../tasks/queries.js';
import { moveTask, setTaskView } from '../../actions/tasks.js';
import { iconButton } from '../components.js';
import { icon } from '../icons.js';
import { dropTarget } from '../dnd.js';
import { taskCard } from './card.js';
import { newTaskDialog, columnsDialog } from './dialogs.js';
import { periodButton } from './period-button.js';

const collapsed = new Set(); // seções recolhidas (estado só da interface)

function toggle(id) {
  if (collapsed.has(id)) collapsed.delete(id);
  else collapsed.add(id);
  notify();
}

function section({ id, title, tasks, columnId, tone }) {
  const isCollapsed = collapsed.has(id);
  return el(
    'section',
    {
      class: `tp-section${isCollapsed ? ' collapsed' : ''}${tone ? ` tone-${tone}` : ''}`,
      ...(columnId && dropTarget('task', (taskId) => moveTask(taskById(taskId), columnId))),
    },
    el(
      'button',
      { class: 'tp-head', onclick: () => toggle(id) },
      icon('chevron', 'chevron'),
      el('span', { class: 'tp-title', text: title }),
      el('span', { class: 'tp-count', text: tasks.length }),
    ),
    isCollapsed ? null : el('div', { class: 'tp-list' }, tasks.map((t) => taskCard(t, { compact: true }))),
  );
}

/** Conteúdo da aba: { actions, body } (ver ui/sidepanel.js). */
export function taskTab(project) {
  const waiting = waitingTasks(project);
  return {
    actions: [
      periodButton(),
      iconButton('plus', 'Nova tarefa', () => newTaskDialog(project)),
      iconButton('settings', 'Configurar colunas', () => columnsDialog(project)),
      iconButton('maximize', 'Abrir quadro', () => setTaskView('board')),
    ],
    body: [
      waiting.length ? section({ id: '__waiting', title: 'Em espera', tasks: waiting, tone: 'waiting' }) : null,
      tasksByColumn(project).map(({ column, tasks }) => section({ id: column.id, title: column.name, tasks, columnId: column.id })),
    ],
  };
}
