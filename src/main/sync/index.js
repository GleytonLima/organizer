// IPC do sync da memória com o bo-memory-server: configuração, contexto dos projetos,
// estado, resolução de conflitos e "Retomar" (claim) de uma tarefa com progresso.
const { ipcMain } = require('electron');
const { sendToWindow } = require('../window');
const store = require('../memory/store');
const client = require('./client');
const rows = require('./rows');
const engine = require('./engine');
const { clearRemoteCache } = require('./remote');
const { publicSyncSettings, saveSyncSettings, syncEnabled } = require('./settings');
const { buildWorld } = require('./mapping');
const { locateFolders, cloneRepo } = require('./locate');
const { adoptServerState } = require('./project-sync');
const { registerTasksSyncIpc } = require('./tasks-ipc');

/** Projetos do servidor que você pode abrir nesta máquina. */
async function remoteProjects() {
  if (!syncEnabled()) throw new Error('Configure o servidor de memória para abrir projetos de lá.');
  return (await client.workspaces()).filter((w) => w.hasProject).map(({ key, name }) => ({ key, name }));
}

/**
 * Projeto e seu layout no servidor, com as pastas já localizadas nesta máquina:
 * { project, layout, located: { remote: caminho } }. `known`: pastas que você já tem em projetos.
 */
async function fetchRemoteProject(key, { known = [], bases = [] } = {}) {
  const project = await client.getDoc(key, 'project');
  if (!project) throw new Error(`O projeto "${key}" ainda não está no servidor.`);
  const layout = await client.getDoc(key, 'layout');
  const located = await locateFolders(project.folders.map((f) => f.remote), known, bases);
  return { project, layout, located };
}

/**
 * Resolve o conflito de uma memória: 'mine' (reenvia a sua), 'server' (aceita a do servidor)
 * ou 'merge' (grava `text` como mescla e a envia).
 */
async function resolveConflict(id, choice, text) {
  const item = store.get(id);
  if (!item?.conflict) throw new Error('Esta memória não está em conflito.');
  const server = item.conflict;
  if (choice === 'server') {
    if (server.deleted) rows.dropLocal(item.gid);
    else engine.restore(server, await buildWorld(engine.getContext()));
  } else {
    if (choice === 'merge') store.update(id, { text });
    else if (choice !== 'mine') throw new Error(`Escolha inválida: ${choice}`);
    rows.keepMine(item.gid, server.rev);
  }
  engine.afterWrite();
  return store.get(id);
}

/** "Retomar": você passa a ser o dono da tarefa no servidor; a memória local é atualizada. */
async function claim(id) {
  const item = store.get(id);
  if (item?.kind !== 'progress') throw new Error('Só memórias de progresso podem ser retomadas.');
  if (!syncEnabled()) throw new Error('Configure o servidor de memória para retomar tarefas de outros devs.');
  const world = await buildWorld(engine.getContext());
  const workspace = world.keyOf.get(item.projectId);
  if (!workspace) throw new Error('O projeto desta tarefa não tem chave de sincronização.');
  if (item.dirty) await engine.syncNow(); // seu progresso local primeiro
  const server = await client.claim(workspace, item.taskKey);
  engine.restore(server, world);
  return store.get(id);
}

function registerSyncIpc() {
  registerTasksSyncIpc();
  ipcMain.handle('sync:settings', () => publicSyncSettings());
  ipcMain.handle('sync:saveSettings', (_e, s) => {
    const saved = saveSyncSettings(s);
    clearRemoteCache();
    engine.schedule(100);
    return saved;
  });
  ipcMain.handle('sync:test', () => client.me());
  ipcMain.handle('sync:status', () => engine.getStatus());
  ipcMain.handle('sync:now', () => engine.syncNow());
  ipcMain.on('sync:context', (_e, ctx) => engine.setContext(ctx));
  ipcMain.handle('sync:resolve', (_e, id, choice, text) => resolveConflict(id, choice, text));
  ipcMain.handle('sync:claim', (_e, id) => claim(id));
  ipcMain.handle('sync:remoteProjects', () => remoteProjects());
  ipcMain.handle('sync:fetchProject', (_e, key, opts) => fetchRemoteProject(key, opts));
  ipcMain.handle('sync:clone', (_e, url, dir) => cloneRepo(url, dir));
  ipcMain.handle('sync:adoptProject', (_e, key, project, layout) => adoptServerState(key, project, layout));

  engine.events.on('status', (s) => sendToWindow('sync:status', s));
  engine.events.on('changed', () => sendToWindow('memory:changed'));
  engine.events.on('project', (id, changed) => sendToWindow('sync:project', id, changed));
  store.changes.on('write', engine.afterWrite);
  engine.schedule(3000); // primeira rodada logo depois que a janela envia os projetos
}

module.exports = { registerSyncIpc, stopSync: engine.stop };
