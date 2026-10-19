// Instalações em segundo plano, sempre a pedido (botão): o Git for Windows pelo winget e os agentes com
// instalador não interativo (ver agents/). A saída vai linha a linha para a tela ('setup:log').
// BO_SETUP_INSTALL troca os comandos (testes): JSON { git: [cmd, ...args], claude: [...] }.
const { spawn } = require('child_process');
const { childEnv } = require('../env');
const { sendToWindow } = require('../window');
const { refreshGitBash } = require('../bash');
const { AGENTS } = require('./agents');

const GIT = ['winget', 'install', '--id', 'Git.Git', '-e', '--source', 'winget', '--accept-package-agreements', '--accept-source-agreements'];

function plan(step) {
  if (step === 'git') return { command: GIT, after: refreshGitBash };
  const agent = AGENTS.find((a) => a.id === step && a.install);
  if (!agent) return null;
  return { command: agent.install.command, after: () => agent.install.addPath && addToPath(agent.install.addPath) };
}

/** Pasta nova no PATH do app (e dos terminais abertos daqui em diante), sem esperar reiniciar. */
function addToPath(dir) {
  const parts = String(process.env.PATH || '').split(';');
  if (!parts.some((p) => p.toLowerCase() === dir.toLowerCase())) process.env.PATH = [dir, ...parts].join(';');
}

let running = null;

/** Instala `step` ('git' ou o id de um agente). Resolve { ok, code }; a saída chega por 'setup:log'. */
function install(step) {
  const p = plan(step);
  if (!p) return Promise.reject(new Error(`Instalação desconhecida: ${step}`));
  if (running) return Promise.reject(new Error('Já há uma instalação em andamento.'));
  const [cmd, ...args] = process.env.BO_SETUP_INSTALL ? JSON.parse(process.env.BO_SETUP_INSTALL)[step] : p.command;
  running = step;
  const log = (line) => line.trim() && sendToWindow('setup:log', step, line.replace(/\r/g, '').trimEnd());
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { windowsHide: true, env: childEnv() });
    const pipe = (stream) => stream.on('data', (d) => String(d).split('\n').forEach(log));
    pipe(child.stdout);
    pipe(child.stderr);
    const done = (code) => {
      running = null;
      p.after();
      resolve({ ok: code === 0, code });
    };
    child.on('error', (err) => (log(err.message), done(1)));
    child.on('close', done);
  });
}

module.exports = { install };
