// Métricas da avaliação da busca (test/fixtures/search-eval.json): para cada pergunta, a posição da
// primeira memória esperada nos resultados → hit@1, hit@5 e MRR (média de 1/posição; 0 se não veio).
const fs = require('fs');
const path = require('path');

const loadEval = () => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'search-eval.json'), 'utf8'));

/** `ranked`: [{ q, expect, got: [chave da memória, na ordem] }] → { hit1, hit5, mrr, misses }. */
function score(ranked) {
  let hit1 = 0;
  let hit5 = 0;
  let mrr = 0;
  const misses = [];
  for (const r of ranked) {
    const pos = r.got.findIndex((k) => r.expect.includes(k)) + 1;
    if (pos === 1) hit1++;
    if (pos >= 1 && pos <= 5) hit5++;
    if (pos) mrr += 1 / pos;
    if (pos !== 1) misses.push(`${r.q} → ${pos ? `#${pos}` : 'fora'} (veio: ${r.got.slice(0, 3).join(', ') || 'nada'})`);
  }
  const n = ranked.length || 1;
  const round = (x) => Math.round((x / n) * 1000) / 1000;
  return { n: ranked.length, hit1: round(hit1), hit5: round(hit5), mrr: round(mrr), misses };
}

module.exports = { loadEval, score };
