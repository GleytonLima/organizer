// Feedback qualitativo sobre uma tarefa: texto livre e um rótulo opcional de 1 clique, gravados com
// uma foto do contexto daquele momento — o que um cientista de dados precisa para cruzar o "porquê"
// (seu texto) com o "quê" (métricas). Guardado em src/main/metrics/feedback.js; alvo genérico
// { tipo: task | tag, id } para entregas que juntam várias tarefas.
import { notify, projectById } from '../core/store.js';
import { columnsOf, columnById } from '../tasks/columns.js';
import { timeline, waits } from './flow.js';

export const FEEDBACK_LABELS = [
  { id: 'first', label: 'Acertou de primeira' },
  { id: 'adjusted', label: 'Precisou de ajustes' },
  { id: 'redo', label: 'Refiz' },
];
export const labelName = (id) => FEEDBACK_LABELS.find((l) => l.id === id)?.label ?? null;

/** Foto da tarefa agora: coluna, tags, lead time, esperas, reaberturas e o uso do agente nela. */
export async function taskContext(task, now = Date.now()) {
  const project = projectById(task.projectId);
  const columns = project ? columnsOf(project) : [];
  const done = columns.at(-1)?.id;
  const steps = timeline(task, columns);
  const firstDone = steps.find((s) => s.col === done);
  const ws = waits(task);
  const events = (await api.metrics.query({ since: task.createdAt })).filter((e) => e.taskId === task.id);
  const turns = events.filter((e) => e.kind === 'agent.turn');
  const tokens = turns.reduce((a, e) => a + Object.values(e.data.usage || {}).reduce((x, y) => x + y, 0), 0);
  return {
    key: task.key,
    title: task.title,
    project: project?.name ?? null,
    column: columnById(project, task.columnId)?.name ?? null,
    tags: task.tags || [],
    parent: task.parentId || null,
    ageMs: now - task.createdAt,
    leadMs: firstDone ? firstDone.at - task.createdAt : null,
    reopened: steps.filter((s, i) => i > 0 && steps[i - 1].col === done && s.col !== done).length,
    waits: ws.length,
    waitMs: ws.reduce((a, w) => a + ((w.end ?? now) - w.start), 0),
    memories: task.memoryRefs?.length || 0,
    agent: {
      turns: turns.length,
      interrupted: turns.filter((e) => e.data.stopReason === 'cancelled').length,
      denied: events.filter((e) => e.kind === 'agent.permission' && String(e.data.kind).startsWith('reject')).length,
      tokens,
    },
  };
}

const cache = new Map(); // task.id → { items, loading }

/** Feedbacks da tarefa (do cache; busca em segundo plano e re-renderiza quando chegam). */
export function taskFeedback(task) {
  const hit = cache.get(task.id);
  if (hit) return hit.items;
  cache.set(task.id, { items: [] });
  api.feedback.list({ targetType: 'task', targetId: task.id }).then((items) => {
    cache.set(task.id, { items });
    notify();
  });
  return [];
}

export async function addTaskFeedback(task, { text, label }) {
  const context = await taskContext(task);
  const saved = await api.feedback.add({ targetType: 'task', targetId: task.id, projectId: task.projectId, text, label, context });
  cache.delete(task.id);
  notify();
  return saved;
}

export async function removeTaskFeedback(task, id) {
  await api.feedback.remove(id);
  cache.delete(task.id);
  notify();
}
