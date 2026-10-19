// Estado de espera de uma tarefa (vale em qualquer coluna):
//   1. o agente pergunta (requestInput) → a tarefa fica "Em espera" e você é avisado;
//   2. um agente supervisor pode deixar uma sugestão de resposta/resumo (suggestReply);
//   3. você responde (replyToTask) → o texto é enviado direto ao terminal que perguntou.
import { commit, findTerm } from '../core/store.js';
import { writeWhenReady } from '../terminals/sessions.js';
import { logTask, stampOrigin, notifyAbout } from '../tasks/history.js';

export function requestInput(task, question, { terminalId } = {}) {
  if (!String(question || '').trim()) throw new Error('Informe a pergunta para o usuário.');
  stampOrigin(task, terminalId);
  task.needsInput = { question: question.trim(), at: Date.now(), suggestion: null };
  logTask(task, 'agente', 'input', `Em espera: ${question.trim()}`);
  commit();
  notifyAbout(task, `Em espera — ${question.trim()}`, { urgent: true }); // passa pelo modo foco
  return task;
}

/** Sugestão de um supervisor (outro agente): aparece pré-preenchida na sua resposta. */
export function suggestReply(task, text, { by = 'supervisor' } = {}) {
  if (!task.needsInput) throw new Error(`${task.key} não está em espera.`);
  if (!String(text || '').trim()) throw new Error('A sugestão precisa de um texto.');
  task.needsInput.suggestion = { text: text.trim(), by, at: Date.now() };
  logTask(task, by, 'input', `Sugeriu: ${text.trim()}`);
  commit();
  return task;
}

/**
 * Envia sua resposta ao terminal de origem (como se você tivesse digitado lá) e encerra a espera.
 * Se o terminal não existir mais, a resposta fica só registrada no histórico.
 */
export async function replyToTask(task, text) {
  const answer = String(text || '').trim();
  if (!answer) throw new Error('Escreva a resposta.');
  const origin = findTerm(task.terminalId);
  let sent = false;
  if (origin) {
    await writeWhenReady(origin.t.id, answer + '\r');
    sent = true;
  }
  task.needsInput = null;
  logTask(task, 'você', 'reply', `${sent ? 'Respondeu no terminal' : 'Respondeu (terminal de origem não existe mais)'}: ${answer}`);
  commit();
  return { sent };
}

/** Encerra a espera sem enviar nada ao terminal. */
export function dismissWaiting(task) {
  if (!task.needsInput) return;
  task.needsInput = null;
  logTask(task, 'você', 'reply', 'Encerrou a espera sem responder');
  commit();
}
