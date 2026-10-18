const { app } = require('electron');
// antes de qualquer módulo registrar canais: só a página do app fala com o processo principal
require('./ipc-guard').guardIpc();
const { createWindow, focusWindow } = require('./window');
const { writeRcFile } = require('./bash');
const { registerPtyIpc, killAll, closeAll, hasPtys } = require('./pty');
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
const { registerFeedbackIpc } = require('./metrics/feedback');

// Pasta de dados: %APPDATA%\Brain Organizer (migra a antiga "Bash Organizer"); BO_USER_DATA=<pasta>
// para testes ou um segundo perfil isolado. Antes da trava de instância única, que depende dela.
app.setPath('userData', require('./data-folder').dataFolder(app.getPath('appData')).dir);

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
  registerFeedbackIpc();

  app.whenReady().then(async () => {
    writeRcFile();
    await startApiServer(); // antes da janela: os terminais herdam BO_API_URL/BO_API_TOKEN
    createWindow();
  });

  app.on('window-all-closed', () => app.quit());
  // Na primeira passada, segura a saída até os shells terminarem (ver closeAll em pty.js).
  let ptysClosed = false;
  app.on('will-quit', (e) => {
    if (!ptysClosed && hasPtys()) {
      e.preventDefault();
      ptysClosed = true;
      closeAll().then(() => app.quit());
      return;
    }
    killAll();
    stopApiServer();
    stopSync();
    stopAllAgents();
    closeMemory();
    closeMetrics();
  });
}
