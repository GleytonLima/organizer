// Estado da aplicação, persistência e notificação de mudanças.
import { DOT_COLORS } from '../themes/palette.js';

export const store = {
  state: null,
  info: { bash: null, home: '' },
};

export const uid = () => Math.random().toString(36).slice(2, 10);

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

// ---------- criação / normalização ----------
export function newWorkspace(fields = {}) {
  return {
    id: uid(),
    name: 'Workspace',
    color: DOT_COLORS[0],
    cwd: store.info.home,
    open: true,
    collapsed: false,
    terminals: [],
    ...fields,
  };
}

export function loadState(saved) {
  const s = saved || {};
  store.state = {
    version: 1,
    layout: s.layout || 'left',
    theme: s.theme || 'grafite',
    activeId: s.activeId || null,
    workspaces: s.workspaces?.length ? s.workspaces : [newWorkspace({ name: 'Geral' })],
    commands: s.commands || [
      { id: uid(), label: 'status', cmd: 'git status' },
      { id: uid(), label: 'log', cmd: 'git log --oneline -15 --graph' },
      { id: uid(), label: 'pull', cmd: 'git pull' },
    ],
  };
}

// ---------- consultas ----------
export const allTerminals = () => store.state.workspaces.flatMap((ws) => ws.terminals.map((t) => ({ ws, t })));
export const openTerminals = () => allTerminals().filter((x) => x.ws.open);
export const wsById = (id) => store.state.workspaces.find((w) => w.id === id);

export function findTerm(id) {
  for (const ws of store.state.workspaces) {
    const t = ws.terminals.find((x) => x.id === id);
    if (t) return { ws, t };
  }
  return null;
}

export const activeEntry = () => (store.state.activeId ? findTerm(store.state.activeId) : null);

export const currentWs = () =>
  activeEntry()?.ws || store.state.workspaces.find((w) => w.open) || store.state.workspaces[0];
