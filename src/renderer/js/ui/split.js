// Elementos da visão lado a lado: cabeçalho de cada painel e indicador na barra superior.
import { el, mount } from '../core/dom.js';
import { findTerm, splitSource } from '../core/store.js';
import { termLabel } from '../core/format.js';
import { getSession } from '../terminals/sessions.js';
import { activate, closeTerminal } from '../actions/terminals.js';
import { exitSplit } from '../actions/split.js';
import { iconButton, tintedIcon, processBadge } from './components.js';
import { terminalMenu } from './context-menus.js';
import { icon } from './icons.js';

function focusOnly(id) {
  exitSplit();
  activate(id);
}

function paneHead({ project, t }) {
  return [
    tintedIcon('terminal', t.color || project.color, 'term-icon'),
    el('span', { class: 'pane-name', text: termLabel(t) }),
    processBadge(t.id),
    el('span', { class: 'spacer' }),
    iconButton('maximize', 'Ver só este', () => focusOnly(t.id), 'reveal'),
    iconButton('close', 'Fechar terminal', () => closeTerminal(t.id), 'reveal'),
  ];
}

/** Preenche o cabeçalho dos painéis visíveis (só faz diferença com 2+). */
export function renderPaneHeads(ids) {
  if (ids.length < 2) return;
  for (const id of ids) {
    const entry = findTerm(id);
    const s = getSession(id);
    if (!entry || !s) continue;
    mount(s.head, paneHead(entry));
    s.head.oncontextmenu = (e) => terminalMenu(e, id);
    s.head.ondblclick = () => focusOnly(id);
  }
}

/** Indicador "Lado a lado · <grupo>" com botão para sair. */
export function splitIndicator() {
  const src = splitSource();
  if (!src || src.terminals.length < 2) return null;
  return el(
    'div',
    { class: 'split-indicator' },
    icon('split'),
    el('span', { text: `Lado a lado · ${src.label}` }),
    iconButton('close', 'Sair do lado a lado', exitSplit),
  );
}
