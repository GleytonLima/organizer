// Operações do sync direto no memory.db (sem marcar "dirty": são o reflexo do servidor).
const crypto = require('crypto');
const { openDb } = require('../memory/db');
const { COLUMNS, toItem } = require('../memory/store');

const db = () => openDb();

const byGid = (gid) => toItem(db().prepare(`SELECT ${COLUMNS} FROM memories WHERE gid = ?`).get(gid));
const gidOf = (id) => db().prepare('SELECT gid FROM memories WHERE id = ?').get(id)?.gid;
const idOf = (gid) => db().prepare('SELECT id FROM memories WHERE gid = ?').get(gid)?.id;

/** Pendências de envio: memórias sujas sem conflito/recusa e exclusões já conhecidas do servidor. */
const dirtyItems = () =>
  db().prepare(`SELECT ${COLUMNS} FROM memories WHERE dirty = 1 AND conflict IS NULL AND sync_error IS NULL ORDER BY rowid`).all().map(toItem);
const tombstones = () => db().prepare('SELECT gid, base_rev FROM sync_deleted').all();

/** Grava a versão do servidor (cria ou sobrescreve) já traduzida em colunas locais. */
function writeServer(gid, rev, row) {
  const cur = db().prepare('SELECT id, text FROM memories WHERE gid = ?').get(gid);
  const cols = { ...row, rev, dirty: 0, conflict: null, sync_error: null };
  if (cur) {
    if (cur.text !== row.text) Object.assign(cols, { embedding: null, embedding_model: null });
    const keys = Object.keys(cols);
    db().prepare(`UPDATE memories SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE gid = ?`).run(...keys.map((k) => cols[k]), gid);
    return cur.id;
  }
  const id = crypto.randomUUID().slice(0, 8);
  const all = { id, gid, ...cols };
  const keys = Object.keys(all);
  db().prepare(`INSERT INTO memories (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`).run(...keys.map((k) => all[k]));
  return id;
}

/** Exclusão vinda do servidor (ou aceita): some localmente, sem tombstone. */
function dropLocal(gid) {
  db().prepare('DELETE FROM memories WHERE gid = ?').run(gid);
  db().prepare('DELETE FROM sync_deleted WHERE gid = ?').run(gid);
}

const markConflict = (gid, server) => db().prepare('UPDATE memories SET conflict = ? WHERE gid = ?').run(JSON.stringify(server), gid);
const markError = (gid, error) => db().prepare('UPDATE memories SET sync_error = ? WHERE gid = ?').run(error, gid);
/** Envio aceito: o rev passa a ser o do servidor; continua sujo se foi editado durante o envio. */
const markSent = (gid, rev, updatedAt) =>
  db().prepare('UPDATE memories SET rev = ?, dirty = CASE WHEN updated_at = ? THEN 0 ELSE 1 END WHERE gid = ?').run(rev, updatedAt, gid);
const forgetTombstone = (gid) => db().prepare('DELETE FROM sync_deleted WHERE gid = ?').run(gid);
/** Resolver conflito ficando com a versão local: reenvia sobre o rev do servidor. */
const keepMine = (gid, serverRev) => db().prepare('UPDATE memories SET rev = ?, conflict = NULL, dirty = 1 WHERE gid = ?').run(serverRev, gid);

const getMeta = (key) => db().prepare('SELECT value FROM sync_meta WHERE key = ?').get(key)?.value ?? null;
const setMeta = (key, value) => db().prepare('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)').run(key, String(value));

module.exports = {
  byGid, gidOf, idOf, dirtyItems, tombstones, writeServer, dropLocal,
  markConflict, markError, markSent, forgetTombstone, keepMine, getMeta, setMeta,
};
