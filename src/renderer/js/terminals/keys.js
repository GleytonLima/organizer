// Atalhos globais e teclas especiais dentro do terminal.
import { store } from '../core/store.js';
import { newTerminal, closeTerminal, cycleTerminal, editTerminal } from '../actions/terminals.js';
import { copySelection, paste } from './clipboard.js';

const SHORTCUTS = [
  { match: (e, k) => e.ctrlKey && e.shiftKey && k === 't', run: () => newTerminal() },
  { match: (e, k) => e.ctrlKey && e.shiftKey && k === 'w', run: () => closeTerminal(store.state.activeId) },
  { match: (e, k) => e.ctrlKey && k === 'tab', run: (e) => cycleTerminal(e.shiftKey ? -1 : 1) },
  { match: (e) => e.key === 'F2', run: () => editTerminal(store.state.activeId) },
];

function handleShortcut(e) {
  const k = e.key.toLowerCase();
  const sc = SHORTCUTS.find((s) => s.match(e, k));
  if (!sc) return false;
  e.preventDefault();
  sc.run(e);
  return true;
}

/** Handler do xterm: retorna false quando a tecla foi consumida pelo app. */
export function terminalKeyHandler(e, session) {
  if (e.type !== 'keydown') return true;
  if (handleShortcut(e)) return false;
  const k = e.key.toLowerCase();
  const { term } = session;
  // Ctrl+Shift+C, ou Ctrl+C com seleção: copiar (sem seleção, Ctrl+C segue como SIGINT)
  if (e.ctrlKey && k === 'c' && (e.shiftKey || term.hasSelection())) {
    e.preventDefault();
    copySelection(term);
    return false;
  }
  if (e.ctrlKey && k === 'v') {
    e.preventDefault();
    paste(term);
    return false;
  }
  return true;
}

export function initKeys() {
  window.addEventListener('keydown', (e) => {
    if (document.body.classList.contains('modal-open')) return;
    if (e.target.closest?.('.xterm')) return; // já tratado pelo terminal
    handleShortcut(e);
  });
}
