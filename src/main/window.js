const { BrowserWindow, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { userFile, readJson, writeJsonAtomic } = require('./files');

const WINDOW_FILE = () => userFile('window.json');
// Empacotado, o ícone vem do .exe; em desenvolvimento, do build/icon.png.
const DEV_ICON = path.join(__dirname, '..', '..', 'build', 'icon.png');
let win = null;

function createWindow() {
  const bounds = readJson(WINDOW_FILE(), { width: 1280, height: 800 });
  win = new BrowserWindow({
    ...bounds,
    minWidth: 640,
    minHeight: 400,
    backgroundColor: '#101113',
    title: 'Bash Organizer',
    ...(fs.existsSync(DEV_ICON) && { icon: DEV_ICON }),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  if (bounds.maximized) win.maximize();
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.on('close', () => {
    const maximized = win.isMaximized();
    const b = maximized ? readJson(WINDOW_FILE(), {}) : win.getBounds();
    writeJsonAtomic(WINDOW_FILE(), { ...b, maximized });
  });
  win.on('closed', () => {
    win = null;
  });
  return win;
}

const getWindow = () => win;

function sendToWindow(channel, ...args) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, ...args);
}

function focusWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  win.flashFrame(false);
}

module.exports = { createWindow, getWindow, sendToWindow, focusWindow };
