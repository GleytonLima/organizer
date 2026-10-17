// Ações sobre tarefas (usadas pela interface e pela API). `by`: 'agente' | 'você'.
// O estado de espera (pergunta do agente → sua resposta) fica em ./task-waiting.js.
import { store, commit } from '../core/store.js';
import { makeTask } from '../core/model.js';
import { columnById, firstColumn, lastColumn, isDoneColumn } from '../tasks/columns.js';
import { taskProject } from '../tasks/queries.js';
import { logTask, stampOrigin, notifyAbout } from '../tasks/history.js';
import { confirmDanger } from '../ui/confirm.js';

/** Prefixo da chave a partir do nome do projeto: "minha-app" → "MA", "backend" → "BAC". */
function keyPrefix(name) {
  const words = String(name).normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-zA-Z0-9]+/g) || ['T'];
  const raw = words.length > 1 ? words.map((w) => w[0]).join('') : words[0].slice(0, 3);
  return raw.toUpperCase().slice(0, 4);
}

/** Cria uma tarefa; com `parent`, ela é subtarefa daquela (tarefa completa, com chave própria). */
export function createTask(project, { title, description = '', columnId, terminalId = null, by = 'você', parent = null }) {
  if (!String(title || '').trim()) throw new Error('A tarefa precisa de um título.');
  project.taskSeq = (project.taskSeq || 0) + 1;
  const task = makeTask({
    key: `${keyPrefix(project.name)}-${project.taskSeq}`,
    projectId: project.id,
    columnId: columnId || firstColumn(project).id,
    title: title.trim(),
    description,
    parentId: parent?.id || null,
  });
  stampOrigin(task, terminalId);
  logTask(task, by, 'created', `Criada em “${columnById(project, task.columnId).name}”${parent ? ` como subtarefa de ${parent.key}` : ''}`);
  if (parent) logTask(parent, by, 'edit', `Nova subtarefa ${task.key}: ${task.title}`);
  store.state.tasks.push(task);
  commit();
  return task;
}

/** Move a tarefa. Se o agente move, a espera (se houver) termina. Chegar na última coluna avisa você. */
export function moveTask(task, columnId, { by = 'você', note = '', terminalId } = {}) {
  const project = taskProject(task);
  const col = columnById(project, columnId);
  if (!col) throw new Error('Coluna inexistente.');
  stampOrigin(task, terminalId);
  const changed = task.columnId !== col.id;
  task.columnId = col.id;
  if (by === 'agente') task.needsInput = null;
  logTask(task, by, 'moved', `${changed ? `Movida para “${col.name}”` : `Continua em “${col.name}”`}${note ? ` — ${note}` : ''}`);
  commit();
  if (changed && by === 'agente' && isDoneColumn(project, col.id)) notifyAbout(task, `Concluída: ${task.title}`);
  return task;
}

export function reportTask(task, text, { by = 'agente', progress, terminalId } = {}) {
  if (!String(text || '').trim()) throw new Error('O relato precisa de um texto.');
  stampOrigin(task, terminalId);
  if (progress != null) task.progress = Math.max(0, Math.min(100, Math.round(progress)));
  logTask(task, by, 'report', text.trim());
  commit();
  return task;
}

export const completeTask = (task, opts = {}) => moveTask(task, lastColumn(taskProject(task)).id, { by: 'agente', ...opts });

export function updateTask(task, { title, description, columnId }) {
  const changes = [];
  if (title?.trim() && title.trim() !== task.title) {
    task.title = title.trim();
    changes.push('título');
  }
  if (description != null && description !== task.description) {
    task.description = description;
    changes.push('descrição');
  }
  if (changes.length) logTask(task, 'você', 'edit', `Editou ${changes.join(' e ')}`);
  if (columnId && columnId !== task.columnId) return moveTask(task, columnId, { by: 'você' });
  commit();
  return task;
}

/** Torna `task` subtarefa de `parent` (ou tarefa solta, com null). Recusa ciclos. */
export function setTaskParent(task, parent, { by = 'você' } = {}) {
  for (let p = parent; p; p = store.state.tasks.find((t) => t.id === p.parentId)) {
    if (p === task) throw new Error(`${parent.key} já é subtarefa de ${task.key}.`);
  }
  const before = store.state.tasks.find((t) => t.id === task.parentId);
  if (before === parent) return task;
  task.parentId = parent?.id || null;
  logTask(task, by, 'edit', parent ? `Virou subtarefa de ${parent.key}` : `Deixou de ser subtarefa de ${before?.key}`);
  if (parent) logTask(parent, by, 'edit', `Nova subtarefa ${task.key}: ${task.title}`);
  commit();
  return task;
}

export async function deleteTask(task) {
  const ok = await confirmDanger({ title: `Excluir ${task.key}?`, message: task.title });
  if (!ok) return false;
  store.state.tasks = store.state.tasks.filter((t) => t !== task);
  // subtarefas continuam existindo, sem a mãe
  for (const t of store.state.tasks) if (t.parentId === task.id) t.parentId = null;
  commit();
  return true;
}

/** Substitui as colunas do projeto; tarefas de colunas removidas vão para a primeira. */
export function saveColumns(project, columns) {
  if (!columns.length) throw new Error('O quadro precisa de pelo menos uma coluna.');
  project.taskColumns = columns;
  const ids = new Set(columns.map((c) => c.id));
  for (const t of store.state.tasks) if (t.projectId === project.id && !ids.has(t.columnId)) t.columnId = columns[0].id;
  commit();
}

export const setTaskView = (view) => {
  store.state.taskView = view;
  commit();
};
