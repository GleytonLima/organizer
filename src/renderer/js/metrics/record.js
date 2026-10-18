// Coleta para o painel Insights (src/main/metrics): cada evento leva o projeto e a tarefa atual do
// terminal, resolvidos aqui. Fire-and-forget: medir nunca atrapalha o trabalho.
import { findTerm } from '../core/store.js';
import { currentTaskOf } from '../tasks/queries.js';

export function recordEvent(kind, terminalId, data = {}) {
  try {
    const entry = findTerm(terminalId);
    const task = terminalId && currentTaskOf(terminalId);
    api.metrics.record({ ts: Date.now(), kind, terminalId, projectId: entry?.project.id ?? task?.projectId ?? null, taskId: task?.id ?? null, data });
  } catch {} // sem API (testes isolados) ou terminal que sumiu: ignora
}

/** Uso de tokens do turno, no formato do ACP (usage do session/prompt). */
export const usageOf = (u) =>
  u ? { in: u.inputTokens || 0, out: u.outputTokens || 0, cacheRead: u.cachedReadTokens || 0, cacheWrite: u.cachedWriteTokens || 0 } : null;
