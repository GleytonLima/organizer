// Instalações da primeira abertura, sempre a pedido (botão): o Git for Windows pelo winget e o Claude
// Code pelo instalador oficial. A saída vai linha a linha para a tela ('setup:log').
// BO_SETUP_INSTALL troca os comandos (testes): JSON { git: [cmd, ...args], claude: [...] }.
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { childEnv } = require('../env');
const { sendToWindow } = require('../window');
const { refreshGitBash } = require('../bash');

const COMMANDS = {
  git: ['winget', 'install', '--id', 'Git.Git', '-e', '--source', 'winget', '--accept-package-agreements', '--accept-source-agreements'],
  claude: ['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'irm https://claude.ai/install.ps1 | iex'],
};

const commandFor = (step) => (process.env.BO_SETUP_INSTALL ? JSON.parse(process.env.BO_SETUP_INSTALL)[step] : COMMANDS[step]);

/** Pasta nova no PATH do app (e dos terminais abertos daqui em diante), sem esperar reiniciar. */
function addToPath(dir) {
  const parts = String(process.env.PATH || '').split(';');
  if (!parts.some((p) => p.toLowerCase() === dir.toLowerCase())) process.env.PATH = [dir, ...parts].join(';');
}

let running = null;

/** Instala `step` ('git' | 'claude'). Resolve { ok, code }; a saída chega por 'setup:log'. */
function install(step) {
  if (!COMMANDS[step]) return Promise.reject(new Error(`Instalação desconhecida: ${step}`));
  if (running) return Promise.reject(new Error('Já há uma instalação em andamento.'));
  const [cmd, ...args] = commandFor(step);
  running = step;
  const log = (line) => line.trim() && sendToWindow('setup:log', step, line.replace(/\r/g, '').trimEnd());
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { windowsHide: true, env: childEnv() });
    const pipe = (stream) => stream.on('data', (d) => String(d).split('\n').forEach(log));
    pipe(child.stdout);
    pipe(child.stderr);
    const done = (code) => {
      running = null;
      if (step === 'git') refreshGitBash();
      if (step === 'claude') addToPath(path.join(os.homedir(), '.local', 'bin'));
      resolve({ ok: code === 0, code });
    };
    child.on('error', (err) => (log(err.message), done(1)));
    child.on('close', done);
  });
}

module.exports = { install };
