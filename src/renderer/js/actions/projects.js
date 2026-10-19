// Projetos: um nome + as pastas (repositórios) que você associa a ele, e os grupos de terminais.
import { store, commit, openTerminals, projectTerminals } from '../core/store.js';
import { makeProject } from '../core/model.js';
import { basename } from '../core/format.js';
import { DOT_COLORS } from '../themes/palette.js';
import { destroySession } from '../terminals/sessions.js';
import { openModal, field } from '../ui/modal.js';
import { confirmDanger, describeTerminals, hasRunning } from '../ui/confirm.js';
import { activate, newTerminal, ensureProjectOpen } from './terminals.js';
import { refreshAllGit } from '../git/git.js';

const projectFields = (p) => [
  field.text('name', 'Nome', p.name, { placeholder: 'minha-app' }),
  field.folders('repos', 'Pastas do projeto', p.repos, {
    hint: 'Os repositórios (e outras pastas, como devtools) deste projeto, onde quer que estejam clonados. A primeira é a pasta padrão dos novos terminais.',
  }),
  field.color('color', 'Cor', p.color),
  field.text('syncKey', 'Chave de sincronização', p.syncKey || '', {
    placeholder: 'ex.: brain-organizer (vazio = memória só nesta máquina)',
    hint: 'Projetos com a mesma chave compartilham memórias pelo servidor de memória, entre máquinas e devs.',
    mono: true,
  }),
];

/** Aplica nome, cor e pastas; a primeira pasta vira a pasta padrão (cwd). */
function applyFields(project, v) {
  const repos = v.repos.map((r) => ({ name: r.name.trim() || basename(r.path), path: r.path }));
  Object.assign(project, {
    name: v.name.trim() || project.name || basename(repos[0]?.path) || 'Projeto',
    color: v.color,
    syncKey: String(v.syncKey || '').trim().toLowerCase(),
    repos,
    cwd: repos[0]?.path || project.cwd || store.info.home,
  });
}

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

/** Clique no projeto: foca-o (painel, chips e "novo terminal" passam a segui-lo) e recolhe/expande. */
export function toggleProject(project) {
  project.collapsed = !project.collapsed;
  store.state.focusProjectId = project.id;
  commit();
}

const nextColor = () => DOT_COLORS[store.state.projects.length % DOT_COLORS.length];

/** Cria um projeto (usado pela interface e pela API). `repos`: [{ name?, path }]. */
export function addProject({ name = '', repos = [], color = nextColor() }) {
  const project = makeProject({ name: '' });
  applyFields(project, { name, color, repos: repos.map((r) => ({ name: r.name || '', path: r.path })) });
  store.state.projects.push(project);
  commit();
  refreshAllGit();
  return project;
}

export async function createProject() {
  // com o servidor de memória configurado: abrir um projeto que já está lá (trocar de máquina)
  const remote = (await api.sync.settings()).hasToken ? { label: 'Abrir do servidor…', value: 'remote' } : null;
  const fromFolder = { label: 'A partir de uma pasta…', value: 'folder' }; // repositórios e comandos detectados
  const v = await openModal({ title: 'Novo projeto', fields: projectFields({ name: '', repos: [], color: nextColor() }), submit: 'Criar', wide: true, extra: [fromFolder, remote] });
  if (!v) return;
  if (v === 'remote') return (await import('./project-remote.js')).openRemoteProject();
  if (v === 'folder') return (await import('./project-folder.js')).projectFromFolder();
  newTerminal(addProject(v).groups[0]);
}

export async function editProject(project) {
  const v = await openModal({ title: 'Editar projeto', fields: projectFields(project), submit: 'Salvar', wide: true });
  if (!v) return;
  applyFields(project, v);
  commit();
  refreshAllGit();
}

/** Chave de sincronização da memória (projetos com a mesma chave compartilham memórias pelo servidor). */
export function setSyncKey(project, key) {
  project.syncKey = String(key || '').trim().toLowerCase();
  commit();
}

/** Acrescenta pastas ao projeto, ignorando as que ele já tem. `folders`: [{ name?, path }]. */
export function addFoldersToProject(project, folders) {
  const fresh = folders.filter((f) => !project.repos.some((r) => r.path.toLowerCase() === f.path.toLowerCase()));
  if (!fresh.length) return;
  project.repos.push(...fresh.map((f) => ({ name: f.name || basename(f.path), path: f.path })));
  if (!project.cwd) project.cwd = project.repos[0].path;
  commit();
  refreshAllGit();
}

/** Adiciona pastas pelo seletor do sistema (atalho do ＋ na faixa de repositórios). */
export async function addProjectFolders(project) {
  const picked = await api.pickFolders(project.repos.at(-1)?.path || project.cwd || store.info.home);
  addFoldersToProject(project, picked.map((path) => ({ path })));
}

export async function removeProjectFolder(project, repo) {
  const ok = await confirmDanger({ title: `Remover “${repo.name}” do projeto?`, message: `${repo.path} — a pasta não é apagada do disco.`, submit: 'Remover' });
  if (!ok) return;
  project.repos = project.repos.filter((r) => r.path !== repo.path);
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
