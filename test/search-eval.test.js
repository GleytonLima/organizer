// Avaliação da busca da memória: grava o conjunto de test/fixtures/search-eval.json e mede hit@1,
// hit@5 e MRR da busca por texto (a que roda sem embeddings). Mudou o ranking? Rode esta suíte
// antes e depois; o piso abaixo só sobe (não deixe a busca piorar sem querer).
const { suite, seed } = require('./harness');
const { loadEval, score } = require('./lib/search-eval');
const { startFakeEmbed } = require('./lib/fake-embed');

// medido em 2026-10-18: 0,92/1/0,96 → stopwords 1/1/1 (o conjunto saturou: é piso, não teto)
const FLOOR = { hit1: 1, hit5: 1, mrr: 1 };

suite('avaliação da busca', { seed: () => seed.state([]) }, async (t) => {
  const store = require('../src/main/memory/store');
  const { markReview } = require('../src/main/memory/links');
  const { openDb } = require('../src/main/memory/db');
  const { search } = require('../src/main/memory/search');
  const data = loadEval();
  const ids = {};
  const where = (m) => (m.kind === 'progress' ? { scope: 'project', projectId: 'p-eval', project: 'eval', taskKey: m.task } : { scope: 'global' });
  for (const m of data.memories) ids[m.k] = store.add({ ...where(m), kind: m.kind, text: m.text, tags: m.tags.join(',') }).id;
  for (const m of data.memories) {
    if (m.supersededBy) openDb().prepare('UPDATE memories SET superseded_by = ? WHERE id = ?').run(ids[m.supersededBy], ids[m.k]);
    if (m.review) markReview([ids[m.k]], 'avaliação');
    if (m.status) store.update(ids[m.k], { status: m.status });
  }
  const keyOf = Object.fromEntries(Object.entries(ids).map(([k, id]) => [id, k]));
  const ranked = [];
  for (const { q, expect } of data.queries) {
    const res = await search(q, { limit: 10 });
    ranked.push({ q, expect, got: res.items.map((i) => keyOf[i.id]) });
  }
  const s = score(ranked);
  // ruído: buscas com um progresso de tarefa (episódico) entre os 5 primeiros
  const progress = new Set(data.memories.filter((m) => m.kind === 'progress').map((m) => m.k));
  const noisy = ranked.filter((r) => r.got.slice(0, 5).some((k) => progress.has(k))).length;
  process.stdout.write(`  busca por texto: hit@1 ${s.hit1} · hit@5 ${s.hit5} · MRR ${s.mrr} (${s.n} perguntas) · com progresso no top-5: ${noisy}\n`);
  for (const m of s.misses) process.stdout.write(`    · ${m}\n`);
  // híbrida com provedor falso: prefixos do nomic na indexação e na consulta
  const embeddings = require('../src/main/memory/embeddings');
  const fake = await startFakeEmbed();
  embeddings.saveSettings({ provider: 'openai', url: fake.url, model: 'text-embedding-nomic-embed-text-v1.5' });
  const indexed = await embeddings.embedPending();
  t.check(indexed === data.memories.length && fake.inputs.every((x) => x.startsWith('search_document: ')), 'indexa todas, com o prefixo de documento do nomic', `${indexed} · ${fake.inputs[0]}`);
  const hybrid = await search('banco de dados', { limit: 5 });
  t.equal([hybrid.mode, fake.inputs, keyOf[hybrid.items[0]?.id]], ['híbrida', ['search_query: banco de dados'], 'db'], 'consulta com o prefixo de busca; "banco de dados" traz a decisão do PostgreSQL');
  t.equal(await embeddings.embedPending(), 0, 'nada mudou: nada a reindexar');
  embeddings.saveSettings({ provider: 'off' });
  fake.stop();

  const { authority, rerank } = require('../src/main/memory/authority');
  const f = (m) => Math.round(authority(m) * 100) / 100;
  t.equal([f({ kind: 'decision' }), f({ kind: 'howto' }), f({ kind: 'note' }), f({ kind: 'progress' }), f({ kind: 'decision', review: {} }), f({ kind: 'decision', supersededBy: 'x' }), f({ kind: 'idea', status: 'converted' })],
    [1.15, 1.12, 1, 0.9, 0.8, 0.65, 0.8], 'autoridade: decisão sobe; a revisar, substituída e ideia fechada têm teto');
  const order = rerank([{ id: 'n', kind: 'note', s: 1 }, { id: 'd', kind: 'decision', s: 0.95 }, { id: 'd2', kind: 'decision', s: 0.5 }], (m) => m.s, 2).map((m) => m.id);
  t.equal(order, ['d', 'n'], 'quase empate: a decisão passa; a muito menos relevante não entra');
  t.equal(noisy, 0, 'progresso de tarefa concluída não aparece na busca padrão (antes: 5 de 25 buscas com progresso no top-5)');
  t.check(s.hit1 >= FLOOR.hit1 && s.hit5 >= FLOOR.hit5 && s.mrr >= FLOOR.mrr, `busca por texto não piora (piso hit@1 ${FLOOR.hit1}, hit@5 ${FLOOR.hit5}, MRR ${FLOOR.mrr})`, JSON.stringify(s));
});
