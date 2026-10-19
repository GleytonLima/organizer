// Ações da Home: abrir/fechar (fechar marca "visto agora", base do "enquanto você esteve fora"),
// responder várias esperas de uma vez com as sugestões e o modo foco (segura avisos não urgentes).
import { store, commit } from '../core/store.js';
import { setTaskView } from './tasks.js';
import { replyToTask } from './task-waiting.js';
import { activate } from './terminals.js';
import { waitingItems, awaySummary, isEmptySummary } from '../home/data.js';

export const isHomeOpen = () => store.state.taskView === 'home';

export const openHome = () => setTaskView('home');

/** Fecha a Home (volta aos terminais); o que estava no resumo conta como visto. */
export function closeHome() {
  store.state.homeSeenAt = Date.now();
  setTaskView('off');
}

/** Ao abrir o app: a Home aparece se houver algo esperando você ou novidades desde a última vez. */
export function homeOnStart() {
  if (waitingItems().length || !isEmptySummary(awaySummary(store.state.homeSeenAt))) openHome();
}

/** Responde cada tarefa com a própria sugestão (as sem sugestão ficam). Devolve quantas respondeu. */
export async function replyWithSuggestions(tasks) {
  let n = 0;
  for (const task of tasks) {
    const text = task.needsInput?.suggestion?.text;
    if (!text || task.needsInput.choices?.length) continue;
    await replyToTask(task, text);
    n++;
  }
  return n;
}

/** Continuar uma frente de trabalho: o terminal de origem, se ainda existe. */
export function resumeTask(task) {
  if (!task.terminalId) return false;
  store.state.homeSeenAt = Date.now();
  store.state.taskView = 'off';
  activate(task.terminalId);
  return true;
}

export function setFocusMode(on) {
  store.state.focusMode = !!on;
  commit();
}
