// Seletor de memórias: busca, filtro por tipo e seleção múltipla, com as já escolhidas no topo.
// Usado para vincular memórias a uma tarefa e para os vínculos entre memórias.
//   pickMemories({ project, title, selected, exclude, suggest }) → [gid] (a seleção final) | null
import { el, mount } from '../../core/dom.js';
import { timeAgo } from '../../core/format.js';
import { memoryContext, scopeLabel } from '../../memory/context.js';
import { KINDS, kindOf } from '../../memory/kinds.js';
import { icon } from '../icons.js';

const KIND_FILTERS = [{ kind: null, label: 'Tudo' }, ...['decision', 'note', 'idea', 'howto'].map((k) => ({ kind: k, label: KINDS[k].plural }))];
const DEBOUNCE_MS = 200;

function row(project, m, picked, onToggle) {
  const where = scopeLabel(project, m);
  return el(
    'label',
    { class: `pick-row${picked ? ' on' : ''}` },
    el('input', { type: 'checkbox', checked: picked, onchange: () => onToggle(m) }),
    icon(kindOf(m.kind).icon, 'pick-icon'),
    el(
      'span',
      { class: 'pick-text' },
      el('span', { class: 'pick-body', text: m.text }),
      el('span', { class: 'pick-meta', text: [kindOf(m.kind).label, where, timeAgo(m.updatedAt)].filter(Boolean).join(' · ') }),
    ),
  );
}

/**
 * `selected`: gids já escolhidos; `exclude`: gids que não podem aparecer (ex.: a própria memória);
 * `suggest`: texto usado para ordenar por semelhança quando a busca está vazia (ex.: título da tarefa).
 */
export async function pickMemories({ project, title = 'Vincular memórias', selected = [], exclude = [], suggest = '' }) {
  const picked = new Map((await api.memory.many(selected)).map((m) => [m.gid, m])); // gid → memória
  const view = { query: '', kind: null, items: [] };
  const list = el('div', { class: 'pick-list' });
  const chips = el('div', { class: 'mem-filters' });
  const status = el('div', { class: 'pick-status' });
  let timer = null;
  let seq = 0;

  const toggle = (m) => {
    if (picked.has(m.gid)) picked.delete(m.gid);
    else picked.set(m.gid, m);
    draw();
  };

  function draw() {
    mount(chips, KIND_FILTERS.map((f) => el('button', { type: 'button', class: `chip${view.kind === f.kind ? ' on' : ''}`, onclick: () => setKind(f.kind), text: f.label })));
    const chosen = [...picked.values()].filter((m) => !view.kind || m.kind === view.kind);
    const rest = view.items.filter((m) => !picked.has(m.gid));
    mount(
      list,
      chosen.length ? el('div', { class: 'pick-heading', text: 'Selecionadas' }) : null,
      chosen.map((m) => row(project, m, true, toggle)),
      el('div', { class: 'pick-heading', text: view.query ? 'Resultados' : suggest ? 'Parecidas com a tarefa' : 'Mais recentes' }),
      rest.length ? rest.map((m) => row(project, m, false, toggle)) : el('div', { class: 'link-empty', text: 'Nada encontrado.' }),
    );
    status.textContent = picked.size ? `${picked.size === 1 ? '1 selecionada' : `${picked.size} selecionadas`}` : 'Nenhuma selecionada';
  }

  async function load() {
    const mine = ++seq;
    const { items } = await api.memory.search(view.query || suggest, { context: memoryContext(project), kind: view.kind || undefined, limit: 40 });
    if (mine !== seq) return;
    const skip = new Set(exclude);
    view.items = items.filter((m) => m.kind !== 'progress' && !skip.has(m.gid));
    draw();
  }

  function setKind(kind) {
    view.kind = kind;
    load();
  }

  const search = el('label', { class: 'mem-search' }, icon('search'), el('input', {
    type: 'text',
    placeholder: 'Buscar memórias…',
    spellcheck: 'false',
    onkeydown: (e) => e.key === 'Enter' && e.preventDefault(),
    oninput: (e) => {
      view.query = e.target.value;
      clearTimeout(timer);
      timer = setTimeout(load, DEBOUNCE_MS);
    },
  }));

  draw();
  load();
  const ok = await overlay(title, el('div', { class: 'picker' }, search, chips, list, status));
  return ok ? [...picked.keys()] : null;
}

/**
 * Camada própria por cima de tudo (inclusive de um diálogo aberto: o seletor é usado dentro do
 * diálogo de memória). Esc e clique fora cancelam; resolve true ao salvar.
 */
function overlay(title, content) {
  return new Promise((resolve) => {
    const close = (result) => {
      window.removeEventListener('keydown', onKey, true);
      backdrop.remove();
      resolve(result);
    };
    // na fase de captura da window: roda antes do Esc do diálogo de baixo (que escuta no document)
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      close(false);
    };
    const card = el(
      'form',
      { class: 'picker-card', onsubmit: (e) => (e.preventDefault(), close(true)) },
      el('h2', { text: title }),
      content,
      el(
        'div',
        { class: 'modal-actions' },
        el('span', { class: 'spacer' }),
        el('button', { type: 'button', class: 'btn ghost', onclick: () => close(false), text: 'Cancelar' }),
        el('button', { type: 'submit', class: 'btn primary', text: 'Salvar vínculos' }),
      ),
    );
    const backdrop = el('div', { class: 'picker-backdrop', onmousedown: (e) => e.target === backdrop && close(false) }, card);
    document.body.append(backdrop);
    window.addEventListener('keydown', onKey, true);
    card.querySelector('input')?.focus();
  });
}
