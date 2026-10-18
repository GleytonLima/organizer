// Métodos da API para o quadro de tarefas (usados pelo MCP e pelo `bo task`).
import { findTerm } from '../core/store.js';
import { termLabel } from '../core/format.js';
import { columnsOf, columnById, resolveColumn } from '../tasks/columns.js';
import { allTasks, projectTasks, taskProject, resolveTaskRef, subtasksOf, parentOf } from '../tasks/queries.js';
import { createTask, moveTask, reportTask, completeTask, setTaskParent, deleteTask } from '../actions/tasks.js';
import { requestInput, suggestReply } from '../actions/task-waiting.js';
import { callerOf, resolveProject } from './resolve.js';
import { linkTaskMemories, unlinkTaskMemory, taskMemories } from '../actions/task-memories.js';
import { addTaskTags, removeTaskTags } from '../actions/task-tags.js';
import { tagsOf, hasTag } from '../tasks/tags.js';
import { suggestMemory } from '../actions/task-suggestions.js';
import { consolidationRequest } from '../actions/task-consolidate.js';

const iso = (ms) => new Date(ms).toISOString();

function taskInfo(task, { history = false } = {}) {
  const project = taskProject(task);
  const origin = findTerm(task.terminalId);
  const last = [...task.history].reverse().find((h) => h.type === 'report');
  return {
    id: task.id,
    key: task.key,
    title: task.title,
    description: task.description,
    project: project.name,
    column: columnById(project, task.columnId)?.name,
    progress: task.progress,
    waiting: task.needsInput
      ? { question: task.needsInput.question, since: iso(task.needsInput.at), suggestion: task.needsInput.suggestion?.text ?? null }
      : null,
    terminal: origin ? termLabel(origin.t) : null,
    repo: task.repo ?? null,
    branch: task.branch ?? null,
    lastReport: last?.text ?? null,
    parent: parentOf(task)?.key ?? null,
    tags: tagsOf(task),
    updatedAt: iso(task.updatedAt),
    ...(history && { history: task.history.map((h) => ({ ...h, at: iso(h.at) })) }),
  };
}

/** Contexto comum: quem pediu, projeto alvo e a tarefa referida (quando houver). */
function context(p, { needTask = false } = {}) {
  const caller = callerOf(p);
  const terminalId = caller?.t.id ?? null;
  const project = resolveProject(p.project, caller, p.fromCwd);
  const task = needTask ? resolveTaskRef(p.task, { project, terminalId }) : null;
  return { caller, terminalId, project, task };
}

export const taskHandlers = {
  /** Colunas do quadro com descrição: o agente escolhe para onde mover a partir delas. */
  task_columns(p) {
    const { project } = context(p);
    const cols = columnsOf(project);
    return {
      project: project.name,
      columns: cols.map((c, i) => ({ id: c.id, name: c.name, description: c.description, first: i === 0, last: i === cols.length - 1 })),
      convention: 'Tarefas novas entram na primeira coluna; complete_task move para a última.',
    };
  },

  task_list(p) {
    const { project } = context(p);
    let tasks = projectTasks(project);
    if (p.column) {
      const col = resolveColumn(project, p.column);
      tasks = tasks.filter((t) => t.columnId === col.id);
    }
    if (p.tag) tasks = tasks.filter((t) => hasTag(t, p.tag));
    return tasks.sort((a, b) => b.updatedAt - a.updatedAt).map((t) => taskInfo(t));
  },

  /** Tarefa com histórico e as memórias que ela referencia (contexto para o agente). */
  async task_get(p) {
    const { task } = context(p, { needTask: true });
    const memories = (await taskMemories(task)).map((m) => ({ id: m.id, kind: m.kind, text: m.text, review: m.review?.reason ?? null }));
    const subtasks = subtasksOf(task).map((t) => ({ key: t.key, title: t.title, column: columnById(taskProject(t), t.columnId)?.name, waiting: !!t.needsInput }));
    const memorySuggestions = (task.memorySuggestions || []).map(({ id, kind, text }) => ({ id, kind, text }));
    return { ...taskInfo(task, { history: true }), subtasks, memories, memorySuggestions };
  },

  async task_create(p) {
    const { project, terminalId } = context(p);
    const columnId = p.column ? resolveColumn(project, p.column).id : undefined;
    const parent = p.parent ? resolveTaskRef(p.parent, { project }) : null;
    const task = createTask(parent ? taskProject(parent) : project, { title: p.title, description: p.description || '', columnId, terminalId, by: 'agente', parent });
    if (p.memories?.length) await linkTaskMemories(task, p.memories, { by: 'agente' });
    if (p.tags?.length) addTaskTags(task, p.tags, { by: 'agente' });
    return taskInfo(task);
  },

  /** Torna a tarefa subtarefa de `parent` (ou solta, com parent vazio). */
  task_set_parent(p) {
    const { project, task } = context(p, { needTask: true });
    const parent = p.parent ? resolveTaskRef(p.parent, { project: taskProject(task) || project }) : null;
    return taskInfo(setTaskParent(task, parent, { by: 'agente' }));
  },

  /** Vincula (ou, com `remove`, desvincula) memórias à tarefa. */
  async task_link_memory(p) {
    const { task } = context(p, { needTask: true });
    const refs = Array.isArray(p.memory) ? p.memory : [p.memory];
    if (p.remove) for (const r of refs) await unlinkTaskMemory(task, r);
    else await linkTaskMemories(task, refs, { by: 'agente' });
    return { ...taskInfo(task), memories: task.memoryRefs?.length || 0 };
  },

  /** Acrescenta (ou, com `remove`, tira) tags da tarefa — ex.: "jira:PROJ-123". */
  task_tag(p) {
    const { task } = context(p, { needTask: true });
    const tags = (Array.isArray(p.tags) ? p.tags : [p.tags]).filter(Boolean);
    if (!tags.length) throw new Error('Informe ao menos uma tag.');
    return taskInfo(p.remove ? removeTaskTags(task, tags, { by: 'agente' }) : addTaskTags(task, tags, { by: 'agente' }));
  },

  task_move(p) {
    const { project, task, terminalId } = context(p, { needTask: true });
    const col = resolveColumn(taskProject(task) || project, p.column);
    return taskInfo(moveTask(task, col.id, { by: 'agente', note: p.note || '', terminalId }));
  },

  task_report(p) {
    const { task, terminalId } = context(p, { needTask: true });
    return taskInfo(reportTask(task, p.message, { progress: p.progress, terminalId }));
  },

  task_input(p) {
    const { task, terminalId } = context(p, { needTask: true });
    return taskInfo(requestInput(task, p.question, { terminalId }));
  },

  /** Tarefas em espera (de todos os projetos, ou de `project`), com histórico — para um supervisor. */
  task_waiting(p) {
    const scope = p.project ? projectTasks(resolveProject(p.project, null, p.fromCwd)) : allTasks();
    return scope.filter((t) => t.needsInput).map((t) => taskInfo(t, { history: true }));
  },

  /** Supervisor deixa uma sugestão de resposta/resumo para o usuário decidir. */
  task_suggest(p) {
    const { task } = context(p, { needTask: true });
    return taskInfo(suggestReply(task, p.suggestion));
  },

  /** Conclui; a resposta pede ao agente que proponha memórias duráveis (consolidação). */
  task_complete(p) {
    const { task, terminalId } = context(p, { needTask: true });
    completeTask(task, { note: p.summary || '', terminalId });
    task.consolidationAskedAt = Date.now();
    return { ...taskInfo(task), next: consolidationRequest(task) };
  },

  /** Apaga a tarefa — sempre com a sua confirmação no app (vale para agentes e para o CLI). */
  async task_delete(p) {
    const { task } = context(p, { needTask: true });
    if (!(await deleteTask(task))) throw new Error('O usuário não confirmou a exclusão.');
    return { deleted: task.key };
  },

  /** O agente propõe uma memória (decision | howto | note); o usuário aceita ou descarta na gaveta. */
  task_suggest_memory(p) {
    const { task } = context(p, { needTask: true });
    const item = suggestMemory(task, { kind: p.kind || 'decision', text: p.text, tags: p.tags || [] });
    return { task: task.key, suggestion: item, pending: task.memorySuggestions.length, note: 'Fica pendente até o usuário aceitar ou descartar.' };
  },
};
