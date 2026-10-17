// Métodos da API para a memória (notas e decisões). O banco vive no processo principal;
// aqui resolvemos o contexto de quem pede: projeto, pasta (git do terminal), tarefa atual e escopo.
//   Escopos: project (padrão) | folder (vale em todo projeto que inclua a pasta) | global.
import { store } from '../core/store.js';
import { termLabel } from '../core/format.js';
import { gitFor } from '../git/git.js';
import { resolveTaskRef, currentTaskOf } from '../tasks/queries.js';
import { memoryContext } from '../memory/context.js';
import { callerOf, resolveProject, resolveCwd } from './resolve.js';
import { invalidateMemory } from '../ui/memory/state.js';

const iso = (ms) => new Date(ms).toISOString();
const view = ({ createdAt, updatedAt, ...m }) => ({ ...m, createdAt: iso(createdAt), updatedAt: iso(updatedAt) });

function context(p) {
  const caller = callerOf(p);
  const project = resolveProject(p.project, caller, p.fromCwd);
  return { caller, project, read: p.all ? {} : { context: memoryContext(project) } };
}

/** Pasta de uma memória "folder": nome de repo do projeto, caminho, ou a pasta (repo) de quem pede. */
async function resolveFolder(p, project, caller) {
  if (p.folder) {
    const repo = (project.repos || []).find((r) => r.name.toLowerCase() === String(p.folder).toLowerCase());
    return repo ? repo.path : resolveCwd(p.folder, caller?.t.cwd || p.fromCwd || store.info.home);
  }
  const here = caller?.t.cwd || p.fromCwd;
  const root = caller && gitFor(caller.t.cwd)?.root;
  if (root) return root;
  const inProject = (project.repos || []).find((r) => here && here.toLowerCase().startsWith(r.path.toLowerCase()));
  if (inProject) return inProject.path;
  throw new Error('Informe "folder" (nome de uma pasta do projeto ou caminho) para uma memória de pasta.');
}

async function remember(p, kind) {
  const { caller, project } = context(p);
  const scope = p.scope || 'project';
  const folder = scope === 'folder' ? await resolveFolder(p, project, caller) : null;
  const task = p.task ? resolveTaskRef(p.task, { project }) : caller && currentTaskOf(caller.t.id);
  const item = await api.memory.add({
    scope,
    folder,
    projectId: project.id,
    project: project.name,
    repo: p.repo || (caller && gitFor(caller.t.cwd)?.repo) || null,
    kind,
    text: p.text,
    tags: p.tags,
    source: caller ? `agente (${termLabel(caller.t)})` : 'agente',
    taskKey: task?.key || null,
    supersedes: p.supersedes || null,
  });
  invalidateMemory(); // a aba Memória reflete o que o agente gravou
  return view(item);
}

export const memoryHandlers = {
  memory_note: (p) => remember(p, 'note'),
  memory_decision: (p) => remember(p, 'decision'),

  /** Busca no que vale para o projeto (globais + projeto + pastas); `scope` restringe a um escopo. */
  async memory_search(p) {
    const { read } = context(p);
    const r = await api.memory.search(p.query || '', { ...read, scope: p.scope, kind: p.kind, repo: p.repo, limit: p.limit });
    return { ...r, items: r.items.map(view) };
  },

  /** Decisões vigentes que valem para o projeto (as substituídas ficam de fora). */
  async memory_decisions(p) {
    const { read } = context(p);
    return (await api.memory.list({ ...read, scope: p.scope, kind: 'decision', repo: p.repo, limit: p.limit || 100 })).map(view);
  },

  async memory_forget(p) {
    const r = await api.memory.remove(p.id);
    invalidateMemory();
    return r;
  },
};
