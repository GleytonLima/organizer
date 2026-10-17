// Migrações do memory.db (PRAGMA user_version). Cada passo é idempotente.
//   v2  escopos (global | project | folder)
//   v3  sync com o bo-memory-server (gid, rev, dirty, conflict…) e o tipo "progress"
//   v4  vínculos entre memórias (refs) e a marca "a revisar" (review)
//   v5  tipos "idea" e "howto" e o estado da ideia (status); o tipo deixa de ter CHECK no banco
//       (é validado em store.js), para tipos novos não exigirem recriar a tabela
const crypto = require('crypto');

const columns = (db) => new Set(db.prepare('PRAGMA table_info(memories)').all().map((c) => c.name));

// Colunas acrescentadas pelas migrações, na ordem em que surgiram.
const EXTRA_COLUMNS = [
  ['scope', "TEXT NOT NULL DEFAULT 'project'"],
  ['folder', 'TEXT'],
  ['folder_key', 'TEXT'],
  ['gid', 'TEXT'], // id no servidor (uuid)
  ['rev', 'INTEGER NOT NULL DEFAULT 0'], // rev do servidor que esta versão conhece
  ['dirty', 'INTEGER NOT NULL DEFAULT 1'], // mudança local ainda não enviada
  ['conflict', 'TEXT'], // JSON da versão do servidor em conflito
  ['sync_error', 'TEXT'], // recusa do servidor (validação); limpa ao editar
  ['progress', 'TEXT'], // JSON (kind = progress)
  ['author', 'TEXT'], // quem escreveu (vindo do servidor)
  ['remote', 'TEXT'], // remote normalizado (scope = folder)
  ['refs', "TEXT NOT NULL DEFAULT '[]'"], // [{ id: gid, type }]
  ['review', 'TEXT'], // marca "a revisar"
  ['status', 'TEXT'], // ideia: open | converted | discarded
];

function addColumns(db) {
  const cols = columns(db);
  for (const [name, def] of EXTRA_COLUMNS) if (!cols.has(name)) db.exec(`ALTER TABLE memories ADD COLUMN ${name} ${def}`);
  db.exec('CREATE INDEX IF NOT EXISTS memories_scope ON memories(scope, folder_key)');
}

/**
 * Tira o CHECK antigo de `kind` (só note/decision ou note/decision/progress). O SQLite não altera
 * CHECK com ALTER: a tabela é recriada preservando rowid (o FTS aponta para ele); gatilhos e
 * índices voltam pelo SCHEMA (db.js) em seguida.
 */
function dropKindCheck(db, createTable) {
  const sql = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'memories'").get()?.sql || '';
  if (!/CHECK \(kind IN/.test(sql)) return;
  const keep = [...columns(db)].join(', ');
  db.exec('BEGIN');
  try {
    db.exec('ALTER TABLE memories RENAME TO memories_old');
    db.exec('DROP TRIGGER IF EXISTS memories_ai; DROP TRIGGER IF EXISTS memories_ad; DROP TRIGGER IF EXISTS memories_au;');
    db.exec('DROP INDEX IF EXISTS memories_scope; DROP INDEX IF EXISTS memories_project; DROP INDEX IF EXISTS memories_gid;');
    createTable();
    addColumns(db);
    db.exec(`INSERT INTO memories (rowid, ${keep}) SELECT rowid, ${keep} FROM memories_old`);
    db.exec('DROP TABLE memories_old');
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  db.exec("INSERT INTO memories_fts(memories_fts) VALUES ('rebuild')");
}

/** Sync (v3): todo registro ganha um gid; tabelas de exclusões pendentes e de metadados. */
function syncTables(db) {
  for (const { id } of db.prepare('SELECT id FROM memories WHERE gid IS NULL').all()) {
    db.prepare('UPDATE memories SET gid = ? WHERE id = ?').run(crypto.randomUUID(), id);
  }
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS memories_gid ON memories(gid);
    CREATE TABLE IF NOT EXISTS sync_deleted (gid TEXT PRIMARY KEY, base_rev INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sync_meta (key TEXT PRIMARY KEY, value TEXT);
  `);
}

function migrate(db, createTable) {
  const version = db.prepare('PRAGMA user_version').get().user_version;
  if (version >= 5) return addColumns(db);
  dropKindCheck(db, createTable);
  addColumns(db);
  syncTables(db);
  db.exec("UPDATE memories SET status = 'open' WHERE kind = 'idea' AND status IS NULL");
}

module.exports = { migrate };
