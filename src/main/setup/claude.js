// Onde está o Claude Code nesta máquina e o que ele já tem configurado (login, MCP, hooks).
// CLAUDE_CONFIG_DIR muda a pasta de configuração (como no próprio Claude Code); BO_CLAUDE_BIN troca o
// executável (testes: '["node", "fake-claude.js"]' ou um caminho).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { childEnv } = require('../env');

const configDir = () => process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
/** ~/.claude.json (login e servidores MCP do usuário); com CLAUDE_CONFIG_DIR, fica dentro dela. */
const globalConfigFile = () => (process.env.CLAUDE_CONFIG_DIR ? path.join(process.env.CLAUDE_CONFIG_DIR, '.claude.json') : path.join(os.homedir(), '.claude.json'));
const settingsFile = () => path.join(configDir(), 'settings.json');

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** [comando, ...argumentos fixos] do Claude Code, ou null se não estiver instalado. */
function findClaude() {
  const override = process.env.BO_CLAUDE_BIN;
  if (override) return override.trim().startsWith('[') ? JSON.parse(override) : [override];
  const dirs = [...String(process.env.PATH || '').split(';'), path.join(os.homedir(), '.local', 'bin'), path.join(process.env.APPDATA || '', 'npm')];
  for (const dir of dirs.filter(Boolean)) {
    for (const name of ['claude.exe', 'claude.cmd']) {
      const file = path.join(dir, name);
      if (fs.existsSync(file)) return [file];
    }
  }
  return null;
}

const quote = (a) => (/[\s"&|<>^]/.test(a) ? `"${a}"` : a);

/** Roda o Claude Code (.cmd do npm precisa do shell). Resolve { code, out }. */
function runClaude(args, { timeout = 30000 } = {}) {
  const bin = findClaude();
  if (!bin) return Promise.reject(new Error('Claude Code não encontrado.'));
  const [cmd, ...pre] = bin;
  const all = [...pre, ...args];
  const shell = /\.cmd$/i.test(cmd);
  return new Promise((resolve) => {
    execFile(shell ? quote(cmd) : cmd, shell ? all.map(quote) : all, { timeout, windowsHide: true, shell, env: childEnv() }, (err, stdout, stderr) =>
      resolve({ code: err ? err.code ?? 1 : 0, out: `${stdout || ''}${stderr || ''}`.trim() }),
    );
  });
}

const OURS = /bo\.cmd"? notify --title Claude/;
const hasOurHook = (settings, event) => (settings?.hooks?.[event] || []).some((e) => (e.hooks || []).some((h) => OURS.test(h.command || '')));

async function claudeStatus() {
  const bin = findClaude();
  const global = readJsonSafe(globalConfigFile()) || {};
  const settings = readJsonSafe(settingsFile());
  const version = bin ? (await runClaude(['--version'], { timeout: 15000 })).out.split(/\r?\n/)[0] : null;
  return {
    installed: !!bin,
    version,
    loggedIn: !!(fs.existsSync(path.join(configDir(), '.credentials.json')) || global.oauthAccount || process.env.ANTHROPIC_API_KEY),
    mcp: !!global.mcpServers?.['bash-organizer'],
    hooks: hasOurHook(settings, 'Stop') && hasOurHook(settings, 'Notification'),
  };
}

module.exports = { claudeStatus, findClaude, runClaude, settingsFile, readJsonSafe, OURS };
