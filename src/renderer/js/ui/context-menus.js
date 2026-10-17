// Conteúdo dos menus de contexto de terminal, grupo, projeto, comando e tema.
import { store, findTerm, projectTerminals } from '../core/store.js';
import { splitGroup, splitProject, exitSplit, isSplit } from '../actions/split.js';
import { restartSession } from '../terminals/sessions.js';
import { editTerminal, duplicateTerminal, closeTerminal, newTerminal, newAgentTerminal, moveTerminal } from '../actions/terminals.js';
import { agentProfiles } from '../agents/profiles.js';
import { agentsDialog } from './agent/profiles-dialog.js';

/** "Nova sessão: <agente>" para cada perfil ACP, e o editor de perfis. */
const agentItems = (group) => [
  ...agentProfiles().map((p) => ({ label: `Nova sessão: ${p.label} (ACP)`, action: () => newAgentTerminal(group, p.id) })),
  { label: 'Agentes (ACP)…', muted: true, action: agentsDialog },
];
import { createGroup, renameGroup, deleteGroup } from '../actions/groups.js';
import { editProject, openProject, closeProject, deleteProject } from '../actions/projects.js';
import { editCommand, moveCommand, removeCommand } from '../actions/commands.js';
import { THEMES } from '../themes/themes.js';
import { setTheme } from '../themes/apply.js';
import { showMenu } from './menu.js';

const SEP = { sep: true };

/** "Ver lado a lado" / "Sair do lado a lado" — só quando há 2+ terminais. */
function splitItem(kind, target, count, show) {
  if (count < 2) return null;
  return isSplit(kind, target.id)
    ? { label: 'Sair do lado a lado', action: exitSplit }
    : { label: 'Ver lado a lado', action: () => show(target) };
}

export function terminalMenu(e, id) {
  const { project, group, t } = findTerm(id);
  const moveTo = project.groups
    .filter((g) => g !== group)
    .map((g) => ({ label: `Mover para “${g.name}”`, action: () => moveTerminal(id, g) }));
  showMenu(e, [
    { label: 'Editar…', action: () => editTerminal(id) },
    { label: 'Duplicar', action: () => duplicateTerminal(id) },
    { label: 'Reiniciar', action: () => restartSession(id) },
    { label: 'Abrir pasta', action: () => api.openPath(t.cwd) },
    ...(moveTo.length ? [SEP, ...moveTo] : []),
    SEP,
    { label: 'Fechar', danger: true, action: () => closeTerminal(id) },
  ]);
}

export function groupMenu(e, group) {
  showMenu(e, [
    splitItem('group', group, group.terminals.length, splitGroup),
    { label: 'Novo terminal', action: () => newTerminal(group) },
    ...agentItems(group),
    { label: 'Renomear…', action: () => renameGroup(group) },
    SEP,
    { label: 'Excluir grupo', danger: true, action: () => deleteGroup(group) },
  ]);
}

export function projectMenu(e, project) {
  showMenu(e, [
    splitItem('project', project, projectTerminals(project).length, splitProject),
    { label: 'Novo terminal', action: () => newTerminal(project.groups[0]) },
    ...agentItems(project.groups[0]),
    { label: 'Novo grupo…', action: () => createGroup(project) },
    { label: 'Editar…', action: () => editProject(project) },
    project.open
      ? { label: 'Fechar projeto', action: () => closeProject(project) }
      : { label: 'Abrir projeto', action: () => openProject(project) },
    { label: 'Abrir pasta', action: () => api.openPath(project.cwd) },
    SEP,
    { label: 'Excluir projeto', danger: true, action: () => deleteProject(project) },
  ]);
}

export function commandMenu(e, c) {
  showMenu(e, [
    { label: 'Editar…', action: () => editCommand(c) },
    { label: 'Mover para a esquerda', action: () => moveCommand(c, -1) },
    { label: 'Mover para a direita', action: () => moveCommand(c, 1) },
    SEP,
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
