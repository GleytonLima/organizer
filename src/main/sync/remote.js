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

/** URL de clone sem usuário/senha (https://token@host/… → https://host/…); git@host:… fica como está. */
function cloneUrl(remote) {
  const r = String(remote || '').trim();
  return r.replace(/^([a-z+]+:\/\/)[^@/]*@/i, (m, scheme) => (/^ssh/i.test(scheme) ? m : scheme));
}

const cache = new Map(); // caminho (minúsculas) → { remote: normalizado, url: para clonar } | vazio

function gitRemote(dir) {
  return new Promise((resolve) => {
    execFile(GIT, ['-c', 'core.fsmonitor=', '-c', 'core.hooksPath=NUL', '-C', dir, 'remote', 'get-url', 'origin'], { timeout: 4000, windowsHide: true }, (err, out) =>
      resolve(err ? { remote: '', url: '' } : { remote: normalizeRemote(out), url: cloneUrl(out) }),
    );
  });
}

async function originOf(dir) {
  const key = String(dir || '').toLowerCase();
  if (!key) return { remote: '', url: '' };
  if (!cache.has(key)) cache.set(key, await gitRemote(dir));
  return cache.get(key);
}

/** Remote normalizado da pasta ('' se não for repositório ou não tiver "origin"). Em cache. */
const remoteOf = async (dir) => (await originOf(dir)).remote;

/** URL do "origin" para clonar, sem credenciais ('' se não houver). Em cache. */
const cloneUrlOf = async (dir) => (await originOf(dir)).url;

const clearRemoteCache = () => cache.clear();

module.exports = { normalizeRemote, remoteOf, cloneUrlOf, cloneUrl, clearRemoteCache };
