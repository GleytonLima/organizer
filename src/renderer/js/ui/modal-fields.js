// Campos declarativos do modal: field.text/textarea/select/folder/folders/color(key, label, value, opts).
import { el } from '../core/dom.js';
import { store } from '../core/store.js';
import { DOT_COLORS } from '../themes/palette.js';
import { folderListControl } from './folder-list.js';

const make = (type) => (key, label, value, opts = {}) => ({ type, key, label, value: value ?? '', ...opts });

export const field = {
  text: make('text'),
  textarea: make('textarea'),
  folder: make('folder'),
  /** Lista de pastas: value = [{ name, path }]. */
  folders: (key, label, value, opts = {}) => ({ type: 'folders', key, label, value: value || [], ...opts }),
  /** opts.options: [{ value, label }] */
  select: make('select'),
  color: (key, label, value, opts = {}) => ({ type: 'color', key, label, value: value || DOT_COLORS[0], ...opts }),
  /** Controle próprio: opts.render(values, f) devolve o nó e grava em values[key]. */
  custom: (key, label, value, opts = {}) => ({ type: 'custom', key, label, value, ...opts }),
};

const bind = (f, values) => (e) => (values[f.key] = e.target.value);

function textInput(f, values) {
  return el('input', {
    type: 'text',
    class: f.mono ? 'input mono' : 'input',
    value: values[f.key],
    placeholder: f.placeholder || '',
    spellcheck: 'false',
    oninput: bind(f, values),
  });
}

const CONTROLS = {
  text: textInput,
  custom: (f, values) => f.render(values, f),
  folders: folderListControl,
  textarea(f, values) {
    const node = el('textarea', { class: 'input textarea', rows: f.rows || 4, placeholder: f.placeholder || '', oninput: bind(f, values) });
    node.value = values[f.key];
    return node;
  },
  select(f, values) {
    return el(
      'select',
      { class: 'input select', onchange: bind(f, values) },
      f.options.map((o) => el('option', { value: o.value, selected: o.value === values[f.key], text: o.label })),
    );
  },
  folder(f, values) {
    const input = textInput(f, values);
    const pick = async () => {
      const p = await api.pickFolder(values[f.key] || store.info.home);
      if (p) values[f.key] = input.value = p;
    };
    return el('div', { class: 'folder-row' }, input, el('button', { type: 'button', class: 'btn', onclick: pick, text: 'Escolher…' }));
  },
  color(f, values) {
    const row = el('div', { class: 'swatches' });
    const select = (c) => {
      values[f.key] = c;
      [...row.children].forEach((s) => s.classList.toggle('on', s.dataset.color === c));
    };
    DOT_COLORS.forEach((c) => row.append(el('button', { type: 'button', class: 'swatch', 'data-color': c, style: { background: c }, onclick: () => select(c) })));
    select(values[f.key]);
    return row;
  },
};

export const fieldNode = (f, values) =>
  el('div', { class: 'field' }, el('label', { text: f.label }), CONTROLS[f.type](f, values), f.hint ? el('div', { class: 'hint', text: f.hint }) : null);
