// Ideias: viram tarefa (já vinculada à ideia, para o agente ter o contexto) ou são descartadas.
import { commit } from '../core/store.js';
import { createTask } from './tasks.js';
import { invalidateMemory } from '../ui/memory/state.js';
import { openTask } from '../ui/tasks/selection.js';

/** Cria a tarefa a partir da ideia (1ª linha = título) e marca a ideia como "virou tarefa". */
export async function ideaToTask(project, idea, { by = 'você', open = true } = {}) {
  const [first, ...rest] = idea.text.split('\n');
  const title = first.length > 120 ? `${first.slice(0, 117)}…` : first;
  const task = createTask(project, { title, description: rest.join('\n').trim(), by });
  task.memoryRefs = [idea.gid];
  commit();
  await api.memory.update(idea.id, { status: 'converted', taskKey: task.key });
  invalidateMemory();
  if (open) openTask(task.id);
  return task;
}

/** 'open' | 'discarded' (reabrir ou descartar). */
export async function setIdeaStatus(idea, status) {
  await api.memory.update(idea.id, { status });
  invalidateMemory();
}
