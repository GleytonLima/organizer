// Histórico e origem das tarefas: quem fez o quê, de qual terminal e em qual branch git.
import { findTerm } from '../core/store.js';
import { gitFor } from '../git/git.js';
import { pushNotification } from '../notify/center.js';

/** Registra um evento no histórico. type: 'created'|'moved'|'report'|'input'|'reply'|'edit'. */
export function logTask(task, by, type, text) {
  task.history.push({ at: Date.now(), by, type, text });
  task.updatedAt = Date.now();
}

/** Associa a tarefa ao terminal do agente e guarda o repositório e a branch em que ele está trabalhando. */
export function stampOrigin(task, terminalId) {
  if (!terminalId) return;
  task.terminalId = terminalId;
  const entry = findTerm(terminalId);
  const g = entry && gitFor(entry.t.cwd);
  if (g?.branch) task.branch = g.branch;
  if (g?.repo) task.repo = g.repo;
}

export const notifyAbout = (task, body) => pushNotification({ terminalId: task.terminalId, taskId: task.id, label: task.key, body });
