// Eventos para o painel Insights: turnos do agente (duração, tokens, modelo, desfecho), permissões
// (dada/negada, quanto você levou) e comandos do terminal (código de saída, duração). Ficam só nesta
// máquina, em <userData>/metrics.db (node:sqlite), por 180 dias. O fluxo das tarefas vem do histórico
// delas (state.json) — aqui só o que não está lá.
const { ipcMain } = require('electron');
const { DatabaseSync } = require('node:sqlite');
const { userFile } = require('../files');

const KEEP_DAYS = 180;
const KINDS = new Set(['agent.turn', 'agent.permission', 'command']);
let db = null;

function open() {
  if (db) return db;
  db = new DatabaseSync(userFile('metrics.db'));
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id          INTEGER PRIMARY KEY,
      ts          INTEGER NOT NULL,
      kind        TEXT NOT NULL,
      project_id  TEXT,
      task_id     TEXT,
      terminal_id TEXT,
      data        TEXT NOT NULL DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS events_ts ON events(ts, kind);`);
  db.prepare('DELETE FROM events WHERE ts < ?').run(Date.now() - KEEP_DAYS * 86400000);
  return db;
}

const text = (v, max = 64) => (v == null ? null : String(v).slice(0, max));

/** Grava um evento (tipos conhecidos; dados pequenos). Erros não derrubam quem chamou. */
function record(ev) {
  if (!ev || !KINDS.has(ev.kind)) return false;
  const data = JSON.stringify(ev.data ?? {});
  if (data.length > 4000) return false;
  open()
    .prepare('INSERT INTO events (ts, kind, project_id, task_id, terminal_id, data) VALUES (?, ?, ?, ?, ?, ?)')
    .run(Number(ev.ts) || Date.now(), ev.kind, text(ev.projectId), text(ev.taskId), text(ev.terminalId), data);
  return true;
}

/** Eventos desde `since` (ms), opcionalmente de alguns projetos. */
function query({ since = 0, projectIds = null } = {}) {
  const rows = open().prepare('SELECT ts, kind, project_id, task_id, terminal_id, data FROM events WHERE ts >= ? ORDER BY ts').all(Number(since) || 0);
  const keep = projectIds ? new Set(projectIds) : null;
  return rows
    .filter((r) => !keep || keep.has(r.project_id))
    .map((r) => ({ ts: r.ts, kind: r.kind, projectId: r.project_id, taskId: r.task_id, terminalId: r.terminal_id, data: JSON.parse(r.data) }));
}

function registerMetricsIpc() {
  ipcMain.on('metrics:record', (_e, ev) => {
    try {
      record(ev);
    } catch (err) {
      console.error('metrics:record', err.message);
    }
  });
  ipcMain.handle('metrics:query', (_e, opts) => query(opts));
}

function closeMetrics() {
  try {
    db?.close();
  } catch {}
  db = null;
}

module.exports = { registerMetricsIpc, closeMetrics, record, query };
