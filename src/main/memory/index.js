// IPC da memória: o renderer resolve projeto/repo/origem e chama estas operações.
const { ipcMain } = require('electron');
const store = require('./store');
const { search } = require('./search');
const embeddings = require('./embeddings');
const { closeDb } = require('./db');

// Vetoriza em segundo plano depois de gravar; uma falha do provedor não afeta a gravação.
const embedLater = () => embeddings.embedPending()?.catch((err) => console.warn('Embeddings:', err.message));

function registerMemoryIpc() {
  ipcMain.handle('memory:add', (_e, data) => {
    const item = store.add(data);
    embedLater();
    return item;
  });
  ipcMain.handle('memory:update', (_e, id, data) => {
    const item = store.update(id, data);
    embedLater();
    return item;
  });
  ipcMain.handle('memory:remove', (_e, id) => store.remove(id));
  ipcMain.handle('memory:get', (_e, id) => store.get(id));
  ipcMain.handle('memory:list', (_e, opts) => store.list(opts));
  ipcMain.handle('memory:search', (_e, query, opts) => search(query, opts));

  ipcMain.handle('memory:settings', () => embeddings.publicSettings());
  ipcMain.handle('memory:saveSettings', (_e, s) => {
    const saved = embeddings.saveSettings(s);
    embedLater();
    return saved;
  });
  ipcMain.handle('memory:testEmbeddings', () => embeddings.testEmbeddings());
  ipcMain.handle('memory:reindex', () => embeddings.embedPending() || 0);
}

module.exports = { registerMemoryIpc, closeMemory: closeDb };
