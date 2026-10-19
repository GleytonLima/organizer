// Lembretes na Home: os que tocaram ficam em "Aguardando você" (Concluir ou Adiar) e os próximos numa
// lista curta, com a hora e um × para cancelar.
import { el } from '../../core/dom.js';
import { timeAgo } from '../../core/format.js';
import { taskById } from '../../tasks/queries.js';
import { completeReminder, snoozeReminder } from '../../actions/reminders.js';
import { describeWhen } from '../../reminders/when.js';
import { iconButton } from '../components.js';
import { icon } from '../icons.js';
import { showMenu } from '../menu.js';
import { openInPanel } from './cards.js';

const SNOOZE = [
  ['Daqui a 10 min', 'em 10 min'],
  ['Daqui a 1 hora', 'em 1 hora'],
  ['Amanhã às 9h', 'amanhã 9h'],
];

const snoozeMenu = (e, r) => showMenu(e, SNOOZE.map(([label, when]) => ({ label, action: () => snoozeReminder(r.id, when) })));

/** Lembrete que tocou: o texto, há quanto tempo e a tarefa ligada (se houver). */
export function reminderCard(r) {
  const task = r.taskId ? taskById(r.taskId) : null;
  const late = Date.now() - r.at > 5 * 60e3;
  return el(
    'article',
    { class: 'home-card reminder', 'data-reminder': r.id },
    el('header', { class: 'home-card-head' },
      el('span', { class: 'home-where' }, icon('bell'), el('span', { text: r.by === 'você' ? 'Lembrete' : `Lembrete do ${r.by}` })),
      el('span', { class: 'spacer' }),
      el('span', { class: 'hint', text: late ? `era para ${describeWhen(r.at)}` : timeAgo(r.at) === 'agora' ? 'agora' : `há ${timeAgo(r.at)}` })),
    el('p', { class: 'home-question', text: r.text }),
    el('div', { class: 'home-actions' },
      task ? el('button', { type: 'button', class: 'link', onclick: () => openInPanel(task), text: task.title }) : null,
      el('span', { class: 'spacer' }),
      el('button', { type: 'button', class: 'btn ghost', onclick: (e) => snoozeMenu(e, r), text: 'Adiar' }),
      el('button', { type: 'button', class: 'btn primary', onclick: () => completeReminder(r.id), text: 'Concluir' })),
  );
}

/** Próximos lembretes (os 5 mais perto), com a hora e um × para cancelar. */
export function upcomingSection(list) {
  if (!list.length) return null;
  return el('section', { class: 'home-section' },
    el('h3', { class: 'home-h', text: 'Próximos lembretes' }),
    el('ul', { class: 'home-upcoming' },
      list.slice(0, 5).map((r) =>
        el('li', { 'data-reminder': r.id },
          el('span', { class: 'home-upcoming-when', text: describeWhen(r.at) }),
          el('span', { class: 'home-upcoming-text', text: r.text }),
          iconButton('close', 'Cancelar lembrete', () => completeReminder(r.id), 'reveal'),
        ))));
}
