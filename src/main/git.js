const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { GIT } = require('./bash');

function parseGitStatus(out) {
  const info = { branch: null, ahead: 0, behind: 0, changes: 0, staged: 0, untracked: 0, conflicts: 0 };
  for (const line of out.split('\n')) {
    if (line.startsWith('# branch.head ')) info.branch = line.slice(14).trim();
    else if (line.startsWith('# branch.ab ')) {
      const m = /\+(\d+) -(\d+)/.exec(line);
      if (m) [info.ahead, info.behind] = [+m[1], +m[2]];
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

function gitStatus(cwd) {
  if (!cwd || !fs.existsSync(cwd)) return Promise.resolve(null);
  return Promise.all([
    git(cwd, ['--no-optional-locks', 'status', '--porcelain=v2', '--branch'], 4 * 1024 * 1024),
    git(cwd, ['rev-parse', '--show-toplevel']),
  ]).then(([status, top]) => {
    if (status == null) return null;
    const info = parseGitStatus(status);
    // raiz do repositório: identifica o repo quando o projeto tem vários (backend, infra…)
    info.root = top ? path.normalize(top.trim()) : null;
    info.repo = info.root ? path.basename(info.root) : null;
    return info;
  });
}

function git(cwd, args, maxBuffer = 1024 * 1024) {
  return new Promise((resolve) => {
    execFile(GIT, ['-c', 'core.fsmonitor=', '-c', 'core.hooksPath=NUL', '-C', cwd, ...args], { timeout: 4000, windowsHide: true, maxBuffer }, (err, stdout) => resolve(err ? null : stdout));
  });
}

function registerGitIpc() {
  ipcMain.handle('git:status', (_e, cwd) => gitStatus(cwd));
}

module.exports = { registerGitIpc };
