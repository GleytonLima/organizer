import { store, commit, newWorkspace, openTerminals } from '../core/store.js';
import { basename } from '../core/format.js';
import { DOT_COLORS } from '../themes/palette.js';
import { destroySession } from '../terminals/sessions.js';
import { openModal, field } from '../ui/modal.js';
import { activate, newTerminal, ensureWorkspaceOpen } from './terminals.js';

const workspaceFields = (ws) => [
  field.text('name', 'Nome', ws.name, { placeholder: 'meu-projeto' }),
  field.folder('cwd', 'Pasta do projeto', ws.cwd, { hint: 'Pasta inicial dos novos terminais.' }),
  field.color('color', 'Cor', ws.color),
];

export function openWorkspace(ws) {
  if (!ws.terminals.length) return newTerminal(ws);
  ensureWorkspaceOpen(ws);
  activate(ws.terminals[0].id);
}

export function closeWorkspace(ws) {
  ws.terminals.forEach((t) => destroySession(t.id));
  ws.open = false;
  if (ws.terminals.some((t) => t.id === store.state.activeId)) {
    const next = openTerminals()[0];
    store.state.activeId = null;
    if (next) return activate(next.t.id);
  }
  commit();
}

export function toggleCollapsed(ws) {
  ws.collapsed = !ws.collapsed;
  commit();
}

export async function createWorkspace() {
  const draft = { name: '', cwd: '', color: DOT_COLORS[store.state.workspaces.length % DOT_COLORS.length] };
  const v = await openModal({ title: 'Novo workspace', fields: workspaceFields(draft), submit: 'Criar' });
  if (!v) return;
  const ws = newWorkspace({
    name: v.name.trim() || basename(v.cwd) || 'Workspace',
    cwd: v.cwd.trim() || store.info.home,
    color: v.color,
  });
  store.state.workspaces.push(ws);
  newTerminal(ws);
}

export async function editWorkspace(ws) {
  const v = await openModal({ title: 'Editar workspace', fields: workspaceFields(ws), submit: 'Salvar' });
  if (!v) return;
  Object.assign(ws, { name: v.name.trim() || ws.name, cwd: v.cwd.trim() || ws.cwd, color: v.color });
  commit();
}

export async function deleteWorkspace(ws) {
  const ok = await openModal({
    title: `Excluir “${ws.name}”?`,
    message: `${ws.terminals.length} terminal(is) serão encerrados e removidos.`,
    submit: 'Excluir',
    danger: true,
  });
  if (!ok) return;
  closeWorkspace(ws);
  store.state.workspaces = store.state.workspaces.filter((w) => w !== ws);
  if (!store.state.workspaces.length) store.state.workspaces.push(newWorkspace({ name: 'Geral' }));
  commit();
}
