// Conteúdo dos menus de contexto de terminal, workspace, comando e tema.
import { store, findTerm } from '../core/store.js';
import { restartSession } from '../terminals/sessions.js';
import { editTerminal, duplicateTerminal, closeTerminal, newTerminal } from '../actions/terminals.js';
import { editWorkspace, openWorkspace, closeWorkspace, deleteWorkspace } from '../actions/workspaces.js';
import { editCommand, moveCommand, removeCommand } from '../actions/commands.js';
import { THEMES } from '../themes/themes.js';
import { setTheme } from '../themes/apply.js';
import { showMenu } from './menu.js';

export function terminalMenu(e, id) {
  showMenu(e, [
    { label: 'Editar…', action: () => editTerminal(id) },
    { label: 'Duplicar', action: () => duplicateTerminal(id) },
    { label: 'Reiniciar', action: () => restartSession(id) },
    { label: 'Abrir pasta', action: () => api.openPath(findTerm(id).t.cwd) },
    { sep: true },
    { label: 'Fechar', danger: true, action: () => closeTerminal(id) },
  ]);
}

export function workspaceMenu(e, ws) {
  showMenu(e, [
    { label: 'Novo terminal', action: () => newTerminal(ws) },
    { label: 'Editar…', action: () => editWorkspace(ws) },
    ws.open ? { label: 'Fechar workspace', action: () => closeWorkspace(ws) } : { label: 'Abrir workspace', action: () => openWorkspace(ws) },
    { label: 'Abrir pasta', action: () => api.openPath(ws.cwd) },
    { sep: true },
    { label: 'Excluir', danger: true, action: () => deleteWorkspace(ws) },
  ]);
}

export function commandMenu(e, c) {
  showMenu(e, [
    { label: 'Editar…', action: () => editCommand(c) },
    { label: 'Mover para a esquerda', action: () => moveCommand(c, -1) },
    { label: 'Mover para a direita', action: () => moveCommand(c, 1) },
    { sep: true },
    { label: 'Remover', danger: true, action: () => removeCommand(c) },
  ]);
}

export function themeMenu(e) {
  showMenu(
    e,
    THEMES.map((t) => ({
      label: t.name,
      swatch: `linear-gradient(135deg, ${t.ui.surface} 50%, ${t.ui.accent} 50%)`,
      checked: t.id === store.state.theme,
      action: () => setTheme(t.id),
    })),
  );
}
