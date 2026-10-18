// Filtro da lista de tarefas (painel): busca por texto (chave, título, descrição; "#tag" casa tag),
// chips "Em espera" / "Com memória", uma tag e memórias específicas (tarefas que as referenciam). Estado só da interface (não é salvo); o escopo — projeto em foco ou
// todos os projetos — é salvo em state.taskScope, como o período.
import { store, commit, notify } from '../core/store.js';
import { hasTag, foldTag } from './tags.js';

// tag: uma tag (ou null); memories: [{ gid, text }] escolhidas no seletor de memórias
// open: painel de filtros (atrás do funil da busca) aberto
export const taskFilter = { query: '', waiting: false, memory: false, tag: null, memories: [], open: false };

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

/** Liga/desliga a tag (clicar de novo na mesma tira o filtro). */
export function toggleTaskTag(tag) {
  taskFilter.tag = taskFilter.tag && foldTag(taskFilter.tag) === foldTag(tag) ? null : tag;
  notify();
}

export function setMemoryFilter(memories) {
  taskFilter.memories = memories;
  notify();
}

export function toggleFilterPanel() {
  taskFilter.open = !taskFilter.open;
  notify();
}

/** Quantos filtros (além da busca) estão ligados: o número no funil. */
export const activeFilterCount = () => CHIPS.filter((c) => taskFilter[c.key]).length + (taskFilter.tag ? 1 : 0) + (taskFilter.memories.length ? 1 : 0);

export const filterActive = () => !!(taskFilter.query.trim() || taskFilter.waiting || taskFilter.memory || taskFilter.tag || taskFilter.memories.length);

const KEY = /^[a-z]+-\d+$/; // "ma-1" casa só a chave MA-1 (não MA-10, MA-11…)

/** A tarefa passa no filtro? (todas as palavras da busca precisam aparecer) */
export function matchesFilter(task) {
  if (taskFilter.waiting && !task.needsInput) return false;
  if (taskFilter.memory && !task.memoryRefs?.length) return false;
  if (taskFilter.tag && !hasTag(task, taskFilter.tag)) return false;
  if (taskFilter.memories.length && !taskFilter.memories.some((m) => task.memoryRefs?.includes(m.gid))) return false;
  const words = fold(taskFilter.query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = fold(`${task.key} ${task.title} ${task.description}`);
  const match = (w) => (w.startsWith('#') ? w.length === 1 || hasTag(task, w.slice(1)) : KEY.test(w) ? fold(task.key) === w : hay.includes(w));
  return words.every(match);
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
