// Sino da barra superior: contador de não lidos e lista dos avisos recentes. Clicar num aviso abre a
// tarefa (aviso de tarefa) ou o terminal que o gerou, e o marca como lido.
import { el } from '../core/dom.js';
import { timeAgo } from '../core/format.js';
import { recentNotifications, unreadCount, clearNotifications, openNotification } from '../notify/center.js';
import { iconButton } from './components.js';
import { showMenu } from './menu.js';

const MAX_ITEMS = 12;

function notificationsMenu(e) {
  const list = recentNotifications().slice(0, MAX_ITEMS);
  if (!list.length) return showMenu(e, [{ label: 'Nenhum aviso', muted: true, action: () => {} }]);
  showMenu(e, [
    ...list.map((n) => ({
      label: `${n.title} — ${n.body}`,
      hint: timeAgo(n.at),
      muted: n.read,
      action: () => openNotification(n.id),
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
