const { app, BrowserWindow, ipcMain, dialog, clipboard, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const pty = require('node-pty');

const STATE_FILE = () => path.join(app.getPath('userData'), 'state.json');
const WINDOW_FILE = () => path.join(app.getPath('userData'), 'window.json');
const RC_FILE = () => path.join(app.getPath('userData'), 'bash-init.sh');

const ptys = new Map();
let win = null;

function findBash() {
  const candidates = [
    process.env.GIT_BASH_PATH,
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Git', 'bin', 'bash.exe'),
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || null;
}

const BASH = findBash();
// Raiz da instalação do Git, usada para converter caminhos MSYS (/usr/bin) em caminhos Windows.
const GIT_ROOT = BASH ? path.resolve(path.dirname(BASH), '..') : null;

function writeRcFile() {
  // Reproduz o startup de um login shell do Git Bash e adiciona um hook que
  // informa o diretório atual ao app via OSC 7 a cada prompt.
  const rc = `# gerado pelo Bash Organizer — não editar
[ -f /etc/profile ] && . /etc/profile
if [ -f ~/.bash_profile ]; then . ~/.bash_profile
elif [ -f ~/.bash_login ]; then . ~/.bash_login
elif [ -f ~/.profile ]; then . ~/.profile
elif [ -f ~/.bashrc ]; then . ~/.bashrc
fi
__bo_osc7() { printf '\\033]7;file://localhost%s\\007' "$PWD"; }
case ";\${PROMPT_COMMAND};" in
  *";__bo_osc7;"*) ;;
  *) PROMPT_COMMAND="__bo_osc7\${PROMPT_COMMAND:+;\$PROMPT_COMMAND}" ;;
esac
`;
  fs.writeFileSync(RC_FILE(), rc.replace(/\r\n/g, '\n'));
}

function msysToWindows(p) {
  if (!p) return p;
  const drive = /^\/([a-zA-Z])(\/.*)?$/.exec(p);
  if (drive) return `${drive[1].toUpperCase()}:${(drive[2] || '\\').replace(/\//g, '\\')}`;
  if (p.startsWith('/') && GIT_ROOT) return path.join(GIT_ROOT, p);
  return p;
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(file, data) {
  const json = JSON.stringify(data, null, 2);
  const tmp = `${file}.tmp`;
  try {
    fs.writeFileSync(tmp, json);
    fs.renameSync(tmp, file);
  } catch {
    // rename pode falhar no Windows se o arquivo estiver bloqueado (antivírus, indexador)
    fs.writeFileSync(file, json);
  }
}

function createWindow() {
  const bounds = readJson(WINDOW_FILE(), { width: 1280, height: 800 });
  win = new BrowserWindow({
    ...bounds,
    minWidth: 640,
    minHeight: 400,
    backgroundColor: '#15120f',
    title: 'Bash Organizer',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  if (bounds.maximized) win.maximize();
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.on('close', () => {
    const maximized = win.isMaximized();
    const b = maximized ? readJson(WINDOW_FILE(), {}) : win.getBounds();
    writeJsonAtomic(WINDOW_FILE(), { ...b, maximized });
  });
  win.on('closed', () => {
    win = null;
  });
}

function send(channel, ...args) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, ...args);
}

// ---------- IPC: estado ----------
ipcMain.handle('state:load', () => readJson(STATE_FILE(), null));
ipcMain.on('state:save', (_e, state) => {
  try {
    writeJsonAtomic(STATE_FILE(), state);
  } catch (err) {
    console.error('Falha ao salvar estado', err);
  }
});
// Versão síncrona usada ao fechar a janela, para o último estado não se perder.
ipcMain.on('state:saveSync', (e, state) => {
  try {
    writeJsonAtomic(STATE_FILE(), state);
    e.returnValue = true;
  } catch (err) {
    console.error('Falha ao salvar estado', err);
    e.returnValue = false;
  }
});

// ---------- IPC: terminais ----------
ipcMain.handle('pty:info', () => ({ bash: BASH, home: app.getPath('home') }));

ipcMain.handle('pty:create', (_e, { id, cwd, cols, rows }) => {
  if (!BASH) return { ok: false, error: 'Git Bash não encontrado. Defina GIT_BASH_PATH.' };
  if (ptys.has(id)) return { ok: true };
  const dir = cwd && fs.existsSync(cwd) ? cwd : app.getPath('home');
  const proc = pty.spawn(BASH, ['--rcfile', RC_FILE().replace(/\\/g, '/'), '-i'], {
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
    },
  });
  ptys.set(id, proc);
  proc.onData((data) => send('pty:data', id, data));
  proc.onExit(({ exitCode }) => {
    ptys.delete(id);
    send('pty:exit', id, exitCode);
  });
  return { ok: true, cwd: dir };
});

ipcMain.on('pty:write', (_e, id, data) => ptys.get(id)?.write(data));
ipcMain.on('pty:resize', (_e, id, cols, rows) => {
  const p = ptys.get(id);
  if (p && cols > 0 && rows > 0) {
    try {
      p.resize(cols, rows);
    } catch {}
  }
});
ipcMain.on('pty:kill', (_e, id) => {
  const p = ptys.get(id);
  if (p) {
    ptys.delete(id);
    try {
      p.kill();
    } catch {}
  }
});

// ---------- IPC: utilidades ----------
ipcMain.handle('path:fromMsys', (_e, p) => msysToWindows(p));
ipcMain.handle('dialog:folder', async (_e, defaultPath) => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'], defaultPath });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('clipboard:read', () => clipboard.readText());
ipcMain.on('clipboard:write', (_e, text) => clipboard.writeText(text));
ipcMain.on('shell:openPath', (_e, p) => shell.openPath(p));

// ---------- IPC: git ----------
function parseGitStatus(out) {
  const info = { branch: null, ahead: 0, behind: 0, changes: 0, staged: 0, untracked: 0, conflicts: 0 };
  for (const line of out.split('\n')) {
    if (line.startsWith('# branch.head ')) info.branch = line.slice(14).trim();
    else if (line.startsWith('# branch.oid ') && !info.branch) info.branch = line.slice(13, 20);
    else if (line.startsWith('# branch.ab ')) {
      const m = /\+(\d+) -(\d+)/.exec(line);
      if (m) {
        info.ahead = +m[1];
        info.behind = +m[2];
      }
    } else if (line.startsWith('? ')) info.untracked++;
    else if (line.startsWith('u ')) info.conflicts++;
    else if (line.startsWith('1 ') || line.startsWith('2 ')) {
      const xy = line.slice(2, 4);
      if (xy[0] !== '.') info.staged++;
      if (xy[1] !== '.') info.changes++;
    }
  }
  if (info.branch === '(detached)') info.branch = 'HEAD solto';
  return info;
}

ipcMain.handle('git:status', (_e, cwd) => {
  return new Promise((resolve) => {
    if (!cwd || !fs.existsSync(cwd)) return resolve(null);
    execFile(
      'git',
      ['-C', cwd, '--no-optional-locks', 'status', '--porcelain=v2', '--branch'],
      { timeout: 4000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout) => resolve(err ? null : parseGitStatus(stdout)),
    );
  });
});

// ---------- ciclo de vida ----------
app.whenReady().then(() => {
  writeRcFile();
  createWindow();
});

app.on('window-all-closed', () => {
  for (const p of ptys.values()) {
    try {
      p.kill();
    } catch {}
  }
  ptys.clear();
  app.quit();
});
