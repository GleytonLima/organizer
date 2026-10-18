// Abrir um projeto do servidor nesta máquina (trocar de máquina): as pastas são achadas pelo remote
// git (ou clonadas), as colunas são as do time e grupos/terminais vêm do SEU layout. Comandos
// iniciais vindos do servidor só entram com a sua confirmação no diálogo.
import { store, commit, projects } from '../core/store.js';
import { el } from '../core/dom.js';
import { makeGroup, makeTerminal } from '../core/model.js';
import { cleanError } from '../core/errors.js';
import { openModal, field } from '../ui/modal.js';
import { addProject, addFoldersToProject } from './projects.js';
import { applyServerColumns } from './project-server.js';

const join = (...parts) => parts.filter(Boolean).join('\\').replace(/[\\/]+/g, '\\');
const knownFolders = () => projects().flatMap((p) => (p.repos || []).map((r) => r.path));
const lastPart = (remote) => remote.split('/').filter(Boolean).pop();

/** Pasta de clones padrão: a que contém a primeira pasta que você já tem (ou ~\source\repos). */
function defaultBase() {
  const known = knownFolders()[0];
  return known ? known.replace(/[\\/][^\\/]+[\\/]?$/, '') : join(store.info.home, 'source', 'repos');
}

/** Cada pasta do projeto: onde ela já está nesta máquina, ou para onde será clonada. */
const planFolders = (project, located, base) =>
  project.folders.map((f) => ({ ...f, path: located[f.remote] || null, cloneTo: located[f.remote] ? null : join(base, f.name || lastPart(f.remote)) }));

const terminalsOf = (layout) => (layout?.groups || []).flatMap((g) => g.terminals.map((t) => ({ ...t, group: g.name })));

function reviewContent(plan, terms, existing) {
  const row = (text, note) => el('li', {}, el('span', { text }), el('span', { class: 'muted', text: `  ${note}` }));
  return el(
    'div',
    { class: 'remote-review' },
    el('p', { class: 'eyebrow', text: 'Pastas' }),
    el('ul', {}, plan.map((f) => row(f.name || lastPart(f.remote), f.path ? `encontrada em ${f.path}` : f.url ? `será clonada em ${f.cloneTo}` : 'não encontrada (sem URL para clonar)'))),
    existing
      ? el('p', { class: 'muted', text: `Você já tem este projeto (“${existing.name}”): só as pastas que faltam e as colunas do time serão atualizadas.` })
      : el('p', { class: 'eyebrow', text: terms.length ? 'Seus terminais' : 'Sem layout salvo: o projeto abre com um grupo vazio.' }),
    !existing && terms.length ? el('ul', {}, terms.map((t) => row(`${t.group} / ${t.name || 'terminal'}`, t.startup ? `comando inicial: ${t.startup}` : ''))) : null,
  );
}

async function cloneMissing(plan) {
  const errors = [];
  for (const f of plan.filter((x) => !x.path && x.url)) {
    try {
      f.path = await api.sync.clone(f.url, f.cloneTo);
    } catch (err) {
      errors.push(cleanError(err));
    }
  }
  return errors;
}

/** Grupos e terminais do layout, cada terminal na pasta (pelo remote) + subpasta. */
function applyLayout(project, layout, plan, withStartup) {
  const pathOf = (remote) => (plan.find((f) => f.remote === remote) || plan.find((f) => f.path))?.path || project.cwd;
  const groups = layout.groups.map((g) =>
    makeGroup({
      name: g.name || 'Terminais',
      terminals: g.terminals.map((t) => makeTerminal({ name: t.name, color: t.color, cwd: join(pathOf(t.folder), t.subdir), startup: withStartup ? t.startup : '' })),
    }),
  );
  if (groups.length) project.groups = groups;
}

/** Fluxo completo: escolher o projeto e a pasta de clones, revisar, clonar e abrir. */
export async function openRemoteProject() {
  let list;
  try {
    list = await api.sync.remoteProjects();
  } catch (err) {
    return openModal({ title: 'Abrir projeto do servidor', message: cleanError(err), submit: 'OK' });
  }
  if (!list.length) return openModal({ title: 'Abrir projeto do servidor', message: 'Ainda não há projetos no servidor. Defina a chave de sincronização num projeto para enviá-lo.', submit: 'OK' });
  const pick = await openModal({
    title: 'Abrir projeto do servidor',
    fields: [
      field.select('key', 'Projeto', list[0].key, { options: list.map((w) => ({ value: w.key, label: w.name || w.key })) }),
      field.folder('base', 'Pasta de clones', defaultBase(), { hint: 'Onde procurar os repositórios que você já clonou e onde clonar os que faltarem.' }),
    ],
    submit: 'Continuar',
  });
  if (!pick) return null;
  return importRemoteProject(pick.key, pick.base);
}

/** Revisão e importação de um projeto do servidor (também usado pelos testes). */
export async function importRemoteProject(key, base) {
  const { project, layout, located } = await api.sync.fetchProject(key, { known: knownFolders(), bases: [base] });
  const existing = projects().find((p) => p.syncKey === key) || null;
  const plan = planFolders(project, located, base);
  const terms = terminalsOf(layout);
  const hasStartup = !existing && terms.some((t) => t.startup);
  const ok = await openModal({
    title: `Abrir “${project.name}”`,
    content: reviewContent(plan, terms, existing),
    fields: hasStartup
      ? [field.select('startup', 'Comandos iniciais', 'no', { options: [{ value: 'no', label: 'Criar os terminais sem os comandos' }, { value: 'yes', label: 'Criar com os comandos listados acima' }] })]
      : [],
    submit: existing ? 'Atualizar' : 'Abrir',
    wide: true,
  });
  if (!ok) return null;
  const errors = await cloneMissing(plan);
  const repos = plan.filter((f) => f.path).map((f) => ({ name: f.name, path: f.path }));
  const target = existing || addProject({ name: project.name, repos });
  if (existing) addFoldersToProject(existing, repos);
  else {
    target.syncKey = key;
    if (layout?.groups?.length) applyLayout(target, layout, plan, ok.startup === 'yes');
  }
  applyServerColumns(target, project.columns);
  await api.sync.adoptProject(key, project, layout);
  commit();
  if (errors.length) openModal({ title: 'Algumas pastas não foram clonadas', message: errors.join('\n'), submit: 'OK' });
  return target;
}
