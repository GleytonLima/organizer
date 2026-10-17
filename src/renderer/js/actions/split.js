// Visão lado a lado: mostra todos os terminais de um grupo ou projeto ao mesmo tempo.
import { store, commit, findGroup, projectTerminals, visibleTerminalIds } from '../core/store.js';
import { fitVisible } from '../terminals/sessions.js';
import { activate, ensureProjectOpen } from './terminals.js';

const refit = () => requestAnimationFrame(fitVisible);

function showSplit(kind, id, project, terminals) {
  if (!terminals.length) return;
  ensureProjectOpen(project);
  store.state.split = terminals.length > 1 ? { kind, id } : null;
  const keepActive = terminals.some((t) => t.id === store.state.activeId);
  activate(keepActive ? store.state.activeId : terminals[0].id);
  refit();
}

export function splitGroup(group) {
  showSplit('group', group.id, findGroup(group.id).project, group.terminals);
}

export function splitProject(project) {
  showSplit('project', project.id, project, projectTerminals(project));
}

export function exitSplit() {
  if (!store.state.split) return;
  store.state.split = null;
  commit();
  refit();
}

/** Ao ativar um terminal fora da divisão, a divisão é desfeita. */
export function leaveSplitIfOutside(id) {
  if (store.state.split && !visibleTerminalIds().includes(id)) store.state.split = null;
}

export const isSplit = (kind, id) => store.state.split?.kind === kind && store.state.split?.id === id;
