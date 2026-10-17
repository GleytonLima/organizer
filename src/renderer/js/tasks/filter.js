// Filtro da lista de tarefas (painel): busca por texto (chave, título, descrição) e chips
// "Em espera" / "Com memória". Estado só da interface (não é salvo); o escopo — projeto em foco ou
// todos os projetos — é salvo em state.taskScope, como o período.
import { store, commit, notify } from '../core/store.js';

export const taskFilter = { query: '', waiting: false, memory: false };

export const CHIPS = [
  { key: 'waiting', label: 'Em espera' },
  { key: 'memory', label: 'Com memória' },
];

const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function setTaskQuery(query) {
  taskFilter.query = query;
  notify();
}

export function toggleTaskChip(key) {
  taskFilter[key] = !taskFilter[key];
  notify();
}

export const filterActive = () => !!(taskFilter.query.trim() || taskFilter.waiting || taskFilter.memory);

const KEY = /^[a-z]+-\d+$/; // "ma-1" casa só a chave MA-1 (não MA-10, MA-11…)

/** A tarefa passa no filtro? (todas as palavras da busca precisam aparecer) */
export function matchesFilter(task) {
  if (taskFilter.waiting && !task.needsInput) return false;
  if (taskFilter.memory && !task.memoryRefs?.length) return false;
  const words = fold(taskFilter.query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = fold(`${task.key} ${task.title} ${task.description}`);
  return words.every((w) => (KEY.test(w) ? fold(task.key) === w : hay.includes(w)));
}

export const SCOPES = [
  { id: 'project', label: 'Projeto em foco' },
  { id: 'all', label: 'Todos os projetos' },
];

export const taskScope = () => (store.state.taskScope === 'all' ? 'all' : 'project');

export function setTaskScope(id) {
  store.state.taskScope = id;
  commit();
}
