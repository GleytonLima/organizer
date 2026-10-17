// Grupos de terminais dentro de um projeto.
import { store, commit, findGroup, openTerminals } from '../core/store.js';
import { makeGroup } from '../core/model.js';
import { destroySession } from '../terminals/sessions.js';
import { openModal, field } from '../ui/modal.js';
import { confirmDanger, describeTerminals } from '../ui/confirm.js';
import { activate, newTerminal } from './terminals.js';

const askName = (title, value, submit) =>
  openModal({ title, fields: [field.text('name', 'Nome do grupo', value, { placeholder: 'Serviços' })], submit });

export async function createGroup(project) {
  const v = await askName('Novo grupo', '', 'Criar');
  if (!v) return;
  const group = makeGroup({ name: v.name.trim() || 'Grupo' });
  project.groups.push(group);
  newTerminal(group);
}

export async function renameGroup(group) {
  const v = await askName('Renomear grupo', group.name, 'Salvar');
  if (!v || !v.name.trim()) return;
  group.name = v.name.trim();
  commit();
}

export function toggleGroup(group) {
  group.collapsed = !group.collapsed;
  commit();
}

/** Exclui o grupo e encerra seus terminais (com confirmação se não estiver vazio). */
export async function deleteGroup(group) {
  const owner = findGroup(group.id);
  if (!owner) return;
  if (group.terminals.length) {
    const ok = await confirmDanger({ title: `Excluir o grupo “${group.name}”?`, message: describeTerminals(group.terminals) });
    if (!ok) return;
  }
  const wasActive = group.terminals.some((t) => t.id === store.state.activeId);
  group.terminals.forEach((t) => destroySession(t.id));
  owner.project.groups = owner.project.groups.filter((g) => g !== group);
  if (!owner.project.groups.length) owner.project.groups.push(makeGroup());
  if (wasActive) {
    store.state.activeId = null;
    const next = openTerminals()[0];
    if (next) return activate(next.t.id);
  }
  commit();
}
