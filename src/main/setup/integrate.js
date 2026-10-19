// "Conectar o Claude Code ao Brain Organizer" num clique: o servidor MCP `bash-organizer` (escopo do
// usuário, via `claude mcp add`) e os hooks de aviso (Stop/Notification) no settings.json — o resto do
// arquivo fica como está e a primeira gravação guarda uma cópia.
const fs = require('fs');
const path = require('path');
const { writeJsonAtomic } = require('../files');
const { runClaude, settingsFile, readJsonSafe, OURS } = require('./claude');

const unpacked = (p) => p.replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
const BIN = unpacked(path.resolve(__dirname, '..', '..', '..', 'bin'));
const BACKUP = '.brain-organizer.bak';

const HOOKS = { Stop: 'Terminei', Notification: 'Precisa de você' };
const hookCommand = (message) => `"${path.join(BIN, 'bo.cmd').replace(/\\/g, '/')}" notify --title Claude "${message}"`;

/** O que será gravado (para mostrar antes de pedir o OK). */
function integrationPreview() {
  return {
    mcp: `bash-organizer → "${process.execPath}" "${path.join(BIN, 'bo.js')}" mcp`,
    settings: settingsFile(),
    backup: settingsFile() + BACKUP,
    hooks: Object.entries(HOOKS).map(([event, message]) => `${event}: ${hookCommand(message)}`),
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
async function integrate() {
  await runClaude(['mcp', 'remove', 'bash-organizer', '-s', 'user']); // pode não existir ainda
  const add = await runClaude(['mcp', 'add', 'bash-organizer', '-s', 'user', '-e', 'ELECTRON_RUN_AS_NODE=1', '--', process.execPath, path.join(BIN, 'bo.js'), 'mcp']);
  if (add.code) throw new Error(`O Claude Code não registrou o servidor MCP: ${add.out || `saída ${add.code}`}`);
  writeHooks();
}

module.exports = { integrate, integrationPreview };
