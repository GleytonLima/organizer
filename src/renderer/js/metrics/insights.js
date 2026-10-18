// Painel Insights: junta o fluxo das tarefas (flow.js) e os eventos (agent.js) do período e do
// escopo escolhidos. Os eventos vêm do processo principal (assíncrono) e ficam em cache por período
// e escopo; as tarefas são recalculadas a cada render (é barato). Preferências em state.insights.
import { store, commit, notify, projects, currentProject } from '../core/store.js';
import { columnsOf } from '../tasks/columns.js';
import { flowMetrics } from './flow.js';
import { agentMetrics } from './agent.js';

const DAY = 86400000;
export const INSIGHT_PERIODS = [
  { id: '7d', label: 'Últimos 7 dias', days: 7 },
  { id: '30d', label: 'Últimos 30 dias', days: 30 },
  { id: '90d', label: 'Últimos 90 dias', days: 90 },
];

export const insightsSettings = () => (store.state.insights ||= { period: '30d', scope: 'project', prices: null });
export const currentInsightsPeriod = () => INSIGHT_PERIODS.find((p) => p.id === insightsSettings().period) || INSIGHT_PERIODS[1];

export function setInsights(patch) {
  Object.assign(insightsSettings(), patch);
  commit();
}

const scopeProjects = () => (insightsSettings().scope === 'all' ? projects() : [currentProject()].filter(Boolean));

const cache = { key: null, events: [], loading: false, error: null };

/** Recarrega os eventos (ex.: botão Atualizar). */
export function refreshInsights() {
  cache.key = null;
  notify();
}

function ensureEvents(since, ids) {
  const key = `${since}|${ids.join(',')}`;
  if (cache.key === key) return;
  cache.key = key;
  cache.loading = true;
  api.metrics
    .query({ since, projectIds: ids })
    .then((events) => Object.assign(cache, { events, error: null }))
    .catch((err) => Object.assign(cache, { events: [], error: err.message }))
    .finally(() => {
      cache.loading = false;
      notify();
    });
}

/** Falhas de teste do Playwright no período: as tarefas "Testes Playwright falhando…" e seus relatos. */
function testFailures(tasks, since) {
  let n = 0;
  for (const t of tasks) {
    if (!t.title.startsWith('Testes Playwright falhando')) continue;
    if (t.createdAt >= since) n++;
    n += t.history.filter((h) => h.type === 'report' && h.at >= since).length;
  }
  return n;
}

/** Tudo o que o painel mostra, para o período e o escopo atuais. */
export function insights(now = Date.now()) {
  const period = currentInsightsPeriod();
  const since = now - period.days * DAY;
  const scope = scopeProjects();
  const ids = scope.map((p) => p.id);
  ensureEvents(Math.floor(since / 60000) * 60000, ids); // chave estável por minuto
  const byProject = new Map(scope.map((p) => [p.id, columnsOf(p)]));
  const tasks = store.state.tasks.filter((t) => byProject.has(t.projectId));
  const flow = flowMetrics(tasks.map((task) => ({ task, columns: byProject.get(task.projectId) })), { since, now });
  const events = cache.events.filter((e) => e.ts >= since);
  const agent = agentMetrics(events, { prices: insightsSettings().prices });
  return {
    period, since, scope, loading: cache.loading, error: cache.error,
    ...flow,
    ...agent,
    rework: { reopened: flow.reopened, testFailures: testFailures(tasks, since), failedCommands: agent.commands.failed, commands: agent.commands.total, top: agent.commands.top },
  };
}
