// Sino da barra superior: contador de não lidos e lista dos avisos recentes.
import { el } from '../core/dom.js';
import { findTerm } from '../core/store.js';
import { activate } from '../actions/terminals.js';
import { recentNotifications, unreadCount, clearNotifications } from '../notify/center.js';
import { iconButton } from './components.js';
import { showMenu } from './menu.js';

const MAX_ITEMS = 12;

function timeAgo(at) {
  const s = Math.round((Date.now() - at) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  return `${Math.floor(s / 3600)} h`;
}

function notificationsMenu(e) {
  const list = recentNotifications().slice(0, MAX_ITEMS);
  if (!list.length) return showMenu(e, [{ label: 'Nenhum aviso', muted: true, action: () => {} }]);
  showMenu(e, [
    ...list.map((n) => ({
      label: `${n.title} — ${n.body}`,
      hint: timeAgo(n.at),
      muted: n.read,
      action: () => n.terminalId && findTerm(n.terminalId) && activate(n.terminalId),
    })),
    { sep: true },
    { label: 'Limpar avisos', action: clearNotifications },
  ]);
}

export function notificationsButton() {
  const unread = unreadCount();
  const btn = iconButton('bell', unread ? `${unread} aviso(s) não lido(s)` : 'Avisos', notificationsMenu, 'bell-btn');
  if (unread) btn.append(el('span', { class: 'bell-badge', text: unread > 9 ? '9+' : unread }));
  return btn;
}
