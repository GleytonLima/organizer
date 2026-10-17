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
export const isOpen = (id) => openId === id;
