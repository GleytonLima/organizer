const { ipcMain } = require('electron');
const fs = require('fs');
const { execFile } = require('child_process');

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
  return new Promise((resolve) => {
    if (!cwd || !fs.existsSync(cwd)) return resolve(null);
    execFile(
      'git',
      ['-C', cwd, '--no-optional-locks', 'status', '--porcelain=v2', '--branch'],
      { timeout: 4000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout) => resolve(err ? null : parseGitStatus(stdout)),
    );
  });
}

function registerGitIpc() {
  ipcMain.handle('git:status', (_e, cwd) => gitStatus(cwd));
}

module.exports = { registerGitIpc };
