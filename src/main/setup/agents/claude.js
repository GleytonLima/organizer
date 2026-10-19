// Claude Code nos Primeiros passos: onde está, se entrou na conta, e "Conectar" = servidor MCP do app
// (`claude mcp add -s user`) + hooks de aviso mesclados no settings.json (com cópia antes).
// CLAUDE_CONFIG_DIR muda a pasta de configuração (como no próprio Claude Code); BO_CLAUDE_BIN, o executável.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { writeJsonAtomic } = require('../../files');
const { readJsonSafe, findBin, runBin, boMcp, BIN_DIR } = require('../run');

const configDir = () => process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const globalConfigFile = () => (process.env.CLAUDE_CONFIG_DIR ? path.join(process.env.CLAUDE_CONFIG_DIR, '.claude.json') : path.join(os.homedir(), '.claude.json'));
const settingsFile = () => path.join(configDir(), 'settings.json');
const BACKUP = '.brain-organizer.bak';

const bin = () => findBin(['claude.exe', 'claude.cmd'], [path.join(os.homedir(), '.local', 'bin'), path.join(process.env.APPDATA || '', 'npm')], process.env.BO_CLAUDE_BIN);

const HOOKS = { Stop: 'Terminei', Notification: 'Precisa de você' };
const OURS = /bo\.cmd"? notify --title Claude/;
const hookCommand = (message) => `"${path.join(BIN_DIR, 'bo.cmd').replace(/\\/g, '/')}" notify --title Claude "${message}"`;
const hasOurHook = (settings, event) => (settings?.hooks?.[event] || []).some((e) => (e.hooks || []).some((h) => OURS.test(h.command || '')));

async function status() {
  const b = bin();
  const global = readJsonSafe(globalConfigFile()) || {};
  const settings = readJsonSafe(settingsFile());
  return {
    installed: !!b,
    version: b ? (await runBin(b, ['--version'], { timeout: 15000 })).out.split(/\r?\n/)[0] : null,
    loggedIn: !!(fs.existsSync(path.join(configDir(), '.credentials.json')) || global.oauthAccount || process.env.ANTHROPIC_API_KEY),
    connected: !!global.mcpServers?.['bash-organizer'] && hasOurHook(settings, 'Stop') && hasOurHook(settings, 'Notification'),
  };
}

function preview() {
  const mcp = boMcp();
  return {
    items: [
      { title: 'Servidor MCP no Claude Code (todas as pastas)', text: `${mcp.name} → "${mcp.command}" "${mcp.args[0]}" mcp` },
      { title: `Avisos (hooks) em ${settingsFile()}`, text: Object.entries(HOOKS).map(([event, m]) => `${event}: ${hookCommand(m)}`).join('\n') },
    ],
    note: `O resto do arquivo fica como está; antes, uma cópia vai para ${settingsFile() + BACKUP}.`,
  };
}

function writeHooks() {
  const file = settingsFile();
  const exists = fs.existsSync(file);
  const settings = exists ? readJsonSafe(file) : {};
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new Error(`Não consegui ler ${file} (JSON inválido). Corrija o arquivo e tente de novo.`);
  if (exists && !fs.existsSync(file + BACKUP)) fs.copyFileSync(file, file + BACKUP);
  settings.hooks = settings.hooks && typeof settings.hooks === 'object' ? settings.hooks : {};
  for (const [event, message] of Object.entries(HOOKS)) {
    const others = (Array.isArray(settings.hooks[event]) ? settings.hooks[event] : []).filter((e) => !(e?.hooks || []).some((h) => OURS.test(h?.command || '')));
    settings.hooks[event] = [...others, { hooks: [{ type: 'command', command: hookCommand(message) }] }];
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeJsonAtomic(file, settings);
}

/** Registra (ou atualiza, se o app mudou de lugar) o MCP e grava os hooks. */
async function connect() {
  const b = bin();
  const mcp = boMcp();
  await runBin(b, ['mcp', 'remove', mcp.name, '-s', 'user']); // pode não existir ainda
  const add = await runBin(b, ['mcp', 'add', mcp.name, '-s', 'user', '-e', 'ELECTRON_RUN_AS_NODE=1', '--', mcp.command, ...mcp.args]);
  if (add.code) throw new Error(`O Claude Code não registrou o servidor MCP: ${add.out || `saída ${add.code}`}`);
  writeHooks();
  return {};
}

module.exports = {
  id: 'claude',
  label: 'Claude Code',
  about: 'Agente da Anthropic; roda nos terminais de agente do app (perfil embutido).',
  install: { command: ['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'irm https://claude.ai/install.ps1 | iex'], addPath: path.join(os.homedir(), '.local', 'bin') },
  loginCommand: () => 'claude', // na primeira vez, o próprio `claude` pede o login
  status,
  preview,
  connect,
};
