// IPC de estado persistido e utilidades do sistema (diálogos, clipboard, explorer).
const { ipcMain, dialog, clipboard, shell } = require('electron');
const { userFile, readJson, writeJsonAtomic } = require('./files');
const { msysToWindows } = require('./bash');
const { getWindow } = require('./window');

const STATE_FILE = () => userFile('state.json');

function saveState(state) {
  try {
    writeJsonAtomic(STATE_FILE(), state);
    return true;
  } catch (err) {
    console.error('Falha ao salvar estado', err);
    return false;
  }
}

function registerSystemIpc() {
  ipcMain.handle('state:load', () => readJson(STATE_FILE(), null));
  ipcMain.on('state:save', (_e, state) => saveState(state));
  // Versão síncrona usada ao fechar a janela, para o último estado não se perder.
  ipcMain.on('state:saveSync', (e, state) => {
    e.returnValue = saveState(state);
  });

  ipcMain.handle('path:fromMsys', (_e, p) => msysToWindows(p));
  ipcMain.handle('dialog:folder', async (_e, defaultPath) => {
    const r = await dialog.showOpenDialog(getWindow(), { properties: ['openDirectory'], defaultPath });
    return r.canceled ? null : r.filePaths[0];
  });
  ipcMain.handle('dialog:folders', async (_e, defaultPath) => {
    const r = await dialog.showOpenDialog(getWindow(), { properties: ['openDirectory', 'multiSelections'], defaultPath });
    return r.canceled ? [] : r.filePaths;
  });
  ipcMain.handle('clipboard:read', () => clipboard.readText());
  ipcMain.on('clipboard:write', (_e, text) => clipboard.writeText(text));
  ipcMain.on('shell:openPath', (_e, p) => shell.openPath(p));
}

module.exports = { registerSystemIpc };
