// Operações da memória: notas, decisões (uma frase, com o porquê) e progresso de tarefa, com escopo
// (ver scope.js). Toda escrita marca a memória como pendente de sync (dirty) e avisa `changes`.
const crypto = require('crypto');
const { EventEmitter } = require('events');
const { openDb } = require('./db');
const { normalizeScope, contextClause } = require('./scope');
const { resolveRefs } = require('./refs');
const { contentTerms } = require('./stopwords');

const DECISION_MAX = 280;
const KINDS = ['note', 'decision', 'progress', 'idea', 'howto'];
const IDEA_STATUS = ['open', 'converted', 'discarded'];
const PROGRESS_STATUS = ['open', 'done']; // done = a tarefa foi concluída: progresso arquivado
const STATUSES = { idea: IDEA_STATUS, progress: PROGRESS_STATUS };
const changes = new EventEmitter(); // 'write' após cada gravação local (o sync agenda um envio)
const COLUMNS = 'id, scope, folder, project_id, project, repo, kind, text, tags, source, task_key, superseded_by, created_at, updated_at, embedding_model, gid, rev, dirty, conflict, sync_error, progress, author, remote, refs, review, status';

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

const parse = (json) => (json ? JSON.parse(json) : null);
const wrote = (id) => {
  changes.emit('write', id);
  return get(id);
};

const toItem = (r) =>
  r && {
    id: r.id,
    scope: r.scope,
    folder: r.folder,
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
    gid: r.gid,
    rev: r.rev,
    dirty: !!r.dirty,
    conflict: parse(r.conflict), // versão do servidor quando há conflito
    syncError: r.sync_error,
    progress: parse(r.progress),
    author: parse(r.author),
    remote: r.remote,
    refs: parse(r.refs) || [], // [{ id: gid, type: depends | related | contradicts }]
    review: parse(r.review), // marca "a revisar": { reason, source, by?, at }
    status: r.status, // ideia: open | converted | discarded; progresso: open | done
  };

function get(id) {
  return toItem(openDb().prepare(`SELECT ${COLUMNS} FROM memories WHERE id = ?`).get(id));
}

/**
 * Cria uma memória. `scope`: 'project' (padrão) | 'folder' (com `folder`) | 'global'.
 * `supersedes`: id de uma decisão anterior que esta substitui.
 */
function add({ scope, folder = null, projectId = null, project = null, repo = null, kind = 'note', text, tags, source = null, taskKey = null, supersedes = null, progress = null, refs = [] }) {
  const clean = String(text || '').trim();
  if (!clean) throw new Error('A memória precisa de um texto.');
  if (!KINDS.includes(kind)) throw new Error(`Tipo inválido: use ${KINDS.join(', ')}.`);
  if (kind === 'decision') validateDecision(clean);
  if (kind === 'progress') {
    if (!taskKey) throw new Error('Progresso precisa da tarefa (taskKey).');
    scope = 'project'; // progresso é sempre do projeto
  }
  // Valida antes de gravar: um supersedes inválido não pode deixar a decisão nova registrada.
  if (supersedes && !get(supersedes)) throw new Error(`Decisão a substituir não encontrada: ${supersedes}`);
  const sc = normalizeScope({ scope, projectId, folder });
  const id = crypto.randomUUID().slice(0, 8);
  const gid = crypto.randomUUID();
  const links = JSON.stringify(resolveRefs(refs, gid));
  const t = now();
  const db = openDb();
  db.prepare(`INSERT INTO memories (id, gid, refs, status, scope, folder, folder_key, project_id, project, repo, kind, text, tags, source, task_key, progress, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, gid, links, kind === 'idea' ? 'open' : null, sc.scope, sc.folder, sc.folderKey, sc.projectId, sc.scope === 'global' ? null : project, repo, kind, clean, normTags(tags), source, taskKey, progress ? JSON.stringify(progress) : null, t, t);
  if (supersedes) {
    db.prepare('UPDATE memories SET superseded_by = ?, updated_at = ?, dirty = 1 WHERE id = ?').run(id, t, supersedes);
  }
  return wrote(id);
}

/**
 * Edita texto, tags, repo, escopo (`scope`, `folder`, `projectId`), `progress` e/ou `refs`.
 * Editar é revisar: a marca "a revisar" some.
 */
function update(id, { text, tags, repo, scope, folder, projectId, progress, refs, status, taskKey }) {
  const cur = get(id);
  if (!cur) throw new Error(`Memória não encontrada: ${id}`);
  const next = { text: text != null ? String(text).trim() : cur.text, tags: tags != null ? normTags(tags) : cur.tags.join(','), repo: repo ?? cur.repo };
  if (cur.kind === 'decision') validateDecision(next.text);
  const sc = normalizeScope({ scope: scope ?? cur.scope, folder: folder ?? cur.folder, projectId: projectId ?? cur.projectId });
  const changedText = next.text !== cur.text;
  const prog = progress !== undefined ? progress : cur.progress;
  const links = refs !== undefined ? resolveRefs(refs, cur.gid) : cur.refs;
  if (status !== undefined && !STATUSES[cur.kind]?.includes(status)) {
    throw new Error(STATUSES[cur.kind] ? `Estado inválido: use ${STATUSES[cur.kind].join(', ')}.` : 'Estado só vale para ideias e progresso.');
  }
  openDb()
    .prepare(`UPDATE memories SET text = ?, tags = ?, repo = ?, scope = ?, folder = ?, folder_key = ?, project_id = ?, progress = ?, refs = ?, status = ?, task_key = ?, review = NULL,
              updated_at = ?, dirty = 1, sync_error = NULL${changedText ? ', embedding = NULL, embedding_model = NULL' : ''} WHERE id = ?`)
    .run(next.text, next.tags, next.repo, sc.scope, sc.folder, sc.folderKey, sc.projectId, prog ? JSON.stringify(prog) : null, JSON.stringify(links), status ?? cur.status ?? null, taskKey !== undefined ? taskKey : cur.taskKey, now(), id);
  return wrote(id);
}

/** Apaga; se o servidor já conhecia a memória, fica um tombstone para o próximo envio. */
function remove(id) {
  const db = openDb();
  const row = db.prepare('SELECT gid, rev FROM memories WHERE id = ?').get(id);
  if (!row) throw new Error(`Memória não encontrada: ${id}`);
  db.prepare('DELETE FROM memories WHERE id = ?').run(id);
  if (row.rev > 0) db.prepare('INSERT OR REPLACE INTO sync_deleted (gid, base_rev) VALUES (?, ?)').run(row.gid, row.rev);
  changes.emit('write', id);
  return { removed: id };
}

/**
 * Filtro comum. `context` = { projectId, folders } → o que vale para o projeto (global + projeto + pastas);
 * `scope` restringe a um escopo; `kind`, `repo`; decisões substituídas ficam de fora por padrão.
 */
function filters({ context, projectId, scope, kind, repo, taskKey, needsReview = false, includeSuperseded = false }, alias = '') {
  const where = [];
  const args = [];
  const col = (c) => (alias ? `${alias}.${c}` : c);
  const equals = (c, value) => {
    if (!value) return;
    where.push(`${col(c)} = ?`);
    args.push(value);
  };
  const ctx = contextClause(context || (projectId && { projectId, folders: [] }), col);
  if (ctx) {
    where.push(ctx.sql);
    args.push(...ctx.args);
  }
  equals('scope', scope);
  equals('kind', kind);
  equals('repo', repo);
  equals('task_key', taskKey);
  if (!includeSuperseded) where.push(`${col('superseded_by')} IS NULL`);
  if (needsReview) where.push(`${col('review')} IS NOT NULL`);
  // ideias que viraram tarefa ou foram descartadas, e progresso de tarefa concluída, só no filtro do próprio tipo
  if (kind !== 'idea' && kind !== 'progress') where.push(`coalesce(${col('status')}, 'open') = 'open'`);
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

/** Converte texto livre numa consulta FTS5 segura: termos com prefixo (sem stopwords), unidos por OR (o bm25 ordena). */
function ftsQuery(text) {
  const terms = contentTerms(String(text || '').match(/[\p{L}\p{N}_-]+/gu) || []);
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

module.exports = { add, update, remove, get, list, searchText, filters, toItem, changes, COLUMNS, DECISION_MAX };
