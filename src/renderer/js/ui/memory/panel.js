// Aba "Memória" do painel lateral: busca, filtro (tudo/decisões/notas) e lista.
import { el } from '../../core/dom.js';
import { timeAgo } from '../../core/format.js';
import { scopeLabel } from '../../memory/context.js';
import { iconButton } from '../components.js';
import { icon } from '../icons.js';
import { showMenu } from '../menu.js';
import { memoryView, ensureFresh, setQuery, setKind } from './state.js';
import { newMemoryDialog, editMemoryDialog, deleteMemory, embeddingsDialog } from './dialogs.js';

const FILTERS = [
  { kind: null, label: 'Tudo' },
  { kind: 'decision', label: 'Decisões' },
  { kind: 'note', label: 'Notas' },
];

function itemMenu(e, project, m) {
  showMenu(e, [
    { label: 'Editar…', action: () => editMemoryDialog(project, m) },
    m.kind === 'decision' ? { label: 'Substituir por nova decisão…', action: () => newMemoryDialog(project, 'decision', { supersedes: m }) } : null,
    { label: 'Copiar texto', action: () => api.clipboardWrite(m.text) },
    { sep: true },
    { label: 'Excluir', danger: true, action: () => deleteMemory(m) },
  ]);
}

function memoryItem(project, m) {
  const where = scopeLabel(project, m); // "global" / "pasta backend"; projeto = sem rótulo
  const meta = [m.scope === 'project' ? m.repo : null, m.taskKey, m.source, timeAgo(m.updatedAt)].filter(Boolean).join(' · ');
  return el(
    'article',
    { class: `mem-item ${m.kind}`, ondblclick: () => editMemoryDialog(project, m), oncontextmenu: (e) => itemMenu(e, project, m) },
    icon(m.kind === 'decision' ? 'decision' : 'note', 'mem-icon'),
    el(
      'div',
      { class: 'mem-text' },
      el('div', { class: 'mem-body', text: m.text }),
      el('div', { class: 'mem-meta' }, where ? el('span', { class: `mem-scope ${m.scope}`, text: where }) : null, meta),
      m.tags.length ? el('div', { class: 'mem-tags' }, m.tags.map((t) => el('span', { class: 'mem-tag', text: t }))) : null,
    ),
    iconButton('more', 'Opções', (e) => itemMenu(e, project, m), 'reveal'),
  );
}

const searchBox = () =>
  el(
    'label',
    { class: 'mem-search' },
    icon('search'),
    Object.assign(
      el('input', { type: 'text', 'data-draft': 'memory-query', placeholder: 'Buscar na memória…', spellcheck: 'false', oninput: (e) => setQuery(e.target.value) }),
      { value: memoryView.query },
    ),
  );

/** Conteúdo da aba: { actions, body } (ver ui/sidepanel.js). */
export function memoryTab(project) {
  ensureFresh(project);
  const { result } = memoryView;
  const footer = result.mode === 'híbrida' ? 'busca híbrida (texto + similaridade)' : result.mode === 'texto' ? 'busca por texto' : 'mais recentes';
  return {
    actions: [
      iconButton('decision', 'Nova decisão', () => newMemoryDialog(project, 'decision')),
      iconButton('plus', 'Nova nota', () => newMemoryDialog(project, 'note')),
      iconButton('settings', 'Busca por similaridade (embeddings)', embeddingsDialog),
    ],
    body: [
      searchBox(),
      el(
        'div',
        { class: 'mem-filters' },
        FILTERS.map((f) => el('button', { class: `chip${memoryView.kind === f.kind ? ' on' : ''}`, onclick: () => setKind(f.kind), text: f.label })),
      ),
      result.warning ? el('div', { class: 'mem-warning', text: result.warning }) : null,
      result.items.length
        ? el('div', { class: 'mem-list' }, result.items.map((m) => memoryItem(project, m)))
        : el('div', { class: 'mem-empty', text: memoryView.query ? 'Nada encontrado.' : 'Sem memórias ainda. Registre decisões (uma frase, com o porquê) e notas.' }),
      el('div', { class: 'mem-mode', text: footer }),
    ],
  };
}
