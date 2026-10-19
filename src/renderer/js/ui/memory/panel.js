// Aba "Memória" do painel lateral: duas visões — deste projeto (contextual) e global —, busca, filtros por
// tipo (e "a revisar"), lista e estado do sync.
import { el } from '../../core/dom.js';
import { KINDS, CREATABLE } from '../../memory/kinds.js';
import { iconButton } from '../components.js';
import { icon } from '../icons.js';
import { showMenu } from '../menu.js';
import { memoryView, ensureFresh, setQuery, setKind, memoryScope, setMemoryScope } from './state.js';
import { newMemoryDialog } from './dialogs.js';
import { embeddingsDialog } from './embeddings-dialog.js';
import { openSettings } from '../settings/view.js';
import { memoryItem } from './item.js';
import { syncLine } from '../../memory/sync.js';

// "review" não é um tipo: filtra as marcadas "a revisar".
const FILTERS = [
  { kind: null, label: 'Tudo' },
  ...['decision', 'note', 'idea', 'howto', 'progress'].map((k) => ({ kind: k, label: KINDS[k].plural })),
  { kind: 'review', label: 'A revisar' },
];

// memória nova nasce na visão aberta: deste projeto ou global
const newIn = (project, kind) => newMemoryDialog(project, kind, { where: memoryScope() });
const newMenu = (e, project) => showMenu(e, CREATABLE.map((k) => ({ label: KINDS[k].newTitle, action: () => newIn(project, k) })));

/** Seletor das duas visões, com a explicação curta de cada uma. */
function scopeSwitch(project) {
  const on = memoryScope();
  const tab = (id, label) => el('button', { type: 'button', class: `mem-seg-btn${on === id ? ' on' : ''}`, onclick: () => setMemoryScope(id), text: label });
  return el(
    'div',
    { class: 'mem-scope-switch' },
    el('div', { class: 'mem-seg' }, tab('project', 'Deste projeto'), tab('global', 'Global')),
    el('div', { class: 'mem-seg-hint', text: on === 'global' ? 'Vale em todos os projetos: convenções e preferências do time.' : `O que vale em “${project.name}” e nas pastas dele.` }),
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

function emptyText() {
  const global = memoryScope() === 'global';
  if (memoryView.query) return global ? 'Nada encontrado nas globais.' : 'Nada encontrado neste projeto.';
  if (memoryView.kind === 'review') return 'Nada a revisar.';
  if (global) return 'Nenhuma memória global ainda. Use para o que vale em todos os projetos.';
  return 'Sem memórias neste projeto ainda. Registre decisões (uma frase, com o porquê), notas, ideias e “como fazer”.';
}

/** Vazio: com busca, oferece procurar na outra visão. */
function empty() {
  const other = memoryScope() === 'global' ? ['project', 'Procurar neste projeto'] : ['global', 'Procurar nas globais'];
  return el('div', { class: 'mem-empty' }, el('div', { text: emptyText() }),
    memoryView.query ? el('button', { type: 'button', class: 'btn small', onclick: () => setMemoryScope(other[0]), text: other[1] }) : null);
}

/** Conteúdo da aba: { actions, body } (ver ui/sidepanel.js). */
export function memoryTab(project) {
  ensureFresh(project);
  const { result } = memoryView;
  const sync = syncLine();
  const footer = result.mode === 'híbrida' ? 'busca híbrida (texto + similaridade)' : result.mode === 'texto' ? 'busca por texto' : 'mais recentes';
  return {
    actions: [
      iconButton('decision', 'Nova decisão', () => newIn(project, 'decision')),
      iconButton('plus', 'Nova nota, ideia ou “como fazer”', (e) => newMenu(e, project)),
      iconButton('cloud', 'Servidor do time (Configurações)', () => openSettings('server')),
      iconButton('settings', 'Busca por similaridade (embeddings)', embeddingsDialog),
    ],
    body: [
      scopeSwitch(project),
      searchBox(),
      el(
        'div',
        { class: 'mem-filters' },
        FILTERS.map((f) => el('button', { class: `chip${memoryView.kind === f.kind ? ' on' : ''}`, onclick: () => setKind(f.kind), text: f.label })),
      ),
      result.warning ? el('div', { class: 'mem-warning', text: result.warning }) : null,
      result.items.length
        ? el('div', { class: 'mem-list' }, result.items.map((m) => memoryItem(project, m)))
        : empty(),
      el('div', { class: 'mem-mode', text: footer }),
      sync ? el('div', { class: `mem-mode${sync.error ? ' error' : ''}`, title: sync.text, text: sync.text }) : null,
    ],
  };
}
