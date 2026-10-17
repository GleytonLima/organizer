// "Retomar" uma tarefa de outra máquina/dev: a memória de progresso (do servidor) vira — ou
// atualiza — a tarefa local com a mesma chave, com o status e os próximos passos no histórico.
import { store, commit } from '../core/store.js';
import { makeTask } from '../core/model.js';
import { columnsOf, isDoneColumn } from '../tasks/columns.js';
import { projectTasks } from '../tasks/queries.js';
import { logTask } from '../tasks/history.js';

/** Coluna "em andamento": a segunda, se houver uma antes da final; senão a primeira. */
const doingColumn = (project) => {
  const cols = columnsOf(project);
  return cols.length > 2 ? cols[1] : cols[0];
};

/** Mantém a sequência de chaves à frente de uma chave adotada ("BO-27" → taskSeq ≥ 27). */
function bumpSeq(project, key) {
  const n = Number(/-(\d+)$/.exec(key)?.[1]);
  if (n > (project.taskSeq || 0)) project.taskSeq = n;
}

function summary(memory) {
  const p = memory.progress || {};
  const steps = (p.nextSteps || []).map((s) => `• ${s}`).join('\n');
  const where = [p.repo, p.branch && `branch ${p.branch}`].filter(Boolean).join(' · ');
  return [p.status || memory.text, steps && `Próximos passos:\n${steps}`, where].filter(Boolean).join('\n');
}

export function adoptTaskFromProgress(project, memory) {
  const p = memory.progress || {};
  const key = memory.taskKey || p.task?.key;
  if (!key) throw new Error('O progresso não indica a tarefa.');
  let task = projectTasks(project).find((t) => t.key === key);
  if (!task) {
    task = makeTask({ key, projectId: project.id, columnId: doingColumn(project).id, title: p.task?.title || key, description: p.task?.description || '' });
    store.state.tasks.push(task);
    bumpSeq(project, key);
    logTask(task, 'você', 'created', 'Retomada pelo servidor de memória');
  } else if (isDoneColumn(project, task.columnId)) {
    task.columnId = doingColumn(project).id;
  }
  if (p.branch) task.branch = p.branch;
  logTask(task, 'você', 'report', `Retomada${p.owner?.name ? ` (agora com ${p.owner.name})` : ''}.\n${summary(memory)}`);
  commit();
  return task;
}
