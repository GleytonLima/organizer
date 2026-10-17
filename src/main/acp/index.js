// IPC das sessões de agente (ACP): uma por terminal do tipo "agente".
const { ipcMain } = require('electron');
const { sendToWindow } = require('../window');
const { AgentSession } = require('./session');

const sessions = new Map(); // terminalId → AgentSession

function session(id) {
  const s = sessions.get(id);
  if (!s) throw new Error('Sessão de agente não encontrada.');
  return s;
}

/** opts: { profile, cwd, resume } (ver session.js). */
function start(id, opts) {
  sessions.get(id)?.stop();
  const s = new AgentSession(id, opts, (event) => sendToWindow('acp:event', id, event));
  sessions.set(id, s);
  s.start();
  return true;
}

function stop(id) {
  sessions.get(id)?.stop();
  sessions.delete(id);
}

function registerAcpIpc() {
  ipcMain.handle('acp:start', (_e, id, opts) => start(id, opts));
  ipcMain.handle('acp:prompt', (_e, id, text) => {
    session(id).prompt(text); // não espera o turno: os eventos chegam por acp:event
    return true;
  });
  ipcMain.handle('acp:cancel', (_e, id) => session(id).cancel());
  ipcMain.handle('acp:permission', (_e, id, requestId, optionId) => session(id).answerPermission(requestId, optionId));
  ipcMain.handle('acp:setMode', (_e, id, modeId) => session(id).setMode(modeId));
  ipcMain.handle('acp:setConfig', (_e, id, configId, value) => session(id).setConfig(configId, value));
  ipcMain.handle('acp:sessions', (_e, id) => session(id).listSessions());
  ipcMain.on('acp:stop', (_e, id) => stop(id));
}

const stopAllAgents = () => [...sessions.keys()].forEach(stop);

module.exports = { registerAcpIpc, stopAllAgents };
