// Máquina nova: acha os clones locais das pastas de um projeto pelo remote git e clona o que faltar.
// Onde procura: as pastas que você já tem em algum projeto, as pastas vizinhas delas (a "pasta de
// clones" de costume) e as pastas-base informadas (ex.: a que você escolheu no diálogo).
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { gitPath } = require('../bash');
const { remoteOf } = require('./remote');

const isRepo = (dir) => {
  try {
    return fs.existsSync(path.join(dir, '.git'));
  } catch {
    return false;
  }
};

const children = (dir) => {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => path.join(dir, d.name));
  } catch {
    return [];
  }
};

/** remote → caminho local, para os `remotes` pedidos que forem encontrados. */
async function locateFolders(remotes, knownDirs = [], bases = []) {
  const wanted = new Set(remotes);
  const candidates = new Set();
  for (const dir of knownDirs) {
    candidates.add(dir);
    children(path.dirname(dir)).forEach((d) => candidates.add(d));
  }
  for (const base of bases) children(base).forEach((d) => candidates.add(d));
  const found = {};
  for (const dir of candidates) {
    if (!wanted.size) break;
    if (!isRepo(dir)) continue;
    const remote = await remoteOf(dir);
    if (wanted.has(remote)) {
      found[remote] = dir;
      wanted.delete(remote);
    }
  }
  return found;
}

/** git clone `url` em `dir` (que não pode existir com conteúdo). Até 10 min. */
function cloneRepo(url, dir) {
  if (!/^(https?:\/\/|ssh:\/\/|git@|[a-zA-Z]:[\\/]|\/)/.test(String(url || ''))) {
    return Promise.reject(new Error(`URL de clone não suportada: ${url}`));
  }
  if (fs.existsSync(dir) && children(dir).length + fs.readdirSync(dir).length > 0) {
    return Promise.reject(new Error(`A pasta já existe e não está vazia: ${dir}`));
  }
  // "--" separa a URL de opções: uma URL vinda do servidor não vira argumento do git
  return new Promise((resolve, reject) => {
    execFile(gitPath(), ['clone', '--', url, dir], { timeout: 600000, windowsHide: true }, (err, _out, stderr) =>
      err ? reject(new Error(`Não consegui clonar ${url}: ${String(stderr || err.message).trim().split('\n').pop()}`)) : resolve(dir),
    );
  });
}

module.exports = { locateFolders, cloneRepo };
