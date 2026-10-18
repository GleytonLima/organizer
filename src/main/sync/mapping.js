// Tradução memória local (memory.db) ⇄ memória do servidor (docs/API.md → "Mapeamento no desktop").
//   project → workspace = syncKey do projeto (sem syncKey: fica só local)
//   folder  → remote git normalizado da pasta (sem remote: fica só local)
//   global  → vai para todo o time
const { folderKey } = require('../memory/scope');
const { remoteOf } = require('./remote');

/**
 * "Mundo" de uma rodada de sync, a partir do contexto que o renderer envia:
 * { projects: [{ id, name, syncKey, folders: [caminho] }] }.
 */
async function buildWorld(context) {
  const world = { keyOf: new Map(), projectOf: new Map(), remoteOf: new Map(), pathOf: new Map() };
  for (const p of context.projects || []) {
    const key = String(p.syncKey || '').trim();
    if (key) {
      world.keyOf.set(p.id, key);
      if (!world.projectOf.has(key)) world.projectOf.set(key, p);
    }
    for (const dir of p.folders || []) {
      const remote = await remoteOf(dir);
      if (!remote) continue;
      world.remoteOf.set(folderKey(dir), remote);
      if (!world.pathOf.has(remote)) world.pathOf.set(remote, dir);
    }
  }
  const byText = (a, b) => a.localeCompare(b);
  world.workspaces = [...new Set(world.keyOf.values())].sort(byText);
  world.folders = [...world.pathOf.keys()].sort(byText);
  return world;
}

/** Memória local (item do store) → corpo para o servidor; null se ela não sincroniza. */
function toServer(item, world, gidOf) {
  const m = {
    id: item.gid,
    kind: item.kind,
    scope: item.scope,
    workspace: null,
    folder: null,
    text: item.text,
    tags: item.tags,
    taskKey: item.taskKey || null,
    supersededBy: item.supersededBy ? gidOf(item.supersededBy) || null : null,
    progress: item.progress || null,
    refs: item.refs || [],
    review: item.review || null,
    status: item.status || null,
  };
  if (item.scope === 'project') {
    m.workspace = world.keyOf.get(item.projectId) || null;
    if (!m.workspace) return null;
  } else if (item.scope === 'folder') {
    m.folder = world.remoteOf.get(folderKey(item.folder)) || item.remote || null;
    if (!m.folder) return null;
  }
  return m;
}

const ms = (iso) => (iso ? Date.parse(iso) || Date.now() : Date.now());

/**
 * Memória do servidor → colunas locais; null se não há onde guardá-la (workspace/pasta desconhecidos).
 * `local`: a linha atual (mantém a pasta local quando o remote não está mais em nenhum projeto).
 */
function fromServer(s, world, local, idOf) {
  const row = {
    kind: s.kind,
    scope: s.scope,
    text: s.text,
    tags: (s.tags || []).join(','),
    task_key: s.taskKey || null,
    superseded_by: s.supersededBy ? idOf(s.supersededBy) || null : null,
    progress: s.progress ? JSON.stringify(s.progress) : null,
    author: s.author ? JSON.stringify(s.author) : null,
    refs: JSON.stringify(s.refs || []),
    review: s.review ? JSON.stringify(s.review) : null,
    status: s.status || null,
    source: s.author?.name || local?.source || null,
    project_id: null,
    project: null,
    folder: null,
    folder_key: null,
    remote: null,
    created_at: ms(s.createdAt),
    updated_at: ms(s.updatedAt),
  };
  if (s.scope === 'project') {
    const p = world.projectOf.get(s.workspace);
    if (!p) return null;
    Object.assign(row, { project_id: p.id, project: p.name });
  } else if (s.scope === 'folder') {
    const dir = world.pathOf.get(s.folder) || local?.folder;
    if (!dir) return null;
    Object.assign(row, { folder: dir, folder_key: folderKey(dir), remote: s.folder, project_id: local?.projectId || null });
  }
  return row;
}

const CONTENT = ['kind', 'scope', 'workspace', 'folder', 'text', 'taskKey', 'supersededBy', 'status'];

// JSON com chaves ordenadas: o jsonb do PostgreSQL devolve as chaves em outra ordem.
function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (!v || typeof v !== 'object') return JSON.stringify(v ?? null);
  const keys = Object.keys(v).sort((a, b) => a.localeCompare(b));
  return `{${keys.map((k) => JSON.stringify(k) + ':' + canonical(v[k])).join(',')}}`;
}

/** Mesmo conteúdo (o que o servidor compara): evita conflito falso quando os dois lados convergiram. */
function sameContent(mine, server) {
  if (!mine) return false;
  if (CONTENT.some((k) => (mine[k] ?? null) !== (server[k] ?? null))) return false;
  if ((mine.tags || []).join(',') !== (server.tags || []).join(',')) return false;
  return ['progress', 'refs', 'review'].every((k) => canonical(k === 'refs' ? mine[k] || [] : mine[k]) === canonical(k === 'refs' ? server[k] || [] : server[k]));
}

module.exports = { buildWorld, toServer, fromServer, sameContent, canonical };
