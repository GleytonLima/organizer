// Banco da memória: SQLite embutido no runtime (node:sqlite), com busca full-text FTS5.
// Arquivo: <userData>/memory.db — separado do state.json e persistente entre sessões.
const { DatabaseSync } = require('node:sqlite');
const { userFile } = require('../files');

const SCHEMA_VERSION = 1;
let db = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS memories (
  id            TEXT PRIMARY KEY,
  project_id    TEXT,
  project       TEXT,              -- nome do projeto no momento (para leitura humana)
  repo          TEXT,              -- repositório (projetos multi-repo)
  kind          TEXT NOT NULL CHECK (kind IN ('note', 'decision')),
  text          TEXT NOT NULL,
  tags          TEXT NOT NULL DEFAULT '',
  source        TEXT,              -- 'agente' | 'você' | nome do terminal
  task_key      TEXT,
  superseded_by TEXT,              -- decisão substituída por outra
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  embedding     BLOB,              -- Float32Array (opcional)
  embedding_model TEXT
);
CREATE INDEX IF NOT EXISTS memories_project ON memories(project_id, kind, updated_at);

CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
  text, tags, repo,
  content = 'memories', content_rowid = 'rowid',
  tokenize = 'unicode61 remove_diacritics 2'
);
CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
  INSERT INTO memories_fts(rowid, text, tags, repo) VALUES (new.rowid, new.text, new.tags, new.repo);
END;
CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
  INSERT INTO memories_fts(memories_fts, rowid, text, tags, repo) VALUES ('delete', old.rowid, old.text, old.tags, old.repo);
END;
CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE OF text, tags, repo ON memories BEGIN
  INSERT INTO memories_fts(memories_fts, rowid, text, tags, repo) VALUES ('delete', old.rowid, old.text, old.tags, old.repo);
  INSERT INTO memories_fts(rowid, text, tags, repo) VALUES (new.rowid, new.text, new.tags, new.repo);
END;
`;

function openDb() {
  if (db) return db;
  db = new DatabaseSync(userFile('memory.db'));
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  return db;
}

function closeDb() {
  try {
    db?.close();
  } catch {}
  db = null;
}

module.exports = { openDb, closeDb };
