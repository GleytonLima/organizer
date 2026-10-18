// Identidade de uma pasta entre máquinas: a URL do remote git, normalizada como no servidor
// (bo-memory-server/internal/memory/remote.go; ver docs/API.md → "Normalização de remote").
const { execFile } = require('child_process');
const { GIT } = require('../bash');

/** git@github.com:Gleyton/Repo.git | https://… | ssh://… → "github.com/gleyton/repo". */
function normalizeRemote(remote) {
  let r = String(remote || '').trim().toLowerCase();
  if (!r) return '';
  if (/^[a-z+]+:\/\//.test(r)) {
    r = r.replace(/^[a-z+]+:\/\//, '');
    const at = r.indexOf('@');
    if (at >= 0 && at < `${r}/`.indexOf('/')) r = r.slice(at + 1); // usuário/senha antes do host
  } else {
    const m = /^([^@/]+@)?([^:/]+):(.+)$/.exec(r);
    if (m) r = `${m[2]}/${m[3]}`;
  }
  r = r.replace(/\/+$/, '').replace(/\.git$/, '');
  const slash = r.indexOf('/');
  if (slash > 0) r = `${r.slice(0, slash).split(':')[0]}${r.slice(slash)}`; // sem porta
  return r;
}

const cache = new Map(); // caminho (minúsculas) → remote normalizado | '' (sem remote)

function gitRemote(dir) {
  return new Promise((resolve) => {
    execFile(GIT, ['-c', 'core.fsmonitor=', '-c', 'core.hooksPath=NUL', '-C', dir, 'remote', 'get-url', 'origin'], { timeout: 4000, windowsHide: true }, (err, out) =>
      resolve(err ? '' : normalizeRemote(out)),
    );
  });
}

/** Remote normalizado da pasta ('' se não for repositório ou não tiver "origin"). Em cache. */
async function remoteOf(dir) {
  const key = String(dir || '').toLowerCase();
  if (!key) return '';
  if (!cache.has(key)) cache.set(key, await gitRemote(dir));
  return cache.get(key);
}

const clearRemoteCache = () => cache.clear();

module.exports = { normalizeRemote, remoteOf, clearRemoteCache };
