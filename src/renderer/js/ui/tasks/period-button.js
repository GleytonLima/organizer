// Seletor do período da lista/quadro de tarefas (ver tasks/period.js).
import { el } from '../../core/dom.js';
import { PERIODS, currentPeriod, setTaskPeriod } from '../../tasks/period.js';
import { icon } from '../icons.js';
import { showMenu } from '../menu.js';

const menu = (e) =>
  showMenu(e, [
    ...PERIODS.map((p) => ({ label: p.label, checked: p.id === currentPeriod().id, action: () => setTaskPeriod(p.id) })),
    { sep: true },
    { label: 'Tarefas em aberto aparecem sempre', muted: true, action: () => {} },
  ]);

export const periodButton = () =>
  el('button', { class: 'period-btn', title: 'Período das tarefas concluídas', onclick: menu }, el('span', { text: currentPeriod().label }), icon('chevron'));
