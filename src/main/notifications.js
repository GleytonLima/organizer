// Notificações nativas do Windows (toast) e destaque na barra de tarefas.
const { app, ipcMain, Notification } = require('electron');
const { getWindow, focusWindow, sendToWindow } = require('./window');

// No Windows, o toast precisa de um AppUserModelID; em desenvolvimento usa-se o caminho do executável.
const APP_ID = app.isPackaged ? 'com.bashorganizer.app' : process.execPath;

const alive = new Set(); // evita que o GC descarte o toast antes do clique

function showToast({ title, body, terminalId }) {
  const win = getWindow();
  if (win && !win.isFocused()) win.flashFrame(true);
  if (!Notification.isSupported()) return false;
  const toast = new Notification({ title, body, silent: false });
  alive.add(toast);
  const release = () => alive.delete(toast);
  toast.on('click', () => {
    release();
    focusWindow();
    sendToWindow('notify:clicked', terminalId);
  });
  toast.on('close', release);
  toast.on('failed', release);
  toast.show();
  return true;
}

function registerNotificationIpc() {
  app.setAppUserModelId(APP_ID);
  ipcMain.handle('notify:show', (_e, payload) => showToast(payload));
}

module.exports = { registerNotificationIpc };
