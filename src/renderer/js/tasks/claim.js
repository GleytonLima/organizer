// "Retomar" pelo quadro do time: você vira o dono da tarefa (owner no servidor) — nada de tarefa
// nova. Vale para a tarefa do quadro e para o "Retomar" de uma memória de progresso.
import { projects } from '../core/store.js';
import { projectTasks } from './queries.js';
import { syncTasksNow, myServerName } from './sync.js';
import { adoptTaskFromProgress } from '../actions/task-adopt.js';

const syncedProject = (task) => projects().find((p) => p.id === task.projectId && p.syncKey);

// duas chamadas: a primeira pode só alcançar uma rodada que já estava em andamento
const fullRound = async () => {
  await syncTasksNow();
  await syncTasksNow();
};

/** A tarefa está com outra pessoa (e pode ser retomada por você)? */
export const ownedByOther = (task) => !!(task.owner?.name && syncedProject(task) && task.owner.name !== myServerName());

/** Você vira o dono. A tarefa sobe antes se ainda não estava no servidor; a versão retomada chega em seguida. */
export async function claimTask(task) {
  const project = syncedProject(task);
  if (!project) throw new Error('Esta tarefa não é de um projeto sincronizado (defina a chave de sincronização).');
  await fullRound();
  const claimed = await api.sync.claimTask(project.syncKey, task.id);
  if (!claimed) throw new Error(`${task.key} ainda não chegou ao servidor; tente de novo em instantes.`);
  task.owner = claimed.owner;
  await fullRound();
  return task;
}

/**
 * "Retomar" a partir de uma memória de progresso já reivindicada (`claimed`). Com o quadro do time,
 * o quadro sincroniza antes: a tarefa que já existe é adotada pela chave e retomada (sem duplicar).
 */
export async function resumeFromProgress(project, claimed) {
  if (project.syncKey) await fullRound();
  const existing = projectTasks(project).find((t) => t.key === claimed.taskKey);
  const task = adoptTaskFromProgress(project, claimed);
  if (project.syncKey && existing) await claimTask(task);
  return task;
}
