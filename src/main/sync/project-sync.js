// Sync da definição dos projetos (docs/API.md → "Projeto e layout"), a cada rodada do motor:
//   projeto (do time): nome e colunas por três vias (quem mudou desde a última rodada vence; sem
//     mudança aqui, vale o do servidor); pastas somadas — o desktop nunca tira pasta do time;
//   layout (seu): esta máquina é a fonte; o do servidor só é aplicado ao abrir o projeto nela.
// Estado por workspace em <userData>/sync-projects.json: { base: {name, columns}, layoutVersion, layoutHash }.
const client = require('./client');
const { userFile, readJson, writeJsonAtomic } = require('../files');
const { buildDocs, unionFolders } = require('./project-doc');

const FILE = () => userFile('sync-projects.json');
const hash = (v) => JSON.stringify(v ?? null);
const content = (d) => ({ name: d.name, folders: d.folders, columns: d.columns });

async function syncProject(key, p, st, apply) {
  const { project: local, layout } = await buildDocs(p);
  const server = await client.getDoc(key, 'project');
  if (server && !local.columns.length) local.columns = server.columns; // quadro nunca aberto aqui: sem opinião
  const pick = (field) => (!server || hash(local[field]) !== st.base?.[field] ? local[field] : server[field]);
  const body = { name: pick('name'), folders: unionFolders(server?.folders, local.folders), columns: pick('columns') };
  let synced = !!server && hash(content(server)) === hash(body);
  if (!synced) synced = (await client.putDoc(key, 'project', body, server?.version || 0)).status === 200;
  if (synced) {
    // 409 = alguém gravou entre a leitura e a escrita: a próxima rodada reconcilia
    st.base = { name: hash(body.name), columns: hash(body.columns) };
    const changed = {};
    if (body.name !== local.name) changed.name = body.name;
    if (hash(body.columns) !== hash(local.columns)) changed.columns = body.columns;
    if (Object.keys(changed).length) apply(p.id, changed);
  }

  const lh = hash(layout);
  if (lh === st.layoutHash) return;
  let r = await client.putDoc(key, 'layout', layout, st.layoutVersion || 0);
  // o layout é seu: outra máquina sua gravou antes → a desta máquina vence (é a que você está usando)
  if (r.status === 409) r = await client.putDoc(key, 'layout', layout, r.data.server?.version || 0);
  if (r.status === 200) Object.assign(st, { layoutVersion: r.data.version, layoutHash: lh });
}

/**
 * Uma rodada para os projetos do contexto com syncKey (um por chave). `apply(projectId, { name?,
 * columns? })` leva ao renderer o que veio do servidor.
 */
async function syncProjects(context, apply) {
  const state = readJson(FILE(), {});
  const seen = new Set();
  try {
    for (const p of context.projects || []) {
      const key = String(p.syncKey || '').trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      await syncProject(key, p, (state[key] ||= {}), apply);
    }
  } finally {
    writeJsonAtomic(FILE(), state);
  }
}

/** Ao abrir um projeto vindo do servidor: o que esta máquina tem passa a ser a base das três vias. */
function adoptServerState(key, project, layout) {
  const state = readJson(FILE(), {});
  state[key] = {
    base: { name: hash(project.name), columns: hash(project.columns) },
    ...(layout && { layoutVersion: layout.version }),
  };
  writeJsonAtomic(FILE(), state);
}

module.exports = { syncProjects, adoptServerState };
