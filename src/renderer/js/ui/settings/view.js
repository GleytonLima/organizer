// Configurações (tela cheia, na área do quadro, como o Insights): um lugar só para o que antes ficava
// espalhado em diálogos — aparência, servidor do time, memória e agentes.
import { el, remount } from '../../core/dom.js';
import { store, commit, notify } from '../../core/store.js';
import { THEMES } from '../../themes/themes.js';
import { setTheme } from '../../themes/apply.js';
import { setTaskView } from '../../actions/tasks.js';
import { iconButton } from '../components.js';
import { icon } from '../icons.js';
import { serverSection, refreshServer } from './server.js';
import { embeddingsDialog } from '../memory/embeddings-dialog.js';
import { agentsDialog } from '../agent/profiles-dialog.js';
import { openWelcome } from '../../actions/setup.js';

const SECTIONS = [
  { id: 'general', label: 'Geral', icon: 'theme' },
  { id: 'server', label: 'Servidor do time', icon: 'cloud' },
  { id: 'memory', label: 'Memória e busca', icon: 'memory' },
  { id: 'agents', label: 'Agentes', icon: 'agent' },
];
let section = 'general';

const isOn = () => store.state.taskView === 'settings';

/** Abre as Configurações (opcionalmente numa seção: 'server', 'memory'…). */
export function openSettings(id = section) {
  section = id;
  if (id === 'server') refreshServer();
  setTaskView('settings');
}

export const settingsButton = () =>
  iconButton('settings', 'Configurações', () => (isOn() ? setTaskView('off') : openSettings()), `tasks-btn${isOn() ? ' on' : ''}`);

const row = (title, hint, control) =>
  el('div', { class: 'set-row' }, el('div', { class: 'set-row-text' }, el('div', { class: 'set-row-title', text: title }), hint ? el('div', { class: 'set-hint', text: hint }) : null), control);

function generalSection() {
  return [
    el('h3', { class: 'set-title', text: 'Geral' }),
    row('Primeiros passos', 'Git Bash, Claude Code, a integração entre os dois e um projeto a partir de uma pasta.', el('button', { type: 'button', class: 'btn', onclick: openWelcome, text: 'Abrir' })),
    row(
      'Tema',
      'Cores do app e dos terminais.',
      el('select', { class: 'input select', onchange: (e) => setTheme(e.target.value) }, THEMES.map((t) => el('option', { value: t.id, selected: t.id === store.state.theme, text: t.name }))),
    ),
    row(
      'Disposição',
      'Onde fica a lista de terminais.',
      el(
        'select',
        { class: 'input select', onchange: (e) => ((store.state.layout = e.target.value), commit()) },
        [['left', 'Painel à esquerda'], ['right', 'Painel à direita'], ['tabs', 'Abas']].map(([v, l]) => el('option', { value: v, selected: v === store.state.layout, text: l })),
      ),
    ),
  ];
}

const linkSection = (title, text, button, action) => [
  el('h3', { class: 'set-title', text: title }),
  el('p', { class: 'set-hint', text }),
  el('button', { type: 'button', class: 'btn', onclick: action, text: button }),
];

function body() {
  if (section === 'server') return serverSection();
  if (section === 'memory') return linkSection('Memória e busca', 'A memória fica nesta máquina (memory.db). A busca por similaridade é opcional: use um Ollama local ou uma API compatível com OpenAI.', 'Configurar busca por similaridade…', embeddingsDialog);
  if (section === 'agents') return linkSection('Agentes', 'Perfis de agente (ACP): comando, variáveis, modo padrão e servidores MCP extras.', 'Editar perfis de agente…', agentsDialog);
  return generalSection();
}

// remount: os campos (data-draft) mantêm foco e cursor quando a tela re-renderiza
export function renderSettings(node) {
  remount(
    node,
    el('header', { class: 'kb-header' }, el('h2', { class: 'kb-title', text: 'Configurações' }), el('span', { class: 'spacer' }), iconButton('close', 'Fechar', () => setTaskView('off'))),
    el(
      'div',
      { class: 'set-layout' },
      el(
        'nav',
        { class: 'set-nav' },
        SECTIONS.map((s) =>
          el('button', { type: 'button', class: `set-nav-item${s.id === section ? ' on' : ''}`, onclick: () => ((section = s.id), s.id === 'server' && refreshServer(), notify()) }, icon(s.icon), el('span', { text: s.label })),
        ),
      ),
      el('section', { class: 'set-body' }, body()),
    ),
  );
}
