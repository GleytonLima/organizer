// Tags de tarefa: rótulos curtos para agrupar e ligar a outros sistemas (ex.: "jira:PROJ-123",
// "frontend"). Guardadas em task.tags (lista; tarefas antigas não têm o campo = sem tags).
// A grafia é mantida (PROJ-123 continua maiúsculo); comparação ignora maiúsculas e acentos.
const MAX = 40;

export const foldTag = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** "  minha tag " → "minha-tag"; sem "#" na frente; vazio → null. */
export function normalizeTag(raw) {
  const t = String(raw || '').trim().replace(/^#+/, '').replace(/\s+/g, '-').slice(0, MAX);
  return t || null;
}

/** "a, b  c" → ["a", "b", "c"] (vírgula ou espaço separam). */
export const parseTags = (text) => String(text || '').split(/[,\s]+/).map(normalizeTag).filter(Boolean);

export const tagsOf = (task) => task.tags || [];

export const hasTag = (task, tag) => tagsOf(task).some((t) => foldTag(t) === foldTag(tag));

/** Tags em uso nas `tasks`, as mais usadas primeiro. */
export function tagsInUse(tasks) {
  const count = new Map(); // fold → { tag, n }
  for (const task of tasks) for (const t of tagsOf(task)) {
    const k = foldTag(t);
    const hit = count.get(k) || { tag: t, n: 0 };
    hit.n += 1;
    count.set(k, hit);
  }
  return [...count.values()].sort((a, b) => b.n - a.n || a.tag.localeCompare(b.tag)).map((x) => x.tag);
}
