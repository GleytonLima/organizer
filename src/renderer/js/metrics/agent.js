// Métricas dos eventos (src/main/metrics), funções puras: custo (tokens e estimativa em US$ com os
// preços que você informar), assertividade do agente (turnos interrompidos, permissões negadas,
// turnos por tarefa) e comandos que falharam.
import { median } from './flow.js';

const MILLION = 1e6;

/** Custo estimado (US$) com preços por milhão de tokens; null se não há preço definido. */
export function costOf(t, prices) {
  if (!prices || !['in', 'out'].some((k) => Number(prices[k]) > 0)) return null;
  const p = (k) => Number(prices[k]) || 0;
  return (t.in * p('in') + t.out * p('out') + t.cacheRead * p('cacheRead') + t.cacheWrite * p('cacheWrite')) / MILLION;
}

const zero = () => ({ in: 0, out: 0, cacheRead: 0, cacheWrite: 0 });
const add = (a, u) => {
  for (const k of Object.keys(a)) a[k] += u?.[k] || 0;
  return a;
};
const total = (t) => t.in + t.out + t.cacheRead + t.cacheWrite;

/** `events`: os do período e do escopo. `prices`: { in, out, cacheRead, cacheWrite } por milhão. */
export function agentMetrics(events, { prices = null } = {}) {
  const turns = events.filter((e) => e.kind === 'agent.turn');
  const perms = events.filter((e) => e.kind === 'agent.permission');
  const commands = events.filter((e) => e.kind === 'command');

  const tokens = turns.reduce((acc, e) => add(acc, e.data.usage), zero());
  const byModel = {};
  for (const e of turns) {
    const m = e.data.model || '—';
    byModel[m] = add(byModel[m] || zero(), e.data.usage);
  }
  const perTask = new Map();
  for (const e of turns) if (e.taskId) perTask.set(e.taskId, (perTask.get(e.taskId) || 0) + 1);
  const tasksWithAgent = perTask.size;
  const cost = costOf(tokens, prices);

  const denied = perms.filter((e) => String(e.data.kind).startsWith('reject')).length;
  const answered = perms.filter((e) => e.data.kind !== 'cancelled');
  const failed = commands.filter((e) => e.data.exit && e.data.exit !== 130); // 130: Ctrl+C (você parou)
  const failing = {};
  for (const e of failed) failing[e.data.program || '?'] = (failing[e.data.program || '?'] || 0) + 1;

  return {
    cost: {
      turns: turns.length,
      tokens: { ...tokens, total: total(tokens) },
      byModel: Object.entries(byModel).map(([model, t]) => ({ model, total: total(t), cost: costOf(t, prices) })).sort((a, b) => b.total - a.total),
      cost,
      costPerTask: cost != null && tasksWithAgent ? cost / tasksWithAgent : null,
      tokensPerTask: tasksWithAgent ? Math.round(total(tokens) / tasksWithAgent) : null,
    },
    agent: {
      turns: turns.length,
      interrupted: turns.filter((e) => e.data.stopReason === 'cancelled').length,
      turnsPerTask: tasksWithAgent ? turns.filter((e) => e.taskId).length / tasksWithAgent : null,
      turnMedianMs: median(turns.map((e) => e.data.ms).filter((x) => x > 0)),
      permissions: perms.length,
      denied,
      answerMedianMs: median(answered.map((e) => e.data.ms).filter((x) => x > 0)),
    },
    commands: {
      total: commands.length,
      failed: failed.length,
      top: Object.entries(failing).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([program, n]) => ({ program, n })),
    },
  };
}
