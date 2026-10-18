// Autoridade de uma memória no ranking (ideia do ai-memory): depois da relevância, um fator limitado
// a [0,55; 1,5] — decisão e "como fazer" sobem um pouco; progresso e ideia descem; "a revisar",
// substituída e ideia fechada têm teto. A relevância continua mandando: nada sai do resultado.
// Mesmos pesos em bo-memory-server/internal/memory/authority.go — mude os dois juntos.
const KIND = { decision: 0.15, howto: 0.12, note: 0, progress: -0.1, idea: -0.05 };
const MIN = 0.55;
const MAX = 1.5;

function authority(m) {
  let f = 1 + (KIND[m.kind] ?? 0);
  if (m.supersededBy) f = Math.min(f, 0.65);
  else if (m.review) f = Math.min(f, 0.8);
  if (m.status && m.status !== 'open') f = Math.min(f, 0.8); // ideia fechada, progresso de tarefa concluída
  return Math.min(MAX, Math.max(MIN, f));
}

/** Candidatos antes de aplicar a autoridade: folga para uma decisão um pouco abaixo entrar. */
const window = (limit) => Math.min(Math.max(limit * 4, 20), limit + 300);

/** Reordena por `score` × autoridade (maior = melhor) e corta em `limit`. */
function rerank(items, scoreOf, limit) {
  return items
    .map((m) => ({ m, s: scoreOf(m) * authority(m) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map(({ m }) => m);
}

module.exports = { authority, window, rerank };
