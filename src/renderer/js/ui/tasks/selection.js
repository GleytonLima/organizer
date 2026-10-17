// Tarefa aberta na gaveta de detalhe (estado só da interface, não é salvo).
import { notify } from '../../core/store.js';
import { taskById } from '../../tasks/queries.js';

let openId = null;

export const openTask = (id) => {
  openId = id;
  notify();
};

export const closeTask = () => {
  openId = null;
  notify();
};

export const selectedTask = () => (openId ? taskById(openId) : null);

/** Aviso de tarefa clicado: abre a gaveta dela (devolve false se a tarefa não existe mais). */
export function openTaskFromNotice(id) {
  if (!taskById(id)) return false;
  openTask(id);
  return true;
}
export const isOpen = (id) => openId === id;
