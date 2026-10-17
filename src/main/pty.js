// Ciclo de vida dos pseudo-terminais (node-pty) expostos ao renderer.
const { app, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const pty = require('node-pty');
const { BASH, rcFile, windowsToMsys } = require('./bash');
const { sendToWindow } = require('./window');
const { apiInfo } = require('./api/server');

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
    ...(api && { BO_API_URL: api.url, BO_API_TOKEN: api.token }),
  };
}

function spawn({ id, cwd, cols, rows }) {
  if (!BASH) return { ok: false, error: 'Git Bash não encontrado. Defina GIT_BASH_PATH.' };
  if (ptys.has(id)) return { ok: true };
  const dir = cwd && fs.existsSync(cwd) ? cwd : app.getPath('home');
  const proc = pty.spawn(BASH, ['--rcfile', rcFile().replace(/\\/g, '/'), '-i'], {
    name: 'xterm-256color',
    cols: cols || 80,
    rows: rows || 24,
    cwd: dir,
    env: {
      ...process.env,
      MSYSTEM: 'MINGW64',
      CHERE_INVOKING: '1',
      TERM_PROGRAM: 'bash-organizer',
      COLORTERM: 'truecolor',
      ...organizerEnv(id),
    },
  });
  ptys.set(id, proc);
  proc.onData((data) => sendToWindow('pty:data', id, data));
  proc.onExit(({ exitCode }) => {
    ptys.delete(id);
    sendToWindow('pty:exit', id, exitCode);
  });
  return { ok: true, cwd: dir };
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

function registerPtyIpc() {
  ipcMain.handle('pty:info', () => ({ bash: BASH, home: app.getPath('home') }));
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

module.exports = { registerPtyIpc, killAll };
