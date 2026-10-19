// Dados da Home (tela inicial): o que espera você, onde você parou e o que aconteceu enquanto você
// esteve fora. Só consultas — quem muda o estado são as ações (actions/home.js, task-waiting.js).
import { store, findTerm, projectById } from '../core/store.js';
import { columnsOf, isDoneColumn } from '../tasks/columns.js';

const byRecent = (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0);
const projectOf = (task) => projectById(task.projectId);
const lastReport = (task) => [...task.history].reverse().find((h) => h.type === 'report')?.text || null;

/** Tarefas em espera (de qualquer projeto), a mais antiga primeiro: quem espera há mais tempo vem antes. */
export function waitingItems() {
  return store.state.tasks
    .filter((t) => t.needsInput && projectOf(t))
    .sort((a, b) => a.needsInput.at - b.needsInput.at)
    .map((task) => ({ task, project: projectOf(task), origin: findTerm(task.terminalId) }));
}

/**
 * Frentes de trabalho em andamento, a mais recente primeiro: tarefas fora da primeira e da última
 * coluna (ou com o terminal do agente ainda aberto), que não estão esperando você.
 */
export function resumeItems(limit = 4) {
  return store.state.tasks
    .filter((t) => {
      const project = projectOf(t);
      if (!project || t.needsInput || isDoneColumn(project, t.columnId)) return false;
      const started = columnsOf(project)[0].id !== t.columnId;
      return started || findTerm(t.terminalId);
    })
    .sort(byRecent)
    .slice(0, limit)
    .map((task) => ({ task, project: projectOf(task), origin: findTerm(task.terminalId), report: lastReport(task) }));
}

/**
 * O que aconteceu desde `since` sem ser você: tarefas concluídas e criadas (por agentes ou pelo
 * time), relatos dos agentes e quem do time mexeu. null sem `since` (primeira vez).
 */
export function awaySummary(since) {
  if (!since) return null;
  const out = { done: [], created: [], reports: 0, people: new Set() };
  for (const task of store.state.tasks) {
    const project = projectOf(task);
    if (!project) continue;
    for (const h of task.history) {
      if (h.at <= since || h.by === 'você') continue;
      if (h.by !== 'agente') out.people.add(h.by);
      if (h.type === 'created') out.created.push(task);
      else if (h.type === 'report') out.reports++;
      else if (h.type === 'moved' && h.to && isDoneColumn(project, h.to)) out.done.push(task);
    }
  }
  out.done = [...new Set(out.done)];
  out.created = [...new Set(out.created)];
  out.people = [...out.people];
  return out;
}

export const isEmptySummary = (s) => !s || (!s.done.length && !s.created.length && !s.reports && !s.people.length);
