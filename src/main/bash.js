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

const BASH = findBash();
const GIT_ROOT = BASH ? path.resolve(path.dirname(BASH), '..') : null;
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
  if (p.startsWith('/') && GIT_ROOT) return path.join(GIT_ROOT, p);
  return p;
}

module.exports = { BASH, rcFile, writeRcFile, msysToWindows };
