// Aba "Memória" do painel lateral: busca, filtros por tipo (e "a revisar"), lista e estado do sync.
import { el } from '../../core/dom.js';
import { KINDS, CREATABLE } from '../../memory/kinds.js';
import { iconButton } from '../components.js';
import { icon } from '../icons.js';
import { showMenu } from '../menu.js';
import { memoryView, ensureFresh, setQuery, setKind } from './state.js';
import { newMemoryDialog } from './dialogs.js';
import { embeddingsDialog } from './embeddings-dialog.js';
import { syncDialog } from './sync-dialogs.js';
import { memoryItem } from './item.js';
import { syncLine } from '../../memory/sync.js';

// "review" não é um tipo: filtra as marcadas "a revisar".
const FILTERS = [
  { kind: null, label: 'Tudo' },
  ...['decision', 'note', 'idea', 'howto', 'progress'].map((k) => ({ kind: k, label: KINDS[k].plural })),
  { kind: 'review', label: 'A revisar' },
];

const newMenu = (e, project) => showMenu(e, CREATABLE.map((k) => ({ label: KINDS[k].newTitle, action: () => newMemoryDialog(project, k) })));

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

function emptyText() {
  if (memoryView.query) return 'Nada encontrado.';
  if (memoryView.kind === 'review') return 'Nada a revisar.';
  return 'Sem memórias ainda. Registre decisões (uma frase, com o porquê), notas, ideias e “como fazer”.';
}

/** Conteúdo da aba: { actions, body } (ver ui/sidepanel.js). */
export function memoryTab(project) {
  ensureFresh(project);
  const { result } = memoryView;
  const sync = syncLine();
  const footer = result.mode === 'híbrida' ? 'busca híbrida (texto + similaridade)' : result.mode === 'texto' ? 'busca por texto' : 'mais recentes';
  return {
    actions: [
      iconButton('decision', 'Nova decisão', () => newMemoryDialog(project, 'decision')),
      iconButton('plus', 'Nova nota, ideia ou “como fazer”', (e) => newMenu(e, project)),
      iconButton('cloud', 'Servidor de memória (sync com o time)', syncDialog),
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
        : el('div', { class: 'mem-empty', text: emptyText() }),
      el('div', { class: 'mem-mode', text: footer }),
      sync ? el('div', { class: `mem-mode${sync.error ? ' error' : ''}`, title: sync.text, text: sync.text }) : null,
    ],
  };
}
