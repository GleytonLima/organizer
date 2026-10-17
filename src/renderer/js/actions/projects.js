// Projetos: a pasta raiz que agrupa os grupos de terminais.
import { store, commit, openTerminals, projectTerminals } from '../core/store.js';
import { makeProject } from '../core/model.js';
import { basename } from '../core/format.js';
import { DOT_COLORS } from '../themes/palette.js';
import { destroySession } from '../terminals/sessions.js';
import { openModal, field } from '../ui/modal.js';
import { confirmDanger, describeTerminals, hasRunning } from '../ui/confirm.js';
import { activate, newTerminal, ensureProjectOpen } from './terminals.js';

const projectFields = (p) => [
  field.text('name', 'Nome', p.name, { placeholder: 'minha-app' }),
  field.folder('cwd', 'Pasta do projeto', p.cwd, { hint: 'Pasta inicial dos novos terminais.' }),
  field.color('color', 'Cor', p.color),
];

export function openProject(project) {
  const first = projectTerminals(project)[0];
  if (!first) return newTerminal(project.groups[0]);
  ensureProjectOpen(project);
  activate(first.id);
}

/** Encerra os terminais do projeto, mantendo-os salvos para reabrir depois. */
function shutdown(project) {
  projectTerminals(project).forEach((t) => destroySession(t.id));
  project.open = false;
  if (projectTerminals(project).some((t) => t.id === store.state.activeId)) {
    store.state.activeId = null;
    const next = openTerminals()[0];
    if (next) return activate(next.t.id);
  }
  commit();
}

export async function closeProject(project) {
  const terms = projectTerminals(project);
  if (hasRunning(terms)) {
    const ok = await confirmDanger({ title: `Fechar “${project.name}”?`, message: describeTerminals(terms), submit: 'Fechar' });
    if (!ok) return;
  }
  shutdown(project);
}

export function toggleProject(project) {
  project.collapsed = !project.collapsed;
  commit();
}

export async function createProject() {
  const draft = { name: '', cwd: '', color: DOT_COLORS[store.state.projects.length % DOT_COLORS.length] };
  const v = await openModal({ title: 'Novo projeto', fields: projectFields(draft), submit: 'Criar' });
  if (!v) return;
  const project = makeProject({
    name: v.name.trim() || basename(v.cwd) || 'Projeto',
    cwd: v.cwd.trim() || store.info.home,
    color: v.color,
  });
  store.state.projects.push(project);
  newTerminal(project.groups[0]);
}

export async function editProject(project) {
  const v = await openModal({ title: 'Editar projeto', fields: projectFields(project), submit: 'Salvar' });
  if (!v) return;
  Object.assign(project, { name: v.name.trim() || project.name, cwd: v.cwd.trim() || project.cwd, color: v.color });
  commit();
}

export async function deleteProject(project) {
  const ok = await confirmDanger({ title: `Excluir o projeto “${project.name}”?`, message: describeTerminals(projectTerminals(project)) });
  if (!ok) return;
  shutdown(project);
  store.state.projects = store.state.projects.filter((p) => p !== project);
  if (!store.state.projects.length) store.state.projects.push(makeProject({ name: 'Geral', cwd: store.info.home }));
  commit();
}
