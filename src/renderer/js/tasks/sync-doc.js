// Tarefa local ⇄ documento do servidor (docs/API.md → "Quadro de tarefas") e a fusão em três vias.
// Fica só local: terminal de origem, "Em espera" e sugestões de memória do agente.
// No histórico, "você" vira o seu nome ao enviar e volta a ser "você" ao receber.

const FIELDS = ['title', 'description', 'columnId', 'parentId', 'progress', 'tags', 'memoryRefs', 'repo', 'branch'];
const DEFAULTS = { description: '', parentId: null, progress: null, tags: [], memoryRefs: [], repo: null, branch: null };

/** JSON com as chaves em ordem: o servidor (jsonb) não preserva a ordem de quem enviou. */
export function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  return JSON.stringify(v ?? null);
}

const same = (a, b) => stable(a) === stable(b);
const rename = (history, from, to) => (history || []).map((h) => (h.by === from ? { ...h, by: to } : h));

export function toDoc(task, myName) {
  const doc = { createdAt: task.createdAt, updatedAt: task.updatedAt, history: rename(task.history, 'você', myName) };
  for (const f of FIELDS) doc[f] = task[f] ?? DEFAULTS[f] ?? null;
  return doc;
}

/** Campos do documento recebido para gravar na tarefa local. */
export function fromDoc(doc, myName) {
  const out = { createdAt: doc.createdAt ?? Date.now(), updatedAt: doc.updatedAt ?? Date.now(), history: rename(doc.history, myName, 'você') };
  for (const f of FIELDS) out[f] = doc[f] ?? DEFAULTS[f] ?? null;
  return out;
}

/** Histórico das duas versões, sem repetir, em ordem de tempo. */
function unionHistory(a = [], b = []) {
  const seen = new Set();
  return [...a, ...b]
    .filter((h) => {
      const k = stable(h);
      return !seen.has(k) && seen.add(k);
    })
    .sort((x, y) => (x.at || 0) - (y.at || 0));
}

/**
 * Fusão campo a campo contra a última versão recebida (`base`): quem mudou o campo vence; os dois
 * mudaram → a sua (`local`). O histórico é a união.
 */
export function mergeDocs(base, local, server) {
  const out = { ...server };
  for (const f of FIELDS) {
    if (base && same(local[f], base[f])) out[f] = server[f];
    else if (base && same(server[f], base[f])) out[f] = local[f];
    else out[f] = local[f];
  }
  out.history = unionHistory(server.history, local.history);
  out.createdAt = Math.min(local.createdAt || Infinity, server.createdAt || Infinity);
  out.updatedAt = Math.max(local.updatedAt || 0, server.updatedAt || 0);
  return out;
}

export { same as sameDoc };
