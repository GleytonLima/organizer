// Central de notificações: lista recente, não lidas por terminal e entrega do toast.
// Regras: se você já está vendo o terminal (janela em foco + terminal visível), nada é criado;
// com a janela em foco, só a marcação na interface; sem foco, também o toast do Windows.
import { findTerm, notify, visibleTerminalIds } from '../core/store.js';
import { uid } from '../core/model.js';
import { termLabel } from '../core/format.js';

const MAX = 50;
const items = []; // { id, terminalId, taskId, title, body, at, read }
let handlers = { openTerminal: () => {}, openTask: () => {} };

export const recentNotifications = () => items;
export const unreadCount = () => items.filter((n) => !n.read).length;
export const hasUnread = (terminalIds) => items.some((n) => !n.read && terminalIds.includes(n.terminalId));

const isWatching = (terminalId) => document.hasFocus() && visibleTerminalIds().includes(terminalId);

/**
 * Cria uma notificação. `label` (opcional) prefixa a mensagem, ex.: "Claude: terminei".
 * `taskId`: aviso de uma tarefa — clicar abre a tarefa (senão, o terminal).
 */
export function pushNotification({ terminalId = null, taskId = null, label, body }) {
  if (terminalId && isWatching(terminalId)) return { delivered: false, reason: 'o usuário já está vendo este terminal' };
  const entry = findTerm(terminalId);
  const title = entry ? `${termLabel(entry.t)} · ${entry.project.name}` : 'Brain Organizer';
  const text = [label, body].filter(Boolean).join(': ') || 'Pediu sua atenção';
  const id = uid();
  items.unshift({ id, terminalId: entry ? terminalId : null, taskId, title, body: text, at: Date.now(), read: false });
  items.length = Math.min(items.length, MAX);
  const toast = !document.hasFocus();
  if (toast) api.showToast({ id, title, body: text });
  notify();
  return { delivered: true, toast };
}

/** Marca como lidas as notificações destes terminais. Retorna se algo mudou. */
export function markRead(terminalIds) {
  let changed = false;
  for (const n of items) {
    if (!n.read && terminalIds.includes(n.terminalId)) changed = n.read = true;
  }
  return changed;
}

export function clearNotifications() {
  items.length = 0;
  notify();
}

/** Abre o que o aviso aponta (a tarefa, se houver; senão o terminal) e o marca como lido. */
export function openNotification(id) {
  const n = items.find((x) => x.id === id);
  if (!n) return;
  n.read = true;
  if (n.taskId && handlers.openTask(n.taskId)) return notify();
  if (n.terminalId && findTerm(n.terminalId)) handlers.openTerminal(n.terminalId);
  notify();
}

/** `openTerminal(id)` / `openTask(id)` (devolve se achou a tarefa): o que fazer ao clicar num toast/aviso. */
export function initNotifyCenter(h) {
  handlers = h;
  window.addEventListener('focus', notify); // o re-render marca como lidos os terminais visíveis
  api.onToastClicked((id) => openNotification(id));
}
