// Estado da aplicação, persistência, notificação de mudanças e consultas.
import { migrate } from './model.js';

export const store = {
  state: null,
  info: { bash: null, home: '' },
};

// ---------- assinaturas ----------
const listeners = new Set();
let scheduled = false;

export const subscribe = (fn) => listeners.add(fn);

/** Agenda um re-render (agrupado no mesmo microtask). */
export function notify() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    listeners.forEach((fn) => fn());
  });
}

// ---------- persistência ----------
let saveTimer = null;

export function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => api.saveState(store.state), 250);
}

export function persistNow() {
  clearTimeout(saveTimer);
  api.saveStateSync(store.state);
}

/** Salva e re-renderiza: chamar após qualquer mutação do estado. */
export function commit() {
  persist();
  notify();
}

export function loadState(saved) {
  store.state = migrate(saved, store.info.home);
}

// ---------- consultas ----------
export const projects = () => store.state.projects;
export const projectById = (id) => projects().find((p) => p.id === id);

/** Todos os terminais, com projeto e grupo: [{ project, group, t }]. */
export const allTerminals = () =>
  projects().flatMap((project) => project.groups.flatMap((group) => group.terminals.map((t) => ({ project, group, t }))));

export const openTerminals = () => allTerminals().filter((x) => x.project.open);
export const projectTerminals = (project) => project.groups.flatMap((g) => g.terminals);

export const findTerm = (id) => (id ? allTerminals().find((x) => x.t.id === id) || null : null);

export function findGroup(id) {
  for (const project of projects()) {
    const group = project.groups.find((g) => g.id === id);
    if (group) return { project, group };
  }
  return null;
}

export const activeEntry = () => findTerm(store.state.activeId);

/**
 * Projeto em foco: o último projeto clicado na sidebar ou o do terminal ativo (ativar um terminal
 * foca o projeto dele). Painel de tarefas/memória, chips de repositório e "novo terminal" o seguem —
 * inclusive projetos ainda sem terminais.
 */
export const currentProject = () =>
  projectById(store.state.focusProjectId) || activeEntry()?.project || projects().find((p) => p.open) || projects()[0];

/** Origem da visão lado a lado ({ label, terminals }), ou null se não houver divisão válida. */
export function splitSource() {
  const split = store.state.split;
  if (!split) return null;
  if (split.kind === 'group') {
    const owner = findGroup(split.id);
    return owner?.project.open ? { label: owner.group.name, terminals: owner.group.terminals } : null;
  }
  const project = projectById(split.id);
  return project?.open ? { label: project.name, terminals: projectTerminals(project) } : null;
}

/** Terminais visíveis agora: os da divisão (2+) ou só o ativo. */
export function visibleTerminalIds() {
  const src = splitSource();
  if (src && src.terminals.length > 1) return src.terminals.map((t) => t.id);
  return store.state.activeId ? [store.state.activeId] : [];
}

/** Grupo do terminal ativo se ele for do projeto; senão, o primeiro grupo do projeto. */
export function currentGroup(project = currentProject()) {
  const act = activeEntry();
  return act?.project === project ? act.group : project?.groups[0];
}
