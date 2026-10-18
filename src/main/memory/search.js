// Busca na memória: full-text (FTS5/bm25) sempre; com embeddings ligados, busca híbrida
// (fusão por posição — Reciprocal Rank Fusion — entre texto e similaridade de vetores).
const { openDb } = require('./db');
const store = require('./store');
const embeddings = require('./embeddings');
const authority = require('./authority');

const POOL = 50; // candidatos de cada lado antes da fusão
const RRF_K = 60;

function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

const toVector = (blob) => new Float32Array(blob.buffer, blob.byteOffset, blob.byteLength / 4);

/** Ids ordenados por similaridade com a consulta (só memórias vetorizadas com o modelo atual). */
async function vectorRank(query, opts) {
  const [q] = await embeddings.embed([query], 'query');
  const f = store.filters(opts);
  const rows = openDb()
    .prepare(`SELECT id, embedding FROM memories WHERE embedding IS NOT NULL AND embedding_model = ? AND ${f.sql}`)
    .all(embeddings.settings().vectorKey, ...f.args);
  return rows
    .map((r) => ({ id: r.id, sim: cosine(q, toVector(r.embedding)) }))
    .sort((a, b) => b.sim - a.sim)
    .slice(0, POOL)
    .map((r) => r.id);
}

/** Reciprocal rank fusion: cada ranking soma 1/(k + posição). → Map id → escore. */
function fuse(rankings) {
  const score = new Map();
  for (const ids of rankings) ids.forEach((id, i) => score.set(id, (score.get(id) || 0) + 1 / (RRF_K + i + 1)));
  return score;
}

/** @returns {{ mode: 'texto'|'híbrida'|'recentes', warning?: string, items: object[] }} */
async function search(query, opts = {}) {
  const limit = opts.limit || 20;
  if (!String(query || '').trim()) return { mode: 'recentes', items: store.list({ ...opts, limit }) };
  const text = store.searchText(query, { ...opts, limit: Math.max(POOL, authority.window(limit)) });
  // bm25 do SQLite: menor = melhor (negativo); a autoridade multiplica a relevância (−bm25)
  const byText = () => authority.rerank(text, (m) => -m.score, limit);
  if (!embeddings.enabled()) return { mode: 'texto', items: byText() };
  try {
    const score = fuse([text.map((t) => t.id), await vectorRank(query, opts)]);
    const items = [...score.keys()].map((id) => store.get(id)).filter(Boolean);
    return { mode: 'híbrida', items: authority.rerank(items, (m) => score.get(m.id), limit) };
  } catch (err) {
    return { mode: 'texto', warning: `Embeddings indisponíveis (${err.message}); usando só texto.`, items: byText() };
  }
}

module.exports = { search };
