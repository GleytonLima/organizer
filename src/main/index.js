const { app } = require('electron');
const { createWindow, focusWindow } = require('./window');
const { writeRcFile } = require('./bash');
const { registerPtyIpc, killAll } = require('./pty');
const { registerGitIpc } = require('./git');
const { registerSystemIpc } = require('./system');

// Uma única instância: duas janelas gravando o mesmo state.json se sobrescreveriam.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', focusWindow);

  registerPtyIpc();
  registerGitIpc();
  registerSystemIpc();

  app.whenReady().then(() => {
    writeRcFile();
    createWindow();
  });

  app.on('window-all-closed', () => app.quit());
  app.on('will-quit', killAll);
}
