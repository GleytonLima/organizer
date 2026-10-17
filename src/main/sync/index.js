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

  engine.events.on('status', (s) => sendToWindow('sync:status', s));
  engine.events.on('changed', () => sendToWindow('memory:changed'));
  store.changes.on('write', engine.afterWrite);
  engine.schedule(3000); // primeira rodada logo depois que a janela envia os projetos
}

module.exports = { registerSyncIpc, stopSync: engine.stop };
