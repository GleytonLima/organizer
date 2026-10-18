const { app } = require('electron');
// antes de qualquer módulo registrar canais: só a página do app fala com o processo principal
require('./ipc-guard').guardIpc();
const { createWindow, focusWindow } = require('./window');
const { writeRcFile } = require('./bash');
const { registerPtyIpc, killAll } = require('./pty');
const { registerGitIpc } = require('./git');
const { registerSystemIpc } = require('./system');
const { registerEditorIpc } = require('./editor');
const { registerPlaywrightIpc } = require('./playwright');
const { registerBridgeIpc } = require('./api/bridge');
const { startApiServer, stopApiServer } = require('./api/server');
const { registerNotificationIpc } = require('./notifications');
const { registerMemoryIpc, closeMemory } = require('./memory');
const { registerSyncIpc, stopSync } = require('./sync');
const { registerAcpIpc, stopAllAgents } = require('./acp');
const { registerMetricsIpc, closeMetrics } = require('./metrics');

// Pasta de dados alternativa (testes, ou um segundo perfil isolado): BO_USER_DATA=<pasta>.
if (process.env.BO_USER_DATA) app.setPath('userData', process.env.BO_USER_DATA);

// Uma única instância: duas janelas gravando o mesmo state.json se sobrescreveriam.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', focusWindow);

  registerPtyIpc();
  registerGitIpc();
  registerSystemIpc();
  registerEditorIpc();
  registerPlaywrightIpc();
  registerBridgeIpc();
  registerNotificationIpc();
  registerMemoryIpc();
  registerSyncIpc();
  registerAcpIpc();
  registerMetricsIpc();

  app.whenReady().then(async () => {
    writeRcFile();
    await startApiServer(); // antes da janela: os terminais herdam BO_API_URL/BO_API_TOKEN
    createWindow();
  });

  app.on('window-all-closed', () => app.quit());
  app.on('will-quit', () => {
    killAll();
    stopApiServer();
    stopSync();
    stopAllAgents();
    closeMemory();
    closeMetrics();
  });
}
