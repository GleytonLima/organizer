// Aba "Tarefas" do painel lateral (lista agrupada): busca e filtros no topo, "Em espera" e uma seção
// por coluna. No escopo "Todos os projetos", um bloco por projeto (só as seções com tarefas).
// Seções grandes mostram as 20 primeiras e "Mostrar mais".
import { el } from '../../core/dom.js';
import { notify, projects } from '../../core/store.js';
import { tasksByColumn, waitingTasks, taskById } from '../../tasks/queries.js';
import { filterActive, taskScope } from '../../tasks/filter.js';
import { moveTask, setTaskView } from '../../actions/tasks.js';
import { iconButton } from '../components.js';
import { icon } from '../icons.js';
import { dropTarget } from '../dnd.js';
import { taskCard } from './card.js';
import { newTaskDialog, columnsDialog } from './dialogs.js';
import { periodButton } from './period-button.js';
import { scopeTitle, filterBar } from './panel-filter.js';

const LIMIT = 20;
const collapsed = new Set(); // seções recolhidas (estado só da interface)
const expanded = new Set(); // seções com "Mostrar mais" aberto

function toggle(id) {
  if (collapsed.has(id)) collapsed.delete(id);
  else collapsed.add(id);
  notify();
}

function section({ id, title, tasks, project, columnId, tone }) {
  const isCollapsed = collapsed.has(id);
  const shown = expanded.has(id) ? tasks : tasks.slice(0, LIMIT);
  const rest = tasks.length - shown.length;
  return el(
    'section',
    {
      class: `tp-section${isCollapsed ? ' collapsed' : ''}${tone ? ` tone-${tone}` : ''}`,
      'data-section': id,
      // só aceita tarefas do mesmo projeto (no escopo "todos" há colunas de vários)
      ...(columnId && dropTarget('task', (taskId) => taskById(taskId)?.projectId === project.id && moveTask(taskById(taskId), columnId))),
    },
    el(
      'button',
      { class: 'tp-head', onclick: () => toggle(id) },
      icon('chevron', 'chevron'),
      el('span', { class: 'tp-title', text: title }),
      el('span', { class: 'tp-count', text: tasks.length }),
    ),
    isCollapsed
      ? null
      : el(
          'div',
          { class: 'tp-list' },
          shown.map((t) => taskCard(t, { compact: true })),
          rest ? el('button', { class: 'tp-more', onclick: () => (expanded.add(id), notify()), text: `Mostrar mais ${rest}` }) : null,
        ),
  );
}

/** Seções de um projeto; `prefix` separa os ids no escopo "todos"; `skipEmpty` esconde colunas vazias. */
function projectSections(project, { prefix = '', skipEmpty = false } = {}) {
  const waiting = waitingTasks(project, { filter: true });
  const columns = tasksByColumn(project, { filter: true }).filter((c) => !skipEmpty || c.tasks.length);
  return [
    waiting.length ? section({ id: `${prefix}__waiting`, title: 'Em espera', tasks: waiting, tone: 'waiting' }) : null,
    columns.map(({ column, tasks }) => section({ id: `${prefix}${column.id}`, title: column.name, tasks, project, columnId: column.id })),
  ];
}

function allProjects() {
  const blocks = projects()
    .map((p) => {
      const sections = projectSections(p, { prefix: `${p.id}:`, skipEmpty: true });
      if (!sections[0] && !sections[1].length) return null;
      return el('div', { class: 'tp-group', 'data-project': p.id }, el('div', { class: 'tp-group-name', text: p.name }), sections);
    })
    .filter(Boolean);
  return blocks.length ? blocks : el('div', { class: 'mem-empty', text: filterActive() ? 'Nada encontrado.' : 'Nenhuma tarefa no período.' });
}

/** Conteúdo da aba: { title, actions, body } (ver ui/sidepanel.js). */
export function taskTab(project) {
  return {
    title: scopeTitle(project),
    actions: [
      periodButton(),
      iconButton('plus', 'Nova tarefa', () => newTaskDialog(project)),
      iconButton('settings', 'Configurar colunas', () => columnsDialog(project)),
      iconButton('maximize', 'Abrir quadro', () => setTaskView('board')),
    ],
    body: [filterBar(), taskScope() === 'all' ? allProjects() : projectSections(project)],
  };
}
