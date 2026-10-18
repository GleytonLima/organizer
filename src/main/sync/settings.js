// Configuração do sync: URL do bo-memory-server e o token do dev (criptografado com o cofre do
// sistema, safeStorage). BO_SYNC_URL/BO_SYNC_TOKEN sobrescrevem (testes, perfis isolados).
const { safeStorage } = require('electron');
const { userFile, readJson, writeJsonAtomic } = require('../files');

const FILE = () => userFile('sync-settings.json');

const raw = () => ({ url: '', tokenEnc: null, ...readJson(FILE(), {}) });

function decrypt(enc) {
  if (!enc || !safeStorage.isEncryptionAvailable()) return null;
  try {
    return safeStorage.decryptString(Buffer.from(enc, 'base64'));
  } catch {
    return null;
  }
}

/** Configuração efetiva (com o token) — só para uso interno do processo principal. */
function syncSettings() {
  const s = raw();
  const url = (process.env.BO_SYNC_URL || s.url || '').replace(/\/+$/, '');
  return { url, token: process.env.BO_SYNC_TOKEN || decrypt(s.tokenEnc) };
}

const syncEnabled = () => {
  const s = syncSettings();
  return !!(s.url && s.token);
};

/** O que a interface vê (nunca o token). */
const publicSyncSettings = () => ({ url: syncSettings().url, hasToken: !!syncSettings().token });

/** `token` vazio mantém o atual; `clear: true` desliga o sync (apaga URL e token). */
function saveSyncSettings({ url = '', token = '', clear = false }) {
  if (clear) {
    writeJsonAtomic(FILE(), { url: '', tokenEnc: null });
    return publicSyncSettings();
  }
  const clean = String(url).trim().replace(/\/+$/, '');
  if (clean && !/^https?:\/\//.test(clean)) throw new Error('A URL do servidor deve começar com http:// ou https://.');
  // token e memórias do time não trafegam em texto aberto: http só na própria máquina
  if (/^http:\/\//.test(clean) && !/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/.test(clean)) {
    throw new Error('Use https:// (http:// só para um servidor nesta máquina: localhost).');
  }
  const next = { ...raw(), url: clean };
  if (token) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Criptografia do sistema indisponível para guardar o token.');
    next.tokenEnc = safeStorage.encryptString(String(token).trim()).toString('base64');
  }
  writeJsonAtomic(FILE(), next);
  return publicSyncSettings();
}

module.exports = { syncSettings, syncEnabled, publicSyncSettings, saveSyncSettings };
