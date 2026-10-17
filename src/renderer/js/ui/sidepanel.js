// Painel lateral com abas: Tarefas | Memória. Cada aba fornece { title?, actions, body }: as abas e o
// fechar na 1ª linha; título (projeto/escopo) e ações na 2ª.
import { $, el, remount } from '../core/dom.js';
import { store, commit, currentProject } from '../core/store.js';
import { setTaskView } from '../actions/tasks.js';
import { iconButton } from './components.js';
import { taskTab } from './tasks/panel.js';
import { memoryTab } from './memory/panel.js';

const TABS = [
  { id: 'tasks', label: 'Tarefas', build: taskTab },
  { id: 'memory', label: 'Memória', build: memoryTab },
];

/** Abre o painel na aba pedida; se ela já estiver aberta, fecha o painel. */
export function toggleSideTab(tab) {
  const isOpen = store.state.taskView === 'panel' && store.state.sideTab === tab;
  store.state.sideTab = tab;
  setTaskView(isOpen ? 'off' : 'panel');
}

function selectTab(tab) {
  store.state.sideTab = tab;
  commit();
}

export function renderSidePanel() {
  const panel = $('#taskpanel');
  const show = store.state.taskView === 'panel';
  panel.classList.toggle('hidden', !show);
  if (!show) return;
  const project = currentProject();
  const tab = TABS.find((t) => t.id === store.state.sideTab) || TABS[0];
  const { title, actions, body } = tab.build(project);
  remount(
    panel,
    el(
      'header',
      { class: 'tp-header' },
      el(
        'div',
        { class: 'tp-tabs', role: 'tablist' },
        TABS.map((t) => el('button', { class: `tp-tab${t === tab ? ' on' : ''}`, role: 'tab', onclick: () => selectTab(t.id), text: t.label })),
      ),
      el('span', { class: 'spacer' }),
      iconButton('close', 'Fechar painel', () => setTaskView('off')),
    ),
    // 2ª linha: projeto/escopo à esquerda e as ações da aba à direita (na 1ª, o painel estreito as cortava)
    el('div', { class: 'tp-toolbar' }, title || el('div', { class: 'tp-project', text: project.name }), el('span', { class: 'spacer' }), actions),
    el('div', { class: 'tp-body' }, body),
  );
}
