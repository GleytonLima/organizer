import { store, uid, commit, findTerm, openTerminals, activeEntry, currentWs } from '../core/store.js';
import { basename } from '../core/format.js';
import { createSession, destroySession, fitActive, focusActive } from '../terminals/sessions.js';
import { openModal, field } from '../ui/modal.js';

/** Marca o workspace como aberto e sobe as sessões dos seus terminais. */
export function ensureWorkspaceOpen(ws) {
  ws.open = true;
  ws.collapsed = false;
  ws.terminals.forEach(createSession);
}

export function activate(id) {
  const entry = findTerm(id);
  if (!entry) return;
  if (!entry.ws.open) ensureWorkspaceOpen(entry.ws);
  createSession(entry.t);
  store.state.activeId = id;
  commit();
  requestAnimationFrame(() => {
    fitActive();
    focusActive();
  });
}

export function newTerminal(ws = currentWs(), extra = {}) {
  if (!ws) return;
  const act = activeEntry();
  const cwd = act?.ws === ws ? act.t.cwd : ws.cwd || store.info.home;
  const t = { id: uid(), name: '', color: ws.color, cwd, startup: '', ...extra };
  ws.terminals.push(t);
  ensureWorkspaceOpen(ws);
  activate(t.id);
}

export function closeTerminal(id) {
  const entry = findTerm(id);
  if (!entry) return;
  const open = openTerminals();
  const idx = open.findIndex((x) => x.t.id === id);
  destroySession(id);
  entry.ws.terminals = entry.ws.terminals.filter((t) => t.id !== id);
  if (store.state.activeId === id) {
    const rest = open.filter((x) => x.t.id !== id);
    const next = rest[Math.min(idx, rest.length - 1)];
    store.state.activeId = null;
    if (next) return activate(next.t.id);
  }
  commit();
}

export function cycleTerminal(dir) {
  const open = openTerminals();
  if (!open.length) return;
  const idx = open.findIndex((x) => x.t.id === store.state.activeId);
  activate(open[(idx + dir + open.length) % open.length].t.id);
}

export function duplicateTerminal(id) {
  const entry = findTerm(id);
  if (!entry) return;
  const { ws, t } = entry;
  const copy = { ...t, id: uid() };
  ws.terminals.splice(ws.terminals.indexOf(t) + 1, 0, copy);
  activate(copy.id);
}

export function moveTerminal(id, targetWs, beforeId) {
  const entry = findTerm(id);
  if (!entry || id === beforeId) return;
  entry.ws.terminals = entry.ws.terminals.filter((t) => t.id !== id);
  const idx = beforeId ? targetWs.terminals.findIndex((t) => t.id === beforeId) : -1;
  targetWs.terminals.splice(idx >= 0 ? idx : targetWs.terminals.length, 0, entry.t);
  if (!targetWs.open) ensureWorkspaceOpen(targetWs);
  commit();
}

export async function editTerminal(id) {
  const entry = findTerm(id);
  if (!entry) return;
  const { t } = entry;
  const v = await openModal({
    title: 'Editar terminal',
    fields: [
      field.text('name', 'Nome', t.name, { placeholder: basename(t.cwd), hint: 'Vazio usa o nome da pasta atual.' }),
      field.color('color', 'Cor', t.color),
      field.text('startup', 'Comando inicial', t.startup, {
        mono: true,
        placeholder: 'npm run dev',
        hint: 'Opcional. Executado sempre que o terminal abre.',
      }),
    ],
    submit: 'Salvar',
  });
  if (!v) return;
  Object.assign(t, { name: v.name.trim(), color: v.color, startup: v.startup.trim() });
  commit();
}
