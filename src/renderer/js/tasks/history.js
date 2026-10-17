// Histórico e origem das tarefas: quem fez o quê, de qual terminal e em qual branch git.
import { findTerm } from '../core/store.js';
import { gitFor } from '../git/git.js';
import { pushNotification } from '../notify/center.js';

/** Registra um evento no histórico. type: 'created'|'moved'|'report'|'input'|'reply'|'edit'. */
export function logTask(task, by, type, text) {
  task.history.push({ at: Date.now(), by, type, text });
  task.updatedAt = Date.now();
}

/** Associa a tarefa ao terminal do agente e guarda a branch em que ele está trabalhando. */
export function stampOrigin(task, terminalId) {
  if (!terminalId) return;
  task.terminalId = terminalId;
  const entry = findTerm(terminalId);
  const branch = entry && gitFor(entry.t.cwd)?.branch;
  if (branch) task.branch = branch;
}

export const notifyAbout = (task, body) => pushNotification({ terminalId: task.terminalId, label: task.key, body });
