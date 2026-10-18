// IPC da conexão com o servidor do time (Configurações → Servidor do time): sondar o endereço,
// entrar pelo navegador (SSO) ou com token pessoal, desconectar. Sem conexão, o app é 100% local.
const { ipcMain } = require('electron');
const client = require('./client');
const engine = require('./engine');
const { clearRemoteCache } = require('./remote');
const { probe, loginWithBrowser, cancelLogin } = require('./login');
const { syncSettings, publicSyncSettings, saveSyncSettings } = require('./settings');
const { userFile, readJson, writeJsonAtomic } = require('../files');

const FILE = () => userFile('sync-settings.json');

/** Grava a credencial, confere quem é no servidor e começa a sincronizar; volta ao anterior se falhar. */
async function connect(url, token) {
  const before = readJson(FILE(), {});
  saveSyncSettings({ url, token });
  try {
    const me = await client.me();
    saveSyncSettings({ url, account: { name: me.name, email: me.email } });
  } catch (err) {
    writeJsonAtomic(FILE(), before);
    throw err.kind === 'auth' ? new Error('O servidor recusou esse token (inválido, vencido ou revogado).') : err;
  }
  clearRemoteCache();
  engine.schedule(100);
  return publicSyncSettings();
}

/** Desconecta: revoga a sessão no servidor (se der) e apaga a credencial. Os dados locais ficam. */
async function disconnect() {
  if (syncSettings().token) await client.logout();
  saveSyncSettings({ clear: true });
  clearRemoteCache();
  await engine.syncNow(); // estado vira "off"
  return publicSyncSettings();
}

function registerAccountIpc() {
  ipcMain.handle('sync:probe', (_e, url) => probe(url));
  ipcMain.handle('sync:loginBrowser', async (_e, url) => connect(url, await loginWithBrowser(url)));
  ipcMain.handle('sync:loginToken', (_e, url, token) => connect(url, String(token || '').trim()));
  ipcMain.handle('sync:cancelLogin', () => cancelLogin());
  ipcMain.handle('sync:disconnect', () => disconnect());
}

module.exports = { registerAccountIpc };
