// Topo da aba Tarefas: escopo (projeto em foco ou todos — no lugar do nome do projeto), busca por
// texto, chips de filtro, "Por memória…" e as tags em uso (ver tasks/filter.js). Reusa a busca e os
// chips da aba Memória e o seletor de memórias.
import { el } from '../../core/dom.js';
import { allTasks, projectTasks } from '../../tasks/queries.js';
import { taskFilter, CHIPS, SCOPES, taskScope, setTaskScope, setTaskQuery, toggleTaskChip, toggleTaskTag, setMemoryFilter } from '../../tasks/filter.js';
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

function memoryChip(project) {
  const chosen = taskFilter.memories;
  if (!chosen.length) return el('button', { class: 'chip', 'data-chip': 'by-memory', onclick: () => pickFilterMemories(project) }, icon('link'), 'Por memória…');
  const label = chosen.length === 1 ? chosen[0].text : `${chosen.length} memórias`;
  return el(
    'span',
    { class: 'chip on chip-memory', title: chosen.map((m) => m.text).join('\n') },
    el('button', { class: 'chip-text', onclick: () => pickFilterMemories(project), text: `Memória: ${label}` }),
    el('button', { class: 'chip-x', title: 'Tirar o filtro', onclick: () => setMemoryFilter([]) }, icon('close')),
  );
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

export const filterBar = (project) => [
  el(
    'label',
    { class: 'mem-search' },
    icon('search'),
    Object.assign(
      el('input', { type: 'text', 'data-draft': 'task-query', placeholder: 'Buscar tarefas (chave, título, #tag)…', spellcheck: 'false', oninput: (e) => setTaskQuery(e.target.value) }),
      { value: taskFilter.query },
    ),
  ),
  el(
    'div',
    { class: 'mem-filters' },
    CHIPS.map((c) => el('button', { class: `chip${taskFilter[c.key] ? ' on' : ''}`, 'data-chip': c.key, onclick: () => toggleTaskChip(c.key), text: c.label })),
    memoryChip(project),
  ),
  tagChips(project),
];
