// Migrações do memory.db (PRAGMA user_version). Cada passo é idempotente.
const crypto = require('crypto');

const columns = (db) => new Set(db.prepare('PRAGMA table_info(memories)').all().map((c) => c.name));
const addColumn = (db, cols, name, def) => !cols.has(name) && db.exec(`ALTER TABLE memories ADD COLUMN ${name} ${def}`);

/** v2: escopos (global | project | folder). Memórias antigas continuam como "project". */
function v2(db) {
  const cols = columns(db);
  addColumn(db, cols, 'scope', "TEXT NOT NULL DEFAULT 'project'");
  addColumn(db, cols, 'folder', 'TEXT');
  addColumn(db, cols, 'folder_key', 'TEXT');
  db.exec('CREATE INDEX IF NOT EXISTS memories_scope ON memories(scope, folder_key)');
}

/**
 * v3: sincronização com o bo-memory-server e o tipo "progress".
 * O CHECK de `kind` não muda com ALTER no SQLite: a tabela é recriada preservando rowid (o FTS
 * aponta para ele) e os gatilhos voltam pelo SCHEMA em seguida.
 */
function v3(db, createTable) {
  const sql = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'memories'").get()?.sql || '';
  if (!sql.includes("'progress'")) {
    const keep = [...columns(db)].join(', ');
    db.exec('BEGIN');
    try {
      db.exec('ALTER TABLE memories RENAME TO memories_v2');
      db.exec('DROP TRIGGER IF EXISTS memories_ai; DROP TRIGGER IF EXISTS memories_ad; DROP TRIGGER IF EXISTS memories_au;');
      createTable();
      v2(db); // colunas de escopo na tabela nova
      db.exec(`INSERT INTO memories (rowid, ${keep}) SELECT rowid, ${keep} FROM memories_v2`);
      db.exec('DROP TABLE memories_v2'); // leva junto os índices antigos; v2 e o SCHEMA os recriam
      v2(db);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
  const cols = columns(db);
  addColumn(db, cols, 'gid', 'TEXT'); // id no servidor (uuid)
  addColumn(db, cols, 'rev', 'INTEGER NOT NULL DEFAULT 0'); // rev do servidor que esta versão conhece
  addColumn(db, cols, 'dirty', 'INTEGER NOT NULL DEFAULT 1'); // mudança local ainda não enviada
  addColumn(db, cols, 'conflict', 'TEXT'); // JSON da versão do servidor em conflito
  addColumn(db, cols, 'sync_error', 'TEXT'); // recusa do servidor (validação); limpa ao editar
  addColumn(db, cols, 'progress', 'TEXT'); // JSON (kind = progress)
  addColumn(db, cols, 'author', 'TEXT'); // quem escreveu (vindo do servidor)
  addColumn(db, cols, 'remote', 'TEXT'); // remote normalizado (scope = folder)
  for (const { id } of db.prepare('SELECT id FROM memories WHERE gid IS NULL').all()) {
    db.prepare('UPDATE memories SET gid = ? WHERE id = ?').run(crypto.randomUUID(), id);
  }
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS memories_gid ON memories(gid);
    CREATE TABLE IF NOT EXISTS sync_deleted (gid TEXT PRIMARY KEY, base_rev INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sync_meta (key TEXT PRIMARY KEY, value TEXT);
    INSERT INTO memories_fts(memories_fts) VALUES ('rebuild');
  `);
}

function migrate(db, createTable) {
  const version = db.prepare('PRAGMA user_version').get().user_version;
  v2(db);
  if (version < 3) v3(db, createTable);
}

module.exports = { migrate };
