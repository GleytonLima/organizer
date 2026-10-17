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

// Reproduz o startup de um login shell do Git Bash e adiciona um hook que
// informa o diretório atual ao app via OSC 7 a cada prompt.
const RC = `# gerado pelo Bash Organizer — não editar
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

function writeRcFile() {
  fs.writeFileSync(rcFile(), RC.replace(/\r\n/g, '\n'));
}

function msysToWindows(p) {
  if (!p) return p;
  const drive = /^\/([a-zA-Z])(\/.*)?$/.exec(p);
  if (drive) return `${drive[1].toUpperCase()}:${(drive[2] || '\\').replace(/\//g, '\\')}`;
  if (p.startsWith('/') && GIT_ROOT) return path.join(GIT_ROOT, p);
  return p;
}

module.exports = { BASH, rcFile, writeRcFile, msysToWindows };
