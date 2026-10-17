// Memória de progresso: o estado de uma tarefa (status, próximos passos, repo e branch) para você
// ou outro dev retomar em outra máquina. Uma por tarefa e projeto — gravar de novo atualiza.
import { gitFor } from '../git/git.js';

/** Monta o progresso da tarefa. `cwd`: pasta de onde vêm repo e branch (o terminal de quem grava). */
export function buildProgress(task, { status, nextSteps = [], cwd = null }) {
  const g = cwd ? gitFor(cwd) : null;
  const steps = (Array.isArray(nextSteps) ? nextSteps : String(nextSteps).split(/\n|;/)).map((s) => s.trim()).filter(Boolean);
  return {
    status: String(status || '').trim(),
    nextSteps: steps,
    repo: g?.repo || task.repo || null,
    branch: g?.branch || task.branch || null,
    task: { key: task.key, title: task.title, description: task.description || '' },
  };
}

/** Grava (ou atualiza) o progresso da tarefa. Retorna a memória. */
export async function saveProgress(project, task, { status, nextSteps, cwd, source = 'você' }) {
  if (!String(status || '').trim()) throw new Error('Descreva o status da tarefa.');
  const [current] = await api.memory.list({ projectId: project.id, kind: 'progress', taskKey: task.key, limit: 1 });
  const progress = { ...current?.progress, ...buildProgress(task, { status, nextSteps, cwd }) };
  const text = `${task.key}: ${progress.status}`;
  if (current) return api.memory.update(current.id, { text, progress });
  return api.memory.add({ kind: 'progress', projectId: project.id, project: project.name, taskKey: task.key, text, progress, source, repo: progress.repo });
}
