// Sessão de agente (ACP) ⇄ quadro de tarefas — o "Em espera automático":
//   1º pedido sem tarefa no terminal → cria a tarefa (título = começo do pedido)
//   pedido de permissão → a tarefa fica Em espera, com a pergunta e as opções como botões
//   resposta (no terminal ou na tarefa) → a espera termina
//   fim do turno → relato na tarefa com o fim da resposta do agente
import { commit, findTerm } from '../core/store.js';
import { currentTaskOf } from '../tasks/queries.js';
import { createTask, reportTask } from './tasks.js';
import { requestInput } from './task-waiting.js';
import { logTask, notifyAbout } from '../tasks/history.js';

const firstLine = (text) => {
  const line = text.split('\n')[0].trim();
  return line.length > 80 ? `${line.slice(0, 77)}…` : line;
};

export function onPrompt(terminalId, text) {
  if (currentTaskOf(terminalId)) return;
  const entry = findTerm(terminalId);
  if (entry) createTask(entry.project, { title: firstLine(text), description: text, terminalId, by: 'agente' });
}

export function onPermission(terminalId, item) {
  const task = currentTaskOf(terminalId);
  if (!task) return;
  requestInput(task, `Pede permissão: ${item.title}`, { terminalId });
  task.needsInput.choices = item.options.map((o) => ({ id: o.optionId, label: o.name, kind: o.kind }));
  task.needsInput.permission = { terminalId, requestId: item.requestId };
  commit();
}

/** Respondida (no terminal ou na tarefa): encerra a espera ligada a este pedido. */
export function onPermissionAnswered(terminalId, item) {
  const task = currentTaskOf(terminalId);
  const waiting = task?.needsInput?.permission;
  if (!waiting || waiting.requestId !== item?.requestId) return;
  const chosen = item.options.find((o) => o.optionId === item.answer);
  task.needsInput = null;
  logTask(task, 'você', 'reply', chosen ? `Respondeu: ${chosen.name}` : 'Pedido cancelado');
  commit();
}

export function onTurnEnd(terminalId, lastMessage, stopReason) {
  const task = currentTaskOf(terminalId);
  if (!task) return;
  const tail = lastMessage.trim().slice(-400);
  if (tail) reportTask(task, tail, { by: 'agente', terminalId });
  if (stopReason === 'end_turn') notifyAbout(task, `${task.key}: o agente terminou`);
}

/** Escolha feita na gaveta da tarefa: responde o pedido de permissão do agente. */
export function answerFromTask(task, choiceId) {
  const p = task.needsInput?.permission;
  if (!p) throw new Error('Esta espera não é um pedido de permissão do agente.');
  return api.acp.permission(p.terminalId, p.requestId, choiceId);
}
