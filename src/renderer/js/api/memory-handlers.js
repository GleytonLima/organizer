// Métodos da API para a memória (notas e decisões). O banco vive no processo principal;
// aqui resolvemos o contexto de quem pede: projeto, repositório (git do terminal) e tarefa atual.
import { termLabel } from '../core/format.js';
import { gitFor } from '../git/git.js';
import { resolveTaskRef, currentTaskOf } from '../tasks/queries.js';
import { callerOf, resolveProject } from './resolve.js';
import { invalidateMemory } from '../ui/memory/state.js';

const iso = (ms) => new Date(ms).toISOString();
const view = ({ createdAt, updatedAt, ...m }) => ({ ...m, createdAt: iso(createdAt), updatedAt: iso(updatedAt) });

function context(p) {
  const caller = callerOf(p);
  const project = resolveProject(p.project, caller);
  return { caller, project, scope: p.all ? {} : { projectId: project.id } };
}

async function remember(p, kind) {
  const { caller, project } = context(p);
  const task = p.task ? resolveTaskRef(p.task, { project }) : caller && currentTaskOf(caller.t.id);
  const item = await api.memory.add({
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

  async memory_search(p) {
    const { scope } = context(p);
    const r = await api.memory.search(p.query || '', { ...scope, kind: p.kind, repo: p.repo, limit: p.limit });
    return { ...r, items: r.items.map(view) };
  },

  /** Decisões vigentes (as substituídas ficam de fora). */
  async memory_decisions(p) {
    const { scope } = context(p);
    return (await api.memory.list({ ...scope, kind: 'decision', repo: p.repo, limit: p.limit || 100 })).map(view);
  },

  async memory_forget(p) {
    const r = await api.memory.remove(p.id);
    invalidateMemory();
    return r;
  },
};
