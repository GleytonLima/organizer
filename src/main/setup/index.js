// IPC da primeira abertura: verificar o que falta (Git Bash e os agentes de IA), instalar, conectar um
// agente ao app e ler uma pasta para virar projeto.
const fs = require('fs');
const { ipcMain } = require('electron');
const { bashPath } = require('../bash');
const { agentById, agentsStatus } = require('./agents');
const { install } = require('./install');
const { scanFolder } = require('./scan');

const hasWinget = () => !!String(process.env.PATH || '').split(';').some((d) => d && fs.existsSync(`${d}\\winget.exe`));

/** { bash, winget, agents: [{ id, label, installed, loggedIn, connected, … }] } */
async function checkSetup() {
  return { bash: bashPath(), winget: hasWinget(), agents: await agentsStatus() };
}

function registerSetupIpc() {
  ipcMain.handle('setup:check', () => checkSetup());
  ipcMain.handle('setup:install', (_e, step) => install(String(step)));
  ipcMain.handle('setup:preview', (_e, id) => agentById(String(id)).preview());
  ipcMain.handle('setup:connect', (_e, id) => agentById(String(id)).connect());
  ipcMain.handle('setup:scan', (_e, dir) => scanFolder(dir));
}

module.exports = { registerSetupIpc };
