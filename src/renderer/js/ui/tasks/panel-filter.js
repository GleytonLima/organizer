// Topo da aba Tarefas: escopo (projeto em foco ou todos — no lugar do nome do projeto) e a busca.
// Minimalista: os filtros (Em espera, Com memória, Por memória…, tags) ficam atrás do funil na
// própria caixa de busca; fechado, só aparecem os filtros ATIVOS, como chips com × (ver tasks/filter.js).
import { el } from '../../core/dom.js';
import { allTasks, projectTasks } from '../../tasks/queries.js';
import {
  taskFilter, CHIPS, SCOPES, taskScope, setTaskScope, setTaskQuery, toggleTaskChip, toggleTaskTag, setMemoryFilter, toggleFilterPanel, activeFilterCount,
} from '../../tasks/filter.js';
import { tagsInUse, foldTag } from '../../tasks/tags.js';
import { pickMemories } from '../memory/picker.js';
import { icon } from '../icons.js';
import { showMenu } from '../menu.js';

const MAX_TAGS = 12;

const scopeMenu = (e) => showMenu(e, SCOPES.map((s) => ({ label: s.label, checked: s.id === taskScope(), action: () => setTaskScope(s.id) })));

/** Nome do projeto em foco (ou "Todos os projetos"), que abre o menu de escopo. */
export const scopeTitle = (project) =>
  el(
    'button',
    { class: 'tp-project tp-scope', title: 'Mostrar tarefas do projeto em foco ou de todos', onclick: scopeMenu },
    el('span', { text: taskScope() === 'all' ? 'Todos os projetos' : project.name }),
    icon('chevron'),
  );

async function pickFilterMemories(project) {
  const gids = await pickMemories({ project, title: 'Filtrar tarefas pelas memórias que referenciam', selected: taskFilter.memories.map((m) => m.gid), submit: 'Filtrar' });
  if (!gids) return;
  const items = gids.length ? await api.memory.many(gids) : [];
  setMemoryFilter(items.map((m) => ({ gid: m.gid, text: m.text })));
}

const memoryLabel = () => (taskFilter.memories.length === 1 ? taskFilter.memories[0].text : `${taskFilter.memories.length} memórias`);

/** Chip de um filtro ativo (rótulo + ×); `onOpen` (opcional) reabre a escolha ao clicar no rótulo. */
const activeChip = (label, onRemove, { onOpen = null, title = label, data = {} } = {}) =>
  el(
    'span',
    { class: 'chip on chip-active', title, ...data },
    el('button', { class: 'chip-text', onclick: onOpen || onRemove, text: label }),
    el('button', { class: 'chip-x', title: 'Tirar o filtro', onclick: onRemove }, icon('close')),
  );

function memoryChip(project) {
  if (!taskFilter.memories.length) return el('button', { class: 'chip', 'data-chip': 'by-memory', onclick: () => pickFilterMemories(project) }, icon('link'), 'Por memória…');
  return activeChip(`Memória: ${memoryLabel()}`, () => setMemoryFilter([]), { onOpen: () => pickFilterMemories(project), title: taskFilter.memories.map((m) => m.text).join('\n') });
}

function tagChips(project) {
  const scope = taskScope() === 'all' ? allTasks() : projectTasks(project);
  const tags = tagsInUse(scope).slice(0, MAX_TAGS);
  const active = taskFilter.tag;
  if (active && !tags.some((t) => foldTag(t) === foldTag(active))) tags.unshift(active);
  if (!tags.length) return null;
  const on = (t) => active && foldTag(t) === foldTag(active);
  return el('div', { class: 'mem-filters tp-tags' }, tags.map((t) => el('button', { class: `chip tag${on(t) ? ' on' : ''}`, 'data-tag': t, onclick: () => toggleTaskTag(t), text: `#${t}` })));
}

/** Painel aberto pelo funil: todas as opções. */
const options = (project) =>
  el(
    'div',
    { class: 'tp-filter-panel' },
    el(
      'div',
      { class: 'mem-filters' },
      CHIPS.map((c) => el('button', { class: `chip${taskFilter[c.key] ? ' on' : ''}`, 'data-chip': c.key, onclick: () => toggleTaskChip(c.key), text: c.label })),
      memoryChip(project),
    ),
    tagChips(project),
  );

/** Fechado: só os filtros em uso. */
function activeOnly(project) {
  const chips = [
    ...CHIPS.filter((c) => taskFilter[c.key]).map((c) => activeChip(c.label, () => toggleTaskChip(c.key), { data: { 'data-active': c.key } })),
    taskFilter.tag ? activeChip(`#${taskFilter.tag}`, () => toggleTaskTag(taskFilter.tag), { data: { 'data-active': 'tag' } }) : null,
    taskFilter.memories.length ? activeChip(`Memória: ${memoryLabel()}`, () => setMemoryFilter([]), { onOpen: () => pickFilterMemories(project), data: { 'data-active': 'memories' } }) : null,
  ].filter(Boolean);
  return chips.length ? el('div', { class: 'mem-filters' }, chips) : null;
}

function funnel() {
  const n = activeFilterCount();
  return el(
    'button',
    {
      type: 'button',
      class: `tp-funnel${taskFilter.open ? ' open' : ''}${n ? ' active' : ''}`,
      title: taskFilter.open ? 'Esconder filtros' : 'Filtros (em espera, memória, tags)',
      onclick: (e) => (e.preventDefault(), toggleFilterPanel()),
    },
    icon('filter'),
    n ? el('span', { class: 'tp-funnel-count', text: n }) : null,
  );
}

export const filterBar = (project) => [
  el(
    'label',
    { class: 'mem-search tp-search' },
    icon('search'),
    Object.assign(
      el('input', { type: 'text', 'data-draft': 'task-query', placeholder: 'Buscar tarefas…', title: 'Chave, título, descrição ou #tag', spellcheck: 'false', oninput: (e) => setTaskQuery(e.target.value) }),
      { value: taskFilter.query },
    ),
    funnel(),
  ),
  taskFilter.open ? options(project) : activeOnly(project),
];
