// Seletores da conversa de agente para as opções que o agente anuncia (configOptions do ACP):
// modelo, esforço, modo de permissão… Cada um é um botão "Modelo: Haiku 5.5 ▾" que abre a lista
// com descrições, navegável pelo teclado. Sem configOptions, usa os modos (session/set_mode).
import { el } from '../../core/dom.js';
import { icon } from '../icons.js';
import { createListPopup } from '../list-popup.js';

const LABELS = { mode: 'Modo', model: 'Modelo', thought_level: 'Esforço', effort: 'Esforço' };

/** Opções do agente no formato comum (com o modo como opção, se só houver "modes"). */
function optionsOf(s) {
  if (s.config?.length) return s.config.filter((o) => o.type === 'select' && o.options?.length);
  if (!s.modes?.available?.length) return [];
  return [{ id: 'mode', category: 'mode', currentValue: s.modes.current, options: s.modes.available.map((m) => ({ value: m.id, name: m.name || m.id, description: m.description })) }];
}

const labelOf = (o) => LABELS[o.category] || LABELS[o.id] || o.name || o.id;

let popup = null;
let target = null; // { s, option }

function choose(item) {
  const { s, option } = target;
  const apply = s.config?.length ? s.setConfig(option.id, item.value) : s.setMode(item.value);
  Promise.resolve(apply).catch((err) => {
    s.items.push({ type: 'error', text: `Não foi possível mudar ${labelOf(option).toLowerCase()}: ${err.message}` });
    s.render();
  });
}

function openPicker(e, s, option) {
  popup ||= createListPopup({ onPick: choose });
  target = { s, option, button: e.currentTarget };
  const items = option.options.map((o) => ({ value: o.value, label: o.name || o.value, detail: o.description || '', current: o.value === option.currentValue }));
  const rect = e.currentTarget.getBoundingClientRect();
  popup.show(rect, items, { selected: Math.max(0, items.findIndex((i) => i.current)), width: rect.width });
}

export function configPickers(s, { disabled = false } = {}) {
  return optionsOf(s).map((option) => {
    const current = option.options.find((o) => o.value === option.currentValue);
    return el(
      'button',
      {
        class: 'ag-picker',
        'data-option': option.id,
        title: option.description || labelOf(option),
        disabled,
        onclick: (e) => openPicker(e, s, option),
      },
      el('span', { class: 'ag-picker-label', text: `${labelOf(option)}:` }),
      el('span', { text: current?.name || option.currentValue || '—' }),
      icon('chevron'),
    );
  });
}
