const { app } = require('electron');
const { createWindow, focusWindow } = require('./window');
const { writeRcFile } = require('./bash');
const { registerPtyIpc, killAll } = require('./pty');
const { registerGitIpc } = require('./git');
const { registerSystemIpc } = require('./system');
const { registerBridgeIpc } = require('./api/bridge');
const { startApiServer, stopApiServer } = require('./api/server');

// Uma única instância: duas janelas gravando o mesmo state.json se sobrescreveriam.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', focusWindow);

  registerPtyIpc();
  registerGitIpc();
  registerSystemIpc();
  registerBridgeIpc();

  app.whenReady().then(async () => {
    writeRcFile();
    await startApiServer(); // antes da janela: os terminais herdam BO_API_URL/BO_API_TOKEN
    createWindow();
  });

  app.on('window-all-closed', () => app.quit());
  app.on('will-quit', () => {
    killAll();
    stopApiServer();
  });
}
