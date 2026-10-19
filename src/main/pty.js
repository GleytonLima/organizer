// Ciclo de vida dos pseudo-terminais (node-pty) expostos ao renderer.
const { app, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const pty = require('node-pty');
const { bashPath, rcFile, windowsToMsys } = require('./bash');
const { sendToWindow } = require('./window');
const { apiInfo, terminalToken } = require('./api/server');
const { childEnv } = require('./env');

const ptys = new Map();

// Pasta do CLI `bo` (raiz/bin), relativa a este arquivo; fora do .asar quando empacotado.
const BIN_DIR = path.join(__dirname, '..', '..', 'bin').replace('app.asar', 'app.asar.unpacked');

/** Variáveis que ligam cada terminal ao app: quem é o terminal e como falar com a API. */
function organizerEnv(id) {
  const api = apiInfo();
  return {
    BO_TERMINAL_ID: id,
    BO_BIN: windowsToMsys(BIN_DIR),
    BO_NODE: process.execPath,
    // token do próprio terminal (não o mestre): vale só como este terminal (ver api/server.js)
    ...(api && { BO_API_URL: api.url, BO_API_TOKEN: terminalToken(id) }),
  };
}

const nonces = new Map(); // id → nonce das sequências OSC 6973 (ver bash-init.sh)

function spawn({ id, cwd, cols, rows, nonce }) {
  if (!bashPath()) return { ok: false, error: 'Git Bash não encontrado. Instale pelos Primeiros passos (Configurações) ou defina GIT_BASH_PATH.' };
  if (ptys.has(id)) return { ok: true, nonce: nonces.get(id) }; // renderer recarregado: o shell é o mesmo
  const dir = cwd && fs.existsSync(cwd) ? cwd : app.getPath('home');
  const proc = pty.spawn(bashPath(), ['--rcfile', rcFile().replace(/\\/g, '/'), '-i'], {
    name: 'xterm-256color',
    cols: cols || 80,
    rows: rows || 24,
    cwd: dir,
    env: childEnv({
      MSYSTEM: 'MINGW64',
      CHERE_INVOKING: '1',
      TERM_PROGRAM: 'bash-organizer',
      COLORTERM: 'truecolor',
      ...organizerEnv(id),
      BO_OSC_NONCE: nonce || '', // o bash-init guarda numa variável do shell e tira do ambiente
    }),
  });
  ptys.set(id, proc);
  nonces.set(id, nonce || '');
  proc.onData((data) => sendToWindow('pty:data', id, data));
  proc.onExit(({ exitCode }) => {
    ptys.delete(id);
    nonces.delete(id);
    sendToWindow('pty:exit', id, exitCode);
  });
  return { ok: true, cwd: dir, nonce: nonce || '' };
}

function kill(id) {
  const p = ptys.get(id);
  if (!p) return;
  ptys.delete(id);
  try {
    p.kill();
  } catch {}
}

function killAll() {
  for (const id of [...ptys.keys()]) kill(id);
}

/**
 * Encerra todos os shells e espera cada um sair (no máximo `timeout` ms). O kill do conpty termina
 * em segundo plano (threads nativas, ~1 s de flush até o `exit`); sair do processo antes disso às
 * vezes trava o encerramento ou derruba o app com 0xC0000409.
 */
function closeAll(timeout = 3000) {
  const exits = [...ptys.values()].map((p) => new Promise((resolve) => p.onExit(resolve)));
  killAll();
  return Promise.race([Promise.all(exits), new Promise((resolve) => setTimeout(resolve, timeout))]);
}

const hasPtys = () => ptys.size > 0;

function registerPtyIpc() {
  ipcMain.handle('pty:info', () => ({ bash: bashPath(), home: app.getPath('home') }));
  ipcMain.handle('pty:create', (_e, opts) => spawn(opts));
  ipcMain.on('pty:write', (_e, id, data) => ptys.get(id)?.write(data));
  ipcMain.on('pty:kill', (_e, id) => kill(id));
  ipcMain.on('pty:resize', (_e, id, cols, rows) => {
    const p = ptys.get(id);
    if (!p || cols <= 0 || rows <= 0) return;
    try {
      p.resize(cols, rows);
    } catch {}
  });
}

module.exports = { registerPtyIpc, killAll, closeAll, hasPtys, organizerEnv };
