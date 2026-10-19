// IPC da primeira abertura: verificar o que falta, instalar, integrar o Claude Code e ler uma pasta
// para virar projeto.
const fs = require('fs');
const { ipcMain } = require('electron');
const { bashPath } = require('../bash');
const { claudeStatus } = require('./claude');
const { install } = require('./install');
const { integrate, integrationPreview } = require('./integrate');
const { scanFolder } = require('./scan');

const hasWinget = () => !!String(process.env.PATH || '').split(';').some((d) => d && fs.existsSync(`${d}\\winget.exe`));

/** { bash, winget, claude: { installed, version, loggedIn, mcp, hooks } } */
async function checkSetup() {
  return { bash: bashPath(), winget: hasWinget(), claude: await claudeStatus() };
}

function registerSetupIpc() {
  ipcMain.handle('setup:check', () => checkSetup());
  ipcMain.handle('setup:install', (_e, step) => install(String(step)));
  ipcMain.handle('setup:preview', () => integrationPreview());
  ipcMain.handle('setup:integrate', () => integrate());
  ipcMain.handle('setup:scan', (_e, dir) => scanFolder(dir));
}

module.exports = { registerSetupIpc };
