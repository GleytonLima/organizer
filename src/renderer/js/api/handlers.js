// Métodos da API local. Cada um recebe os parâmetros do pedido; `from` = terminal de origem.
import { store, findTerm, projects } from '../core/store.js';
import { termLabel } from '../core/format.js';
import { getSession, processStatus, runningCommand, writeWhenReady } from '../terminals/sessions.js';
import { readLines } from '../terminals/buffer.js';
import { activate, addTerminal, removeTerminal } from '../actions/terminals.js';
import { callerOf, resolveProject, resolveGroup, resolveTerminal, resolveCwd } from './resolve.js';
import { pushNotification } from '../notify/center.js';

function terminalInfo({ project, group, t }) {
  return {
    id: t.id,
    name: termLabel(t),
    project: project.name,
    group: group.name,
    cwd: t.cwd,
    status: processStatus(t.id),
    running: runningCommand(t.id),
    lastExit: getSession(t.id)?.lastExit ?? null,
    active: t.id === store.state.activeId,
  };
}

const describeProject = (project) => ({
  id: project.id,
  name: project.name,
  cwd: project.cwd,
  open: project.open,
  groups: project.groups.map((group) => ({
    id: group.id,
    name: group.name,
    terminals: group.terminals.map((t) => terminalInfo({ project, group, t })),
  })),
});

export const handlers = {
  /** Projetos, grupos e terminais; `caller` é o terminal que pediu. */
  list(p) {
    return { caller: callerOf(p)?.t.id ?? null, projects: projects().map(describeProject) };
  },

  /** Abre um terminal (no grupo de quem pediu, ou em `group`, criado se não existir). */
  async open(p) {
    const caller = callerOf(p);
    const project = resolveProject(p.project, caller);
    const group = resolveGroup(project, p.group, caller);
    const base = caller?.project === project ? caller.t.cwd : project.cwd || store.info.home;
    const cwd = await resolveCwd(p.cwd, base);
    const t = addTerminal(group, { name: p.name || '', cwd, startup: p.startup || '' }, { focus: !!p.focus });
    if (p.command) await writeWhenReady(t.id, p.command + '\r');
    return terminalInfo(findTerm(t.id));
  },

  /** Envia texto ao terminal (com Enter, salvo `enter: false`). */
  async send(p) {
    const entry = resolveTerminal(p.terminal, callerOf(p));
    await writeWhenReady(entry.t.id, (p.text || '') + (p.enter === false ? '' : '\r'));
    return terminalInfo(entry);
  },

  /** Últimas linhas da saída do terminal. */
  read(p) {
    const entry = resolveTerminal(p.terminal, callerOf(p));
    return { ...terminalInfo(entry), output: readLines(entry.t.id, Math.min(p.lines || 50, 2000)) };
  },

  status(p) {
    return terminalInfo(resolveTerminal(p.terminal, callerOf(p)));
  },

  focus(p) {
    const entry = resolveTerminal(p.terminal, callerOf(p));
    activate(entry.t.id);
    return terminalInfo(entry);
  },

  /** Avisa o usuário (toast + marcação no terminal de origem ou em `terminal`). */
  notify(p) {
    const entry = p.terminal ? resolveTerminal(p.terminal, callerOf(p)) : callerOf(p);
    return pushNotification({ terminalId: entry?.t.id ?? null, label: p.title, body: p.message || 'Terminei' });
  },

  /** Fecha o terminal; se houver processo rodando, exige `force: true`. */
  close(p) {
    const entry = resolveTerminal(p.terminal, callerOf(p));
    const cmd = runningCommand(entry.t.id);
    if (cmd && !p.force) throw new Error(`"${termLabel(entry.t)}" está executando "${cmd}". Use force para encerrar.`);
    removeTerminal(entry.t.id);
    return { closed: entry.t.id };
  },
};
