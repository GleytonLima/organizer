// Estado da aba Memória (só da interface): consulta, filtro e resultados da última busca.
import { notify } from '../../core/store.js';
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

/** Busca de novo se projeto, consulta, filtro ou dados mudaram desde a última vez. */
export function ensureFresh(project) {
  const context = memoryContext(project); // globais + projeto + pastas do projeto
  const key = [project.id, context.folders.join(';'), memoryView.query, memoryView.kind, memoryView.version].join('|');
  if (key === memoryView.key) return;
  memoryView.key = key;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const review = memoryView.kind === 'review';
    memoryView.result = await api.memory.search(memoryView.query, { context, kind: review ? undefined : memoryView.kind || undefined, needsReview: review, limit: 100 });
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
