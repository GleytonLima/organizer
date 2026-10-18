// Avaliação da busca da memória: grava o conjunto de test/fixtures/search-eval.json e mede hit@1,
// hit@5 e MRR da busca por texto (a que roda sem embeddings). Mudou o ranking? Rode esta suíte
// antes e depois; o piso abaixo só sobe (não deixe a busca piorar sem querer).
const { suite, seed } = require('./harness');
const { loadEval, score } = require('./lib/search-eval');

// medido em 2026-10-18: 0,92/1/0,96 → stopwords 1/1/1 (o conjunto saturou: é piso, não teto)
const FLOOR = { hit1: 1, hit5: 1, mrr: 1 };

suite('avaliação da busca', { seed: () => seed.state([]) }, async (t) => {
  const store = require('../src/main/memory/store');
  const { markReview } = require('../src/main/memory/links');
  const { openDb } = require('../src/main/memory/db');
  const { search } = require('../src/main/memory/search');
  const data = loadEval();
  const ids = {};
  for (const m of data.memories) ids[m.k] = store.add({ scope: 'global', kind: m.kind, text: m.text, tags: m.tags.join(',') }).id;
  for (const m of data.memories) {
    if (m.supersededBy) openDb().prepare('UPDATE memories SET superseded_by = ? WHERE id = ?').run(ids[m.supersededBy], ids[m.k]);
    if (m.review) markReview([ids[m.k]], 'avaliação');
  }
  const keyOf = Object.fromEntries(Object.entries(ids).map(([k, id]) => [id, k]));
  const ranked = [];
  for (const { q, expect } of data.queries) {
    const res = await search(q, { limit: 10 });
    ranked.push({ q, expect, got: res.items.map((i) => keyOf[i.id]) });
  }
  const s = score(ranked);
  process.stdout.write(`  busca por texto: hit@1 ${s.hit1} · hit@5 ${s.hit5} · MRR ${s.mrr} (${s.n} perguntas)\n`);
  for (const m of s.misses) process.stdout.write(`    · ${m}\n`);
  const { authority, rerank } = require('../src/main/memory/authority');
  const f = (m) => Math.round(authority(m) * 100) / 100;
  t.equal([f({ kind: 'decision' }), f({ kind: 'howto' }), f({ kind: 'note' }), f({ kind: 'progress' }), f({ kind: 'decision', review: {} }), f({ kind: 'decision', supersededBy: 'x' }), f({ kind: 'idea', status: 'converted' })],
    [1.15, 1.12, 1, 0.9, 0.8, 0.65, 0.8], 'autoridade: decisão sobe; a revisar, substituída e ideia fechada têm teto');
  const order = rerank([{ id: 'n', kind: 'note', s: 1 }, { id: 'd', kind: 'decision', s: 0.95 }, { id: 'd2', kind: 'decision', s: 0.5 }], (m) => m.s, 2).map((m) => m.id);
  t.equal(order, ['d', 'n'], 'quase empate: a decisão passa; a muito menos relevante não entra');
  t.check(s.hit1 >= FLOOR.hit1 && s.hit5 >= FLOOR.hit5 && s.mrr >= FLOOR.mrr, `busca por texto não piora (piso hit@1 ${FLOOR.hit1}, hit@5 ${FLOOR.hit5}, MRR ${FLOOR.mrr})`, JSON.stringify(s));
});
