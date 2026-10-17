// Operações da memória: notas e decisões (uma frase, com o porquê).
const crypto = require('crypto');
const { openDb } = require('./db');

const DECISION_MAX = 280;
const COLUMNS = 'id, project_id, project, repo, kind, text, tags, source, task_key, superseded_by, created_at, updated_at, embedding_model';

const now = () => Date.now();
const normTags = (tags) => (Array.isArray(tags) ? tags : String(tags || '').split(','))
  .map((t) => t.trim().toLowerCase())
  .filter(Boolean)
  .join(',');

/** Uma decisão cabe numa frase: sem quebras de linha e curta. */
function validateDecision(text) {
  if (/\n/.test(text)) throw new Error('Uma decisão deve caber numa frase (sem quebras de linha).');
  if (text.length > DECISION_MAX) throw new Error(`Uma decisão deve caber numa frase (máx. ${DECISION_MAX} caracteres; tem ${text.length}).`);
}

const toItem = (r) =>
  r && {
    id: r.id,
    projectId: r.project_id,
    project: r.project,
    repo: r.repo,
    kind: r.kind,
    text: r.text,
    tags: r.tags ? r.tags.split(',') : [],
    source: r.source,
    taskKey: r.task_key,
    supersededBy: r.superseded_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    embedded: !!r.embedding_model,
  };

function get(id) {
  return toItem(openDb().prepare(`SELECT ${COLUMNS} FROM memories WHERE id = ?`).get(id));
}

/** Cria uma memória. `supersedes`: id de uma decisão anterior que esta substitui. */
function add({ projectId = null, project = null, repo = null, kind = 'note', text, tags, source = null, taskKey = null, supersedes = null }) {
  const clean = String(text || '').trim();
  if (!clean) throw new Error('A memória precisa de um texto.');
  if (!['note', 'decision'].includes(kind)) throw new Error('Tipo inválido: use "note" ou "decision".');
  if (kind === 'decision') validateDecision(clean);
  const id = crypto.randomUUID().slice(0, 8);
  const t = now();
  const db = openDb();
  db.prepare(`INSERT INTO memories (id, project_id, project, repo, kind, text, tags, source, task_key, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, projectId, project, repo, kind, clean, normTags(tags), source, taskKey, t, t);
  if (supersedes) {
    const old = get(supersedes);
    if (!old) throw new Error(`Decisão a substituir não encontrada: ${supersedes}`);
    db.prepare('UPDATE memories SET superseded_by = ?, updated_at = ? WHERE id = ?').run(id, t, supersedes);
  }
  return get(id);
}

function update(id, { text, tags, repo }) {
  const cur = get(id);
  if (!cur) throw new Error(`Memória não encontrada: ${id}`);
  const next = { text: text != null ? String(text).trim() : cur.text, tags: tags != null ? normTags(tags) : cur.tags.join(','), repo: repo ?? cur.repo };
  if (cur.kind === 'decision') validateDecision(next.text);
  const changedText = next.text !== cur.text;
  openDb()
    .prepare(`UPDATE memories SET text = ?, tags = ?, repo = ?, updated_at = ?${changedText ? ', embedding = NULL, embedding_model = NULL' : ''} WHERE id = ?`)
    .run(next.text, next.tags, next.repo, now(), id);
  return get(id);
}

function remove(id) {
  const r = openDb().prepare('DELETE FROM memories WHERE id = ?').run(id);
  if (!r.changes) throw new Error(`Memória não encontrada: ${id}`);
  return { removed: id };
}

/** Filtro comum: projeto, tipo, repo e se inclui decisões substituídas. */
function filters({ projectId, kind, repo, includeSuperseded = false }, alias = '') {
  const where = [];
  const args = [];
  const col = (c) => (alias ? `${alias}.${c}` : c);
  const equals = (c, value) => {
    if (!value) return;
    where.push(`${col(c)} = ?`);
    args.push(value);
  };
  equals('project_id', projectId);
  equals('kind', kind);
  equals('repo', repo);
  if (!includeSuperseded) where.push(`${col('superseded_by')} IS NULL`);
  return { sql: where.length ? where.join(' AND ') : '1 = 1', args };
}

/** Mais recentes primeiro. */
function list(opts = {}) {
  const f = filters(opts);
  return openDb()
    .prepare(`SELECT ${COLUMNS} FROM memories WHERE ${f.sql} ORDER BY updated_at DESC LIMIT ?`)
    .all(...f.args, opts.limit || 50)
    .map(toItem);
}

/** Converte texto livre numa consulta FTS5 segura: termos com prefixo, unidos por OR (o bm25 ordena). */
function ftsQuery(text) {
  const terms = String(text || '').match(/[\p{L}\p{N}_-]+/gu) || [];
  return terms.map((t) => `"${t.replace(/"/g, '')}"*`).join(' OR ');
}

/** Busca full-text (bm25). Retorna [{ ...item, score }]. */
function searchText(query, opts = {}) {
  const q = ftsQuery(query);
  if (!q) return list(opts);
  const f = filters(opts, 'm');
  return openDb()
    .prepare(`SELECT ${COLUMNS.split(', ').map((c) => `m.${c}`).join(', ')}, bm25(memories_fts) AS score
              FROM memories_fts JOIN memories m ON m.rowid = memories_fts.rowid
              WHERE memories_fts MATCH ? AND ${f.sql}
              ORDER BY score LIMIT ?`)
    .all(q, ...f.args, opts.limit || 20)
    .map((r) => ({ ...toItem(r), score: r.score }));
}

module.exports = { add, update, remove, get, list, searchText, filters, toItem, COLUMNS, DECISION_MAX };
