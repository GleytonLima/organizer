// Central de notificações: lista recente, não lidas por terminal e entrega do toast.
// Regras: se você já está vendo o terminal (janela em foco + terminal visível), nada é criado;
// com a janela em foco, só a marcação na interface; sem foco, também o toast do Windows.
import { findTerm, notify, visibleTerminalIds } from '../core/store.js';
import { uid } from '../core/model.js';
import { termLabel } from '../core/format.js';

const MAX = 50;
const items = []; // { id, terminalId, title, body, at, read }

export const recentNotifications = () => items;
export const unreadCount = () => items.filter((n) => !n.read).length;
export const hasUnread = (terminalIds) => items.some((n) => !n.read && terminalIds.includes(n.terminalId));

const isWatching = (terminalId) => document.hasFocus() && visibleTerminalIds().includes(terminalId);

/** Cria uma notificação. `label` (opcional) prefixa a mensagem, ex.: "Claude: terminei". */
export function pushNotification({ terminalId = null, label, body }) {
  if (terminalId && isWatching(terminalId)) return { delivered: false, reason: 'o usuário já está vendo este terminal' };
  const entry = findTerm(terminalId);
  const title = entry ? `${termLabel(entry.t)} · ${entry.project.name}` : 'Bash Organizer';
  const text = [label, body].filter(Boolean).join(': ') || 'Pediu sua atenção';
  items.unshift({ id: uid(), terminalId: entry ? terminalId : null, title, body: text, at: Date.now(), read: false });
  items.length = Math.min(items.length, MAX);
  const toast = !document.hasFocus();
  if (toast) api.showToast({ title, body: text, terminalId });
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

/** `onOpen(terminalId)`: o que fazer quando o usuário clica num toast/aviso. */
export function initNotifyCenter({ onOpen }) {
  window.addEventListener('focus', notify); // o re-render marca como lidos os terminais visíveis
  api.onToastClicked((terminalId) => terminalId && onOpen(terminalId));
}
