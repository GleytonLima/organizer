// Topo da aba Tarefas: escopo (projeto em foco ou todos — no lugar do nome do projeto), busca por
// texto e chips de filtro (ver tasks/filter.js). Reusa a busca e os chips da aba Memória.
import { el } from '../../core/dom.js';
import { taskFilter, CHIPS, SCOPES, taskScope, setTaskScope, setTaskQuery, toggleTaskChip } from '../../tasks/filter.js';
import { icon } from '../icons.js';
import { showMenu } from '../menu.js';

const scopeMenu = (e) => showMenu(e, SCOPES.map((s) => ({ label: s.label, checked: s.id === taskScope(), action: () => setTaskScope(s.id) })));

/** Nome do projeto em foco (ou "Todos os projetos"), que abre o menu de escopo. */
export const scopeTitle = (project) =>
  el(
    'button',
    { class: 'tp-project tp-scope', title: 'Mostrar tarefas do projeto em foco ou de todos', onclick: scopeMenu },
    el('span', { text: taskScope() === 'all' ? 'Todos os projetos' : project.name }),
    icon('chevron'),
  );

export const filterBar = () => [
  el(
    'label',
    { class: 'mem-search' },
    icon('search'),
    Object.assign(
      el('input', { type: 'text', 'data-draft': 'task-query', placeholder: 'Buscar tarefas (chave, título, descrição)…', spellcheck: 'false', oninput: (e) => setTaskQuery(e.target.value) }),
      { value: taskFilter.query },
    ),
  ),
  el('div', { class: 'mem-filters' }, CHIPS.map((c) => el('button', { class: `chip${taskFilter[c.key] ? ' on' : ''}`, 'data-chip': c.key, onclick: () => toggleTaskChip(c.key), text: c.label }))),
];
