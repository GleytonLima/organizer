// Servidores MCP extras do perfil de agente (além do Bash Organizer), passados no session/new.
// Formato: o JSON padrão do Claude Code / Claude Desktop (.mcp.json) — com ou sem o "mcpServers":
//   { "mcpServers": {
//       "playwright": { "command": "npx", "args": ["@playwright/mcp@0.0.83"] },
//       "jira": { "command": "uvx", "args": ["mcp-atlassian"], "env": { "JIRA_TOKEN": "${JIRA_TOKEN}" } },
//       "remoto": { "type": "http", "url": "https://mcp.exemplo.com/mcp", "headers": { "Authorization": "Bearer ${TOKEN}" } },
//       "desligado": { "command": "x", "disabled": true } } }
// ${NOME} em qualquer texto vem das variáveis do perfil ou do ambiente (o segredo não precisa ficar no JSON).
// Ainda aceita o formato antigo, uma linha por servidor: "nome: comando argumentos".
// No Windows, um comando sem caminho nem .exe (npx, uvx, um .cmd do npm…) roda por "cmd /c": quem
// inicia o servidor (o agente) não usa o shell, e o spawn direto não acha .cmd.

const NAME = /^[A-Za-z0-9_.-]+$/;

const needsCmd = (command) => process.platform === 'win32' && !/[\\/]/.test(command) && !/\.exe$/i.test(command);

/** "a 'b c' \"d\"" → ["a", "b c", "d"] (formato antigo) */
function splitArgs(text) {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(text))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

/** Formato antigo → o mesmo mapa do JSON. */
function fromLines(text) {
  const map = {};
  String(text).split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const m = /^([^:\s]+)\s*:\s*(.+)$/.exec(line);
    if (!m) throw new Error(`Servidor MCP na linha ${i + 1}: use "nome: comando argumentos" (ou o JSON do Claude Code).`);
    const [command, ...args] = splitArgs(m[2]);
    map[m[1]] = { command, args };
  });
  return map;
}

function fromJson(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new Error(`Servidores MCP: JSON inválido (${err.message}).`);
  }
  const map = data?.mcpServers ?? data;
  if (!map || typeof map !== 'object' || Array.isArray(map)) throw new Error('Servidores MCP: esperado { "mcpServers": { "nome": { … } } }.');
  return map;
}

const fill = (value, vars) => String(value).replace(/\$\{([A-Za-z_]\w*)\}/g, (_m, k) => vars[k] ?? '');
const pairs = (obj, vars) => Object.entries(obj || {}).map(([name, value]) => ({ name, value: fill(value, vars) }));

/** Um servidor do mapa → formato do ACP (stdio | http | sse). */
function toAcp(name, cfg, vars) {
  if (!NAME.test(name)) throw new Error(`Servidor MCP “${name}”: use letras, números, . _ ou -.`);
  if (!cfg || typeof cfg !== 'object') throw new Error(`Servidor MCP “${name}”: esperado um objeto.`);
  const type = cfg.type || (cfg.url ? 'http' : 'stdio');
  if (type === 'http' || type === 'sse') {
    if (!cfg.url) throw new Error(`Servidor MCP “${name}”: falta "url".`);
    return { type, name, url: fill(cfg.url, vars), headers: pairs(cfg.headers, vars) };
  }
  if (type !== 'stdio') throw new Error(`Servidor MCP “${name}”: tipo "${type}" não suportado (stdio, http ou sse).`);
  if (!cfg.command) throw new Error(`Servidor MCP “${name}”: falta "command".`);
  const command = fill(cfg.command, vars);
  const args = (cfg.args || []).map((a) => fill(a, vars));
  const env = pairs(cfg.env, vars);
  return needsCmd(command) ? { name, command: 'cmd', args: ['/c', command, ...args], env } : { name, command, args, env };
}

/**
 * Texto do perfil → servidores no formato do ACP. `vars`: para ${NOME} (variáveis do perfil + ambiente).
 * Erros dizem o servidor (ou a linha) com problema.
 */
function parseMcpServers(text, vars = {}) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  const map = raw.startsWith('{') ? fromJson(raw) : fromLines(raw);
  const servers = Object.entries(map)
    .filter(([, cfg]) => !cfg?.disabled)
    .map(([name, cfg]) => toAcp(name, cfg, vars));
  if (servers.some((s) => s.name === 'bash-organizer')) throw new Error('Servidor MCP “bash-organizer” já vem sempre: use outro nome.');
  return servers;
}

module.exports = { parseMcpServers };
