// Estado da aba Memória (só da interface): consulta, filtro e resultados da última busca.
import { store, notify, commit } from '../../core/store.js';
import { memoryContext } from '../../memory/context.js';

const DEBOUNCE_MS = 200;

export const memoryView = {
  query: '',
  kind: null, // null (tudo) | tipo (memory/kinds.js) | 'review' (marcadas "a revisar")
  result: { mode: 'recentes', items: [] },
  key: null, // projeto+consulta+filtro da última busca
  version: 0, // incrementa após gravar/apagar, forçando nova busca
};

let timer = null;

/** Visão da aba: 'project' (o projeto em foco e as pastas dele, sem as globais) | 'global'. */
export const memoryScope = () => store.state.memoryScope || 'project';

export function setMemoryScope(scope) {
  store.state.memoryScope = scope;
  commit();
}

/** Onde buscar: contextual (sem as globais) ou só as globais. O agente continua vendo as duas (API). */
const where = (project) => (memoryScope() === 'global' ? { scope: 'global' } : { context: { ...memoryContext(project), withGlobal: false } });

/** Busca de novo se projeto, visão, consulta, filtro ou dados mudaram desde a última vez. */
export function ensureFresh(project) {
  const context = memoryContext(project);
  const key = [project.id, memoryScope(), context.folders.join(';'), memoryView.query, memoryView.kind, memoryView.version].join('|');
  if (key === memoryView.key) return;
  memoryView.key = key;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const review = memoryView.kind === 'review';
    memoryView.result = await api.memory.search(memoryView.query, { ...where(project), kind: review ? undefined : memoryView.kind || undefined, needsReview: review, limit: 100 });
    notify();
  }, memoryView.query ? DEBOUNCE_MS : 0);
}

export function setQuery(q) {
  memoryView.query = q;
  notify();
}

export function setKind(kind) {
  memoryView.kind = kind;
  notify();
}

/** Chame depois de gravar/editar/apagar para atualizar a lista. */
export function invalidateMemory() {
  memoryView.version++;
  notify();
}
