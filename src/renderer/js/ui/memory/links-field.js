// Campo "Vínculos" dos diálogos de memória: as memórias em que esta se apoia, com que se relaciona
// ou que contradiz — com busca e sugestões das mais parecidas com o texto que você está escrevendo.
// Valor: [{ id: gid, type, text }]; ao salvar, vira `refs` ([{ id, type }]).
import { el, mount } from '../../core/dom.js';
import { memoryContext } from '../../memory/context.js';
import { field } from '../modal.js';
import { iconButton } from '../components.js';
import { icon } from '../icons.js';

export const LINK_TYPES = [
  { value: 'depends', label: 'apoia-se em' },
  { value: 'related', label: 'relacionada a' },
  { value: 'contradicts', label: 'contradiz' },
];

const DEBOUNCE_MS = 200;

/** Vínculos atuais de uma memória com o texto de cada destino (para preencher o campo). */
export async function linksOf(item) {
  if (!item) return [];
  const { outgoing } = await api.memory.links(item.id);
  return outgoing.map((l) => ({ id: l.id, type: l.type, text: l.memory?.text || '(memória fora deste app)' }));
}

export const toRefs = (links) => (links || []).map(({ id, type }) => ({ id, type }));

/** `selfGid`: a memória em edição (não sugere ela mesma). */
export function linksField(project, links, { selfGid = null } = {}) {
  return field.custom('links', 'Vínculos', links, {
    hint: '“Apoia-se em”: se a outra mudar, esta entra na cadeia de impacto e pode ser marcada “a revisar”.',
    render: (values) => linksControl(project, values, selfGid),
  });
}

function linksControl(project, values, selfGid) {
  const list = el('div', { class: 'link-list' });
  const results = el('div', { class: 'link-results' });
  let timer = null;

  const row = (l) =>
    el(
      'div',
      { class: 'link-row' },
      el(
        'select',
        { class: 'input select link-type', onchange: (e) => (l.type = e.target.value) },
        LINK_TYPES.map((t) => el('option', { value: t.value, selected: t.value === l.type, text: t.label })),
      ),
      el('span', { class: 'link-text', title: l.text, text: l.text }),
      iconButton('close', 'Remover vínculo', () => {
        values.links = values.links.filter((x) => x !== l);
        draw();
      }),
    );

  function draw() {
    mount(list, values.links.length ? values.links.map(row) : el('div', { class: 'link-empty', text: 'Sem vínculos.' }));
  }

  async function suggest(query) {
    const q = query.trim() || String(values.text || '').trim();
    if (!q) return mount(results);
    const { items } = await api.memory.search(q, { context: memoryContext(project), limit: 8 });
    const taken = new Set([selfGid, ...values.links.map((l) => l.id)]);
    const add = (m) => {
      values.links = [...values.links, { id: m.gid, type: 'depends', text: m.text }];
      draw();
      mount(results);
    };
    mount(
      results,
      items
        .filter((m) => !taken.has(m.gid))
        .slice(0, 5)
        .map((m) => el('button', { type: 'button', class: 'link-suggestion', title: m.text, onclick: () => add(m) }, icon('plus'), el('span', { text: m.text }))),
    );
  }

  const input = el('input', {
    type: 'text',
    class: 'input',
    placeholder: 'Vincular a… (vazio: parecidas com o texto)',
    spellcheck: 'false',
    onfocus: (e) => suggest(e.target.value),
    onkeydown: (e) => e.key === 'Enter' && e.preventDefault(), // Enter aqui não salva o diálogo
    oninput: (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => suggest(e.target.value), DEBOUNCE_MS);
    },
  });
  values.links = values.links || [];
  draw();
  return el('div', { class: 'links-field' }, list, input, results);
}
