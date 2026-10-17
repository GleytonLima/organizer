// Diálogo modal genérico com campos declarativos. Resolve com os valores, true (sem campos) ou null.
import { $, el, mount } from '../core/dom.js';
import { store } from '../core/store.js';
import { DOT_COLORS } from '../themes/palette.js';
import { focusActive } from '../terminals/sessions.js';

export const field = {
  text: (key, label, value, opts = {}) => ({ type: 'text', key, label, value: value ?? '', ...opts }),
  folder: (key, label, value, opts = {}) => ({ type: 'folder', key, label, value: value ?? '', ...opts }),
  color: (key, label, value, opts = {}) => ({ type: 'color', key, label, value: value || DOT_COLORS[0], ...opts }),
};

function textInput(f, values) {
  return el('input', {
    type: 'text',
    class: f.mono ? 'input mono' : 'input',
    value: values[f.key],
    placeholder: f.placeholder || '',
    spellcheck: 'false',
    oninput: (e) => (values[f.key] = e.target.value),
  });
}

const CONTROLS = {
  text: textInput,
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

const fieldNode = (f, values) =>
  el('div', { class: 'field' }, el('label', { text: f.label }), CONTROLS[f.type](f, values), f.hint ? el('div', { class: 'hint', text: f.hint }) : null);

export function openModal({ title, message, fields = [], submit = 'OK', danger = false }) {
  return new Promise((resolve) => {
    const backdrop = $('#modal-backdrop');
    const form = $('#modal');
    const values = Object.fromEntries(fields.map((f) => [f.key, f.value]));

    const onKey = (e) => e.key === 'Escape' && (e.preventDefault(), done(null));
    function done(result) {
      backdrop.classList.add('hidden');
      document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', onKey, true);
      form.onsubmit = backdrop.onmousedown = null;
      resolve(result);
      requestAnimationFrame(focusActive);
    }

    mount(
      form,
      el('h2', { text: title }),
      message ? el('p', { class: 'modal-message', text: message }) : null,
      fields.map((f) => fieldNode(f, values)),
      el(
        'div',
        { class: 'modal-actions' },
        el('button', { type: 'button', class: 'btn ghost', onclick: () => done(null), text: 'Cancelar' }),
        el('button', { type: 'submit', class: `btn ${danger ? 'danger' : 'primary'}`, text: submit }),
      ),
    );
    form.onsubmit = (e) => {
      e.preventDefault();
      done(fields.length ? values : true);
    };
    backdrop.onmousedown = (e) => e.target === backdrop && done(null);
    document.addEventListener('keydown', onKey, true);
    document.body.classList.add('modal-open');
    backdrop.classList.remove('hidden');
    requestAnimationFrame(() => (form.querySelector('input') || form.querySelector('[type=submit]'))?.focus());
  });
}
