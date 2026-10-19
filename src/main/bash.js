// Localiza o Git Bash, gera o rcfile de inicialização e converte caminhos MSYS.
const path = require('path');
const fs = require('fs');
const { userFile } = require('./files');

function findBash() {
  const candidates = [
    process.env.GIT_BASH_PATH,
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Git', 'bin', 'bash.exe'),
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || null;
}

// git.exe pelo caminho absoluto (o do mesmo Git do bash), não pelo PATH: um git.exe numa pasta
// gravável do PATH seria executado no lugar.
function locate() {
  const bash = findBash();
  const root = bash ? path.resolve(path.dirname(bash), '..') : null;
  const git = [root && path.join(root, 'cmd', 'git.exe'), root && path.join(root, 'bin', 'git.exe')].find((p) => p && fs.existsSync(p)) || 'git';
  return { bash, root, git };
}

let found = locate();
/** Procura o Git de novo (depois de instalá-lo pela primeira abertura). */
const refreshGitBash = () => (found = locate()).bash;
const bashPath = () => found.bash;
const gitPath = () => found.git;
const rcFile = () => userFile('bash-init.sh');

// O script fica em src/main/shell/ e é copiado para userData: o bash não lê de dentro do .asar.
function writeRcFile() {
  const rc = fs.readFileSync(path.join(__dirname, 'shell', 'bash-init.sh'), 'utf8');
  fs.writeFileSync(rcFile(), rc.replace(/\r\n/g, '\n'));
}

function msysToWindows(p) {
  if (!p) return p;
  const drive = /^\/([a-zA-Z])(\/.*)?$/.exec(p);
  if (drive) return `${drive[1].toUpperCase()}:${(drive[2] || '\\').replace(/\//g, '\\')}`;
  if (p.startsWith('/') && found.root) return path.join(found.root, p);
  return p;
}

/** C:\x\y → /c/x/y (para usar no PATH do bash). */
function windowsToMsys(p) {
  const m = /^([a-zA-Z]):[\\/]?(.*)$/.exec(p || '');
  return m ? `/${m[1].toLowerCase()}/${m[2].replace(/\\/g, '/')}` : p;
}

module.exports = { gitPath, bashPath, refreshGitBash, rcFile, writeRcFile, msysToWindows, windowsToMsys };
