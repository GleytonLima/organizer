// Projeto local → documentos do servidor (docs/API.md → "Projeto e layout"):
//   projeto (do workspace): nome, pastas pelo remote (com a URL de clone) e colunas do quadro;
//   layout (seu): grupos e terminais, cada terminal pela pasta (remote) + subpasta relativa.
// Pastas sem remote não vão (não há como achá-las em outra máquina).
const path = require('path');
const { remoteOf, cloneUrlOf } = require('./remote');

const norm = (p) => path.resolve(String(p || '')).toLowerCase();

/** [{ name, path, remote, url }] das pastas do projeto que têm remote. */
async function remoteFolders(project) {
  const out = [];
  for (const r of project.repos || []) {
    const remote = await remoteOf(r.path);
    if (remote && !out.some((f) => f.remote === remote)) out.push({ name: r.name || path.basename(r.path), path: r.path, remote, url: await cloneUrlOf(r.path) });
  }
  return out;
}

/** Pasta do projeto que contém `cwd` (a mais específica) → { folder: remote, subdir }. */
function placeTerminal(cwd, folders) {
  const dir = norm(cwd);
  let best = null;
  for (const f of folders) {
    const base = norm(f.path);
    if ((dir === base || dir.startsWith(base + path.sep)) && (!best || base.length > norm(best.path).length)) best = f;
  }
  if (!best) return { folder: '', subdir: '' };
  return { folder: best.remote, subdir: path.relative(best.path, cwd).split(path.sep).join('/') };
}

/** { project, layout, folders } para um projeto do contexto (com syncKey). */
async function buildDocs(p) {
  const folders = await remoteFolders(p);
  const project = {
    name: p.name,
    folders: folders.map(({ name, remote, url }) => ({ name, remote, url })),
    columns: (p.columns || []).map(({ id, name, description }) => ({ id, name, description: description || '' })),
  };
  const layout = {
    groups: (p.groups || []).map((g) => ({
      name: g.name,
      terminals: (g.terminals || []).map((t) => ({ name: t.name || '', ...placeTerminal(t.cwd, folders), startup: t.startup || '', color: t.color ?? null })),
    })),
  };
  return { project, layout, folders };
}

/** Pastas do servidor somadas às locais (pelo remote): o desktop nunca tira pasta do projeto do time. */
function unionFolders(server = [], local = []) {
  const out = server.map((f) => ({ ...f }));
  for (const f of local) {
    const i = out.findIndex((x) => x.remote === f.remote);
    if (i < 0) out.push(f);
    else out[i] = { ...out[i], name: f.name || out[i].name, url: f.url || out[i].url };
  }
  return out;
}

module.exports = { buildDocs, unionFolders, placeTerminal };
