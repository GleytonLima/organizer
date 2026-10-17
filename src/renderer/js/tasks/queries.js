// Consultas sobre tarefas.
import { store, projectById, currentProject } from '../core/store.js';
import { columnsOf, isDoneColumn } from './columns.js';
import { inPeriod } from './period.js';
import { matchesFilter } from './filter.js';

export const allTasks = () => store.state.tasks;
export const taskById = (id) => allTasks().find((t) => t.id === id) || null;
export const projectTasks = (project) => allTasks().filter((t) => t.projectId === project?.id);
export const taskProject = (task) => projectById(task.projectId);
export const subtasksOf = (task) => allTasks().filter((t) => t.parentId === task.id);
export const parentOf = (task) => (task.parentId ? taskById(task.parentId) : null);

/** Projeto exibido no quadro/painel: o do terminal ativo. */
export const boardProject = () => currentProject();

/**
 * [{ column, tasks }] na ordem das colunas; mais recentes primeiro; só as do período (tasks/period.js).
 * `filter`: aplica também o filtro do painel (tasks/filter.js).
 */
export function tasksByColumn(project, { filter = false } = {}) {
  const cols = columnsOf(project);
  const buckets = new Map(cols.map((c) => [c.id, []]));
  for (const t of projectTasks(project)) if (inPeriod(project, t) && (!filter || matchesFilter(t))) (buckets.get(t.columnId) || buckets.get(cols[0].id)).push(t);
  return cols.map((column) => ({ column, tasks: buckets.get(column.id).sort((a, b) => b.updatedAt - a.updatedAt) }));
}

export const waitingTasks = (project, { filter = false } = {}) => projectTasks(project).filter((t) => t.needsInput && (!filter || matchesFilter(t)));

/** Tarefa aberta mais recente associada a um terminal (para a sidebar e para "a tarefa atual"). */
export function currentTaskOf(terminalId) {
  return (
    allTasks()
      .filter((t) => t.terminalId === terminalId && !isDoneColumn(taskProject(t), t.columnId))
      .sort((a, b) => b.updatedAt - a.updatedAt)[0] || null
  );
}

/**
 * Resolve uma referência: id, chave ("MA-12") ou título exato. Sem referência, usa a tarefa
 * aberta mais recente do terminal que pediu (conveniência para o agente: "a tarefa atual").
 */
export function resolveTaskRef(ref, { project, terminalId } = {}) {
  if (!ref) {
    const current = terminalId && currentTaskOf(terminalId);
    if (current) return current;
    throw new Error('Informe a tarefa (id, chave como "MA-3" ou título).');
  }
  const r = String(ref).trim().toLowerCase();
  const direct = allTasks().find((t) => t.id === ref || t.key.toLowerCase() === r);
  if (direct) return direct;
  const byTitle = (project ? projectTasks(project) : allTasks()).filter((t) => t.title.toLowerCase() === r);
  if (byTitle.length === 1) return byTitle[0];
  if (byTitle.length > 1) throw new Error(`Título ambíguo; use a chave: ${byTitle.map((t) => t.key).join(', ')}`);
  throw new Error(`Tarefa não encontrada: ${ref}`);
}
