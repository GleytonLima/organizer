// Feedback qualitativo: o seu texto sobre uma tarefa (ou, depois, uma tag/entrega), com um rótulo
// opcional e uma foto do contexto daquele momento (coluna, tags, lead time, esperas, tokens…).
// Fica no metrics.db, local; sai por exportação JSONL — uma linha por feedback, texto e números
// lado a lado, para análise qualitativa (métodos mistos).
const fs = require('node:fs');
const { ipcMain, dialog } = require('electron');
const { open } = require('./index');
const { getWindow } = require('../window');

const TARGETS = new Set(['task', 'tag']);
const LABELS = new Set(['first', 'adjusted', 'redo']);
const MAX_TEXT = 10000;

function table() {
  const db = open();
  db.exec(`
    CREATE TABLE IF NOT EXISTS feedback (
      id          INTEGER PRIMARY KEY,
      ts          INTEGER NOT NULL,
      target_type TEXT NOT NULL,
      target_id   TEXT NOT NULL,
      project_id  TEXT,
      text        TEXT NOT NULL,
      label       TEXT,
      context     TEXT NOT NULL DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS feedback_target ON feedback(target_type, target_id, ts);`);
  return db;
}

const row = (r) => ({ id: r.id, ts: r.ts, targetType: r.target_type, targetId: r.target_id, projectId: r.project_id, text: r.text, label: r.label, context: JSON.parse(r.context) });

/** Grava um feedback; devolve o registro. Valida alvo, rótulo e tamanho. */
function addFeedback({ targetType, targetId, projectId = null, text, label = null, context = {} }) {
  if (!TARGETS.has(targetType) || !targetId) throw new Error('Feedback sem alvo (tarefa ou tag).');
  const clean = String(text || '').trim();
  if (!clean && !label) throw new Error('Escreva o feedback ou escolha um rótulo.');
  if (clean.length > MAX_TEXT) throw new Error(`Feedback longo demais (máx. ${MAX_TEXT} caracteres).`);
  if (label && !LABELS.has(label)) throw new Error('Rótulo desconhecido.');
  const ctx = JSON.stringify(context ?? {});
  const r = table()
    .prepare('INSERT INTO feedback (ts, target_type, target_id, project_id, text, label, context) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *')
    .get(Date.now(), targetType, String(targetId).slice(0, 120), projectId, clean, label, ctx.length > 20000 ? '{}' : ctx);
  return row(r);
}

/** Feedbacks de um alvo (mais recentes primeiro), ou de todos desde `since` (exportação). */
function listFeedback({ targetType, targetId, since = 0 } = {}) {
  const db = table();
  const rows = targetType
    ? db.prepare('SELECT * FROM feedback WHERE target_type = ? AND target_id = ? ORDER BY ts DESC').all(targetType, String(targetId))
    : db.prepare('SELECT * FROM feedback WHERE ts >= ? ORDER BY ts').all(Number(since) || 0);
  return rows.map(row);
}

const removeFeedback = (id) => table().prepare('DELETE FROM feedback WHERE id = ?').run(Number(id)).changes > 0;

/** Exporta para um .jsonl escolhido por você (diálogo de salvar); devolve { path, count } ou null. */
async function exportFeedback() {
  const items = listFeedback();
  const stamp = new Date().toISOString().slice(0, 10);
  const r = await dialog.showSaveDialog(getWindow(), {
    title: 'Exportar feedback',
    defaultPath: `feedback-bash-organizer-${stamp}.jsonl`,
    filters: [{ name: 'JSON Lines', extensions: ['jsonl'] }],
  });
  if (r.canceled || !r.filePath) return null;
  const lines = items.map((f) => JSON.stringify({ ...f, at: new Date(f.ts).toISOString() }));
  fs.writeFileSync(r.filePath, lines.join('\n') + (lines.length ? '\n' : ''));
  return { path: r.filePath, count: items.length };
}

function registerFeedbackIpc() {
  ipcMain.handle('feedback:add', (_e, f) => addFeedback(f));
  ipcMain.handle('feedback:list', (_e, q) => listFeedback(q));
  ipcMain.handle('feedback:remove', (_e, id) => removeFeedback(id));
  ipcMain.handle('feedback:export', () => exportFeedback());
}

module.exports = { registerFeedbackIpc, addFeedback, listFeedback, removeFeedback, exportFeedback };
