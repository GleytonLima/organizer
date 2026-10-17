// Diálogo modal genérico. Resolve com:
//   - os valores dos campos (ou true, se não houver campos) ao confirmar;
//   - `extra.value` ao clicar na ação secundária (ex.: "Excluir");
//   - null ao cancelar.
// `content`: nós extras abaixo dos campos (ex.: histórico). `collect()`: valores próprios do conteúdo.
import { $, el, mount } from '../core/dom.js';
import { focusActive } from '../terminals/sessions.js';
import { fieldNode } from './modal-fields.js';

export { field } from './modal-fields.js';

export function openModal({ title, message, fields = [], content = null, collect = null, submit = 'OK', danger = false, extra = null, wide = false }) {
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

    form.classList.toggle('wide', wide);
    mount(
      form,
      el('h2', { text: title }),
      message ? el('p', { class: 'modal-message', text: message }) : null,
      fields.map((f) => fieldNode(f, values)),
      content,
      el(
        'div',
        { class: 'modal-actions' },
        extra ? el('button', { type: 'button', class: `btn ghost${extra.danger ? ' danger-text' : ''}`, onclick: () => done(extra.value), text: extra.label }) : null,
        el('span', { class: 'spacer' }),
        el('button', { type: 'button', class: 'btn ghost', onclick: () => done(null), text: 'Cancelar' }),
        el('button', { type: 'submit', class: `btn ${danger ? 'danger' : 'primary'}`, text: submit }),
      ),
    );
    form.onsubmit = (e) => {
      e.preventDefault();
      const own = collect ? collect() : null;
      done(fields.length || own ? { ...values, ...own } : true);
    };
    backdrop.onmousedown = (e) => e.target === backdrop && done(null);
    document.addEventListener('keydown', onKey, true);
    document.body.classList.add('modal-open');
    backdrop.classList.remove('hidden');
    requestAnimationFrame(() => (form.querySelector('input, textarea') || form.querySelector('[type=submit]'))?.focus());
  });
}
