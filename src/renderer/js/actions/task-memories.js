// Memórias referenciadas por uma tarefa (task.memoryRefs = [gid]): decisões, como fazer, ideias…
// que dão contexto ao agente. Vão junto no get_task e aparecem na gaveta da tarefa.
import { commit, notify } from '../core/store.js';
import { logTask } from '../tasks/history.js';

const cache = new Map(); // task.id → { key, items } (memórias resolvidas para a gaveta)
const keyOf = (task) => (task.memoryRefs || []).join(',');

/** Resolve ids curtos ou gids para memórias deste app (as desconhecidas são recusadas). */
async function resolve(refs) {
  const items = await api.memory.many(refs);
  if (items.length !== refs.length) throw new Error('Memória não encontrada entre as referências informadas.');
  return items;
}

export async function linkTaskMemories(task, refs, { by = 'você' } = {}) {
  const items = await resolve(refs);
  const current = new Set(task.memoryRefs || []);
  const fresh = items.filter((m) => !current.has(m.gid));
  if (!fresh.length) return task;
  task.memoryRefs = [...current, ...fresh.map((m) => m.gid)];
  logTask(task, by, 'edit', `Vinculou ${fresh.length === 1 ? 'a memória' : 'as memórias'}: ${fresh.map((m) => `“${m.text.slice(0, 60)}”`).join(', ')}`);
  commit();
  return task;
}

export async function unlinkTaskMemory(task, ref) {
  const [m] = await api.memory.many([ref]);
  const gid = m?.gid || ref;
  task.memoryRefs = (task.memoryRefs || []).filter((g) => g !== gid);
  commit();
  return task;
}

/** Memórias da tarefa já resolvidas (para a API). */
export const taskMemories = (task) => (task.memoryRefs?.length ? api.memory.many(task.memoryRefs) : Promise.resolve([]));

/** Versão em cache para a interface: busca em segundo plano e re-renderiza quando chega. */
export function cachedTaskMemories(task) {
  const key = keyOf(task);
  const hit = cache.get(task.id);
  if (hit?.key === key) return hit.items;
  cache.set(task.id, { key, items: hit?.items || [] });
  taskMemories(task).then((items) => {
    cache.set(task.id, { key, items });
    notify();
  });
  return hit?.items || [];
}

/** Esquece o cache (depois de editar memórias, por exemplo). */
export const refreshTaskMemories = () => cache.clear();
