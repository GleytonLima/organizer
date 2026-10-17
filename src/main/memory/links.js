// Vínculos de uma memória e a cadeia de impacto (local, sobre o memory.db), e a marca "a revisar".
// Mesma semântica do servidor: o impacto segue só "depends", até 10 níveis, tolerando ciclos.
const { openDb } = require('./db');
const { COLUMNS, toItem, get, changes } = require('./store');

const MAX_DEPTH = 10;
const byGid = (gid) => toItem(openDb().prepare(`SELECT ${COLUMNS} FROM memories WHERE gid = ?`).get(gid));

/** Quem aponta para `gid` (com o tipo do vínculo). */
function incoming(gid) {
  return openDb()
    .prepare(`SELECT ${COLUMNS.split(', ').map((c) => `m.${c}`).join(', ')}, json_extract(r.value, '$.type') AS link_type
              FROM memories m, json_each(m.refs) r
              WHERE json_extract(r.value, '$.id') = ? ORDER BY m.updated_at DESC`)
    .all(gid)
    .map((row) => ({ type: row.link_type, id: row.gid, memory: toItem(row) }));
}

/** Todas as que dependem de `gid`, direta ou indiretamente: [{ id, depth, via, memory }]. */
function impact(gid) {
  return openDb()
    .prepare(`WITH RECURSIVE impact(gid, depth, via) AS (
                SELECT m.gid, 1, ? FROM memories m, json_each(m.refs) r
                WHERE json_extract(r.value, '$.id') = ? AND json_extract(r.value, '$.type') = 'depends'
                UNION
                SELECT m.gid, i.depth + 1, i.gid FROM impact i, memories m, json_each(m.refs) r
                WHERE json_extract(r.value, '$.id') = i.gid AND json_extract(r.value, '$.type') = 'depends' AND i.depth < ?
              )
              SELECT gid, min(depth) AS depth, via FROM impact WHERE gid <> ? GROUP BY gid ORDER BY depth`)
    .all(gid, gid, MAX_DEPTH, gid)
    .map((r) => ({ id: r.gid, depth: r.depth, via: r.via, memory: byGid(r.gid) }));
}

/** { outgoing, incoming, impact } de uma memória (id curto). `memory` null = fora deste app. */
function links(id) {
  const m = get(id);
  if (!m) throw new Error(`Memória não encontrada: ${id}`);
  return {
    outgoing: m.refs.map((r) => ({ ...r, memory: byGid(r.id) })),
    incoming: incoming(m.gid),
    impact: impact(m.gid),
  };
}

/** Memórias por id curto ou gid, na ordem pedida (as que não existem aqui ficam de fora). */
const many = (refs) => (refs || []).map((r) => toItem(openDb().prepare(`SELECT ${COLUMNS} FROM memories WHERE id = ? OR gid = ?`).get(r, r))).filter(Boolean);

/** Marca memórias (ids curtos) como "a revisar" porque `source` mudou. Sobem no próximo sync. */
function markReview(ids, { reason, source = null }) {
  const review = JSON.stringify({ reason, source: source && get(source)?.gid, at: new Date().toISOString() });
  const stmt = openDb().prepare('UPDATE memories SET review = ?, dirty = 1, updated_at = ? WHERE id = ?');
  const marked = ids.filter((id) => stmt.run(review, Date.now(), id).changes);
  marked.forEach((id) => changes.emit('write', id));
  return { marked };
}

/** Revisada sem mudanças: a marca some (e a confirmação sincroniza). */
function confirmReview(id) {
  const r = openDb().prepare('UPDATE memories SET review = NULL, dirty = 1, updated_at = ? WHERE id = ? AND review IS NOT NULL').run(Date.now(), id);
  if (r.changes) changes.emit('write', id);
  return get(id);
}

module.exports = { links, impact, many, markReview, confirmReview };
