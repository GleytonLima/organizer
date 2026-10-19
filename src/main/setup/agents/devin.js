// Devin CLI (Cognition) nos Primeiros passos: o instalador oficial roda num terminal do app (ele termina
// com o `devin setup`, que é interativo e faz o login), e "Conectar" = servidor MCP do app no Devin
// (`devin mcp add -s user`) + o perfil de agente ACP (`devin acp`), criado pelo renderer.
// BO_DEVIN_HOME troca a pasta de configuração (padrão %APPDATA%\devin); BO_DEVIN_BIN, o executável.
const fs = require('fs');
const path = require('path');
const { readJsonSafe, findBin, runBin, boMcp } = require('../run');

const home = () => process.env.BO_DEVIN_HOME || path.join(process.env.APPDATA || '', 'devin');
const installDir = () => path.join(process.env.LOCALAPPDATA || '', 'devin', 'cli', 'bin');
const bin = () => findBin(['devin.exe'], [installDir()], process.env.BO_DEVIN_BIN);

async function status() {
  const b = bin();
  return {
    installed: !!b,
    version: b ? (await runBin(b, ['--version'], { timeout: 15000 })).out.split(/\r?\n/)[0] : null,
    loggedIn: fs.existsSync(path.join(home(), 'credentials.toml')),
    connected: !!readJsonSafe(path.join(home(), 'mcp_config.json'))?.mcpServers?.['bash-organizer'],
    // o perfil ACP usa o caminho completo: o PATH do app não vê uma instalação feita depois de ele abrir
    acp: b ? { command: b[0], args: [...b.slice(1), 'acp'] } : null,
  };
}

function preview() {
  const mcp = boMcp();
  return {
    items: [
      { title: 'Servidor MCP no Devin (todas as pastas)', text: `${mcp.name} → "${mcp.command}" "${mcp.args[0]}" mcp` },
      { title: 'Perfil de agente no app', text: 'Devin — terminal de agente com `devin acp` (o app entrega a ele o próprio MCP)' },
    ],
    note: `O Devin grava o MCP em ${path.join(home(), 'mcp_config.json')}.`,
  };
}

async function connect() {
  const b = bin();
  const mcp = boMcp();
  await runBin(b, ['mcp', 'remove', mcp.name, '-s', 'user']); // pode não existir ainda
  const add = await runBin(b, ['mcp', 'add', mcp.name, '-s', 'user', '-e', 'ELECTRON_RUN_AS_NODE=1', '--', mcp.command, ...mcp.args]);
  if (add.code) throw new Error(`O Devin não registrou o servidor MCP: ${add.out || `saída ${add.code}`}`);
  return { profile: { id: 'devin', label: 'Devin', ...(await status()).acp } };
}

module.exports = {
  id: 'devin',
  label: 'Devin',
  about: 'Agente da Cognition (conta gratuita com limites); roda nos terminais de agente via ACP.',
  // num terminal do app: o instalador termina pedindo o login (devin setup)
  installTerminal: 'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "irm https://static.devin.ai/cli/setup.ps1 | iex"',
  loginCommand: () => `${(bin() || ['devin']).map((p) => `"${p.replace(/\\/g, '/')}"`).join(' ')} auth login`,
  status,
  preview,
  connect,
};
