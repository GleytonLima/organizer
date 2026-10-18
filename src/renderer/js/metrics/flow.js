// Métricas do quadro, a partir do histórico das tarefas (funções puras — testáveis sem o app):
// fluxo (concluídas, lead time, em aberto, vazão por semana), espera humana (Em espera → sua resposta)
// e reabertura (saiu da última coluna e voltou). Histórico antigo de "moved" não tem `to`: a coluna sai
// do texto ("Movida para “Feito”").

const DAY = 86400000;

export const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Coluna de destino de um "moved" (id), pelo campo `to` ou pelo nome no texto. */
function targetOf(h, columns) {
  if (h.to) return h.to;
  const name = /Movida para “(.+?)”/.exec(h.text || '')?.[1];
  return name ? columns.find((c) => c.name === name)?.id ?? null : null;
}

/** Linha do tempo da tarefa: [{ at, col }] (entra em `col` em `at`), começando na criação. */
export function timeline(task, columns) {
  const start = /Criada em “(.+?)”/.exec(task.history.find((h) => h.type === 'created')?.text || '')?.[1];
  let col = columns.find((c) => c.name === start)?.id ?? columns[0]?.id;
  const steps = [{ at: task.createdAt, col }];
  for (const h of task.history) {
    if (h.type !== 'moved') continue;
    const to = targetOf(h, columns);
    if (to && to !== col) {
      col = to;
      steps.push({ at: h.at, col });
    }
  }
  return steps;
}

/** Esperas da tarefa: [{ start, end|null }] — de cada pedido de decisão até a sua resposta. */
export function waits(task) {
  const out = [];
  for (const h of task.history) {
    if (h.type === 'input') out.push({ start: h.at, end: null });
    else if ((h.type === 'reply' || h.type === 'moved') && out.length && out.at(-1).end === null && h.at >= out.at(-1).start) out.at(-1).end = h.at;
  }
  if (out.length && out.at(-1).end === null && !task.needsInput) out.at(-1).end = task.updatedAt; // espera encerrada sem registro
  return out;
}

const weekStart = (ms) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // segunda-feira
  return d.getTime();
};

/** Soma uma tarefa nos acumuladores do período (`acc`). */
function addTask(acc, { task, columns }, since, now) {
  const done = columns.at(-1)?.id;
  const steps = timeline(task, columns);
  if (task.createdAt >= since) acc.created++;
  if (task.columnId !== done) acc.open++;
  const firstDone = steps.find((s) => s.col === done);
  if (firstDone && firstDone.at >= since) {
    acc.leads.push(firstDone.at - task.createdAt);
    const w = weekStart(firstDone.at);
    acc.doneWeeks.set(w, (acc.doneWeeks.get(w) || 0) + 1);
  }
  // reaberta: estava na última coluna e saiu dela
  acc.reopened += steps.filter((s, i) => i > 0 && steps[i - 1].col === done && s.col !== done && s.at >= since).length;
  for (const w of waits(task).filter((x) => x.start >= since)) {
    if (w.end === null) acc.waitsOpen++;
    acc.waitTimes.push((w.end ?? now) - w.start);
  }
}

/**
 * `items`: [{ task, columns }] (as tarefas do escopo, com as colunas do projeto de cada uma).
 * Devolve { flow, waiting, reopened } do período [since, now].
 */
export function flowMetrics(items, { since, now = Date.now() }) {
  const acc = { leads: [], doneWeeks: new Map(), created: 0, open: 0, reopened: 0, waitTimes: [], waitsOpen: 0 };
  for (const item of items) addTask(acc, item, since, now);
  const { leads, doneWeeks, created, open, reopened, waitTimes, waitsOpen } = acc;
  const weeks = [];
  for (let w = weekStart(Math.max(since, now - 12 * 7 * DAY)); w <= now; w += 7 * DAY) weeks.push({ week: w, done: doneWeeks.get(weekStart(w)) || 0 });
  return {
    flow: { done: leads.length, created, open, leadMedianMs: median(leads), weeks },
    waiting: { count: waitTimes.length, totalMs: waitTimes.reduce((a, b) => a + b, 0), medianMs: median(waitTimes), open: waitsOpen },
    reopened,
  };
}
