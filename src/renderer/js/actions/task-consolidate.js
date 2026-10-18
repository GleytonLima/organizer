// Fim de tarefa = hora de consolidar a memória (curto → longo prazo):
//   • o progresso da tarefa ("onde parei") cumpriu o papel: é arquivado e sai da busca padrão
//     (continua no filtro Progresso); reabrir a tarefa o traz de volta;
//   • o agente que trabalhou nela propõe de 1 a 3 memórias duráveis (suggest_memory) — pela resposta
//     do complete_task, ou por um pedido nosso se você concluiu e o agente está livre.
import { commit, findTerm } from '../core/store.js';
import { getSession } from '../terminals/sessions.js';
import { taskProject } from '../tasks/queries.js';
import { logTask } from '../tasks/history.js';
import { invalidateMemory } from '../ui/memory/state.js';

/** O que o agente lê ao concluir (na resposta do complete_task ou como mensagem). */
export const consolidationRequest = (task) =>
  `A tarefa ${task.key} (“${task.title}”) foi concluída. Antes de seguir: do que você fez e aprendeu nela, ` +
  'proponha de 1 a 3 memórias DURÁVEIS com a ferramenta suggest_memory (task: ' + task.key + ') — uma decisão em uma frase com o porquê, ' +
  'um "como fazer" ou uma nota que valha para quem vier depois. Nada de relato do que foi feito (isso já está no histórico). ' +
  'O usuário aceita ou descarta cada uma. Se não houver nada durável, não proponha nada.';

const quietly = (p) => p.catch((err) => console.warn('consolidação:', err.message));

/** Terminal de agente (ACP) da tarefa, se existir. */
function agentOf(task) {
  const found = findTerm(task.terminalId);
  return found?.t.kind === 'agent' ? getSession(found.t.id) : null;
}

export const canAskAgent = (task) => !!agentOf(task);

/** Pede as sugestões ao agente da tarefa (precisa estar livre). */
export function askForSuggestions(task, { by = 'você' } = {}) {
  const session = agentOf(task);
  if (!session) throw new Error('A tarefa não tem um terminal de agente aberto.');
  const turn = session.send(consolidationRequest(task)); // ocupado: lança "O agente ainda está trabalhando."
  task.consolidationAskedAt = Date.now();
  logTask(task, by, 'edit', 'Pediu ao agente sugestões de memória');
  commit();
  quietly(Promise.resolve(turn)); // o turno corre em segundo plano; as sugestões chegam pelo suggest_memory
}

/** Progresso salvo da tarefa: arquiva ("done") ou reabre ("open"). */
async function setProgressStatus(task, status) {
  const project = taskProject(task);
  const [progress] = await api.memory.list({ projectId: project.id, kind: 'progress', taskKey: task.key, limit: 1 });
  if (!progress || (progress.status || 'open') === status) return;
  await api.memory.update(progress.id, { status });
  invalidateMemory();
}

/** Chamado ao entrar na última coluna. `by`: quem moveu (o agente já recebe o pedido na resposta). */
export function onTaskDone(task, { by }) {
  quietly(setProgressStatus(task, 'done'));
  if (by === 'agente' || task.consolidationAskedAt || agentOf(task)?.state !== 'pronto') return;
  try {
    askForSuggestions(task, { by: 'app' });
  } catch (err) {
    console.warn('consolidação:', err.message);
  }
}

export const onTaskReopened = (task) => quietly(setProgressStatus(task, 'open'));
