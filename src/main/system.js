// IPC de estado persistido e utilidades do sistema (diálogos, clipboard, explorer).
const fs = require('fs');
const { ipcMain, dialog, clipboard, shell } = require('electron');
const { userFile, readJson, writeJsonAtomic } = require('./files');
const { msysToWindows } = require('./bash');
const { getWindow } = require('./window');

const STATE_FILE = () => userFile('state.json');

const isText = (v) => v == null || typeof v === 'string';

/**
 * Forma mínima do estado antes de gravar: o state.json guarda perfis de agente (comando que vira
 * processo) e comandos iniciais de terminais — um renderer comprometido não grava qualquer coisa.
 */
function validState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return false;
  if (!Array.isArray(state.projects) || !state.projects.every((p) => p && Array.isArray(p.groups))) return false;
  const terminals = state.projects.flatMap((p) => p.groups.flatMap((g) => (Array.isArray(g?.terminals) ? g.terminals : [null])));
  if (!terminals.every((t) => t && typeof t.id === 'string' && isText(t.startup) && isText(t.cwd))) return false;
  const profiles = state.agentProfiles ?? [];
  return Array.isArray(profiles) && profiles.every((p) => p && typeof p.id === 'string' && ['command', 'args', 'env', 'mode', 'mcp'].every((k) => isText(p[k])));
}

function saveState(state) {
  if (!validState(state)) {
    console.error('Estado recusado: formato inesperado');
    return false;
  }
  try {
    writeJsonAtomic(STATE_FILE(), state);
    return true;
  } catch (err) {
    console.error('Falha ao salvar estado', err);
    return false;
  }
}

/**
 * Abre uma pasta no Explorer (ou o relatório HTML do Playwright). Qualquer outro arquivo só é mostrado
 * na pasta: openPath executaria um .exe/.bat/.lnk, e o caminho pode vir de um terminal.
 */
function openSafely(p) {
  let st;
  try {
    st = fs.statSync(String(p || ''));
  } catch {
    return;
  }
  const report = /[\\/]playwright-report[\\/]index\.html$/i.test(p);
  if (st.isDirectory() || report) shell.openPath(p);
  else shell.showItemInFolder(p);
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
  ipcMain.on('shell:openPath', (_e, p) => openSafely(p));
}

module.exports = { registerSystemIpc, validState };
