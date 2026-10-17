// Subtarefas na gaveta da tarefa: a lista (com a coluna de cada uma) e "Nova subtarefa"; numa
// subtarefa, a linha "Subtarefa de …" leva à tarefa-mãe. Subtarefa é uma tarefa completa (parentId).
import { el } from '../../core/dom.js';
import { columnById, isDoneColumn } from '../../tasks/columns.js';
import { taskProject, subtasksOf, parentOf, projectTasks } from '../../tasks/queries.js';
import { createTask, setTaskParent } from '../../actions/tasks.js';
import { openModal, field } from '../modal.js';
import { icon } from '../icons.js';
import { openTask } from './selection.js';

async function newSubtask(task) {
  const v = await openModal({
    title: `Nova subtarefa de ${task.key}`,
    fields: [field.text('title', 'Título', '', { placeholder: 'Parte do trabalho' }), field.textarea('description', 'Descrição', '', { rows: 3 })],
    submit: 'Criar',
  });
  if (!v?.title?.trim()) return;
  createTask(taskProject(task), { title: v.title, description: v.description, parent: task });
}

function subtaskRow(project, t) {
  const done = isDoneColumn(project, t.columnId);
  return el(
    'button',
    { type: 'button', class: `td-sub${done ? ' done' : ''}`, onclick: () => openTask(t.id) },
    done ? icon('check', 'td-sub-icon') : el('span', { class: 'td-sub-dot' }),
    el('span', { class: 'task-key', text: t.key }),
    el('span', { class: 'td-sub-title', text: t.title }),
    t.needsInput ? el('span', { class: 'task-wait' }, icon('pause'), 'Em espera') : el('span', { class: 'td-sub-col', text: columnById(project, t.columnId)?.name || '' }),
  );
}

export function subtasksBox(task) {
  const project = taskProject(task);
  const subs = subtasksOf(task);
  return el(
    'div',
    { class: 'td-subtasks' },
    subs.map((t) => subtaskRow(project, t)),
    el('div', { class: 'td-mem-actions' }, el('button', { type: 'button', class: 'btn small', onclick: () => newSubtask(task) }, icon('plus'), 'Nova subtarefa')),
  );
}

export function parentLine(task) {
  const parent = parentOf(task);
  if (!parent) return null;
  return el('button', { type: 'button', class: 'td-parent', onclick: () => openTask(parent.id) }, `↳ Subtarefa de ${parent.key} · ${parent.title}`);
}

/** Escolher a tarefa-mãe (ou nenhuma) entre as tarefas do projeto. */
export async function parentDialog(task) {
  const candidates = projectTasks(taskProject(task)).filter((t) => t !== task);
  const v = await openModal({
    title: `Tornar ${task.key} subtarefa de…`,
    fields: [
      field.select('parent', 'Tarefa-mãe', task.parentId || '', {
        options: [{ value: '', label: '(nenhuma — tarefa solta)' }, ...candidates.map((t) => ({ value: t.id, label: `${t.key} · ${t.title}` }))],
      }),
    ],
    submit: 'Salvar',
  });
  if (!v) return;
  try {
    setTaskParent(task, candidates.find((t) => t.id === v.parent) || null);
  } catch (err) {
    await openModal({ title: 'Não foi possível', message: err.message });
  }
}
