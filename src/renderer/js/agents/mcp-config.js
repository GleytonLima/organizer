// Servidores MCP do perfil de agente, do lado da interface: o JSON padrão do Claude Code / Claude
// Desktop ({ "mcpServers": { nome: { command, args, env } | { type: "http"|"sse", url, headers } } }).
// O processo principal monta os servidores (src/main/acp/mcp-servers.js); aqui: validar ao salvar,
// converter o formato antigo (uma linha "nome: comando args") e acrescentar o Playwright.

// versão fixa (não @latest): um pacote novo comprometido rodaria com os seus direitos e o token da API
export const PLAYWRIGHT = { command: 'npx', args: ['@playwright/mcp@0.0.83'] };

const NAME = /^[A-Za-z0-9_.-]+$/;

/** Formato antigo ("nome: comando args", uma por linha) → mapa do JSON. */
function fromLines(text) {
  const map = {};
  String(text).split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const colon = line.indexOf(':');
    const name = line.slice(0, colon).trim();
    const [command, ...args] = line.slice(colon + 1).trim().split(/\s+/).filter(Boolean);
    if (colon < 1 || /\s/.test(name) || !command) throw new Error(`Servidor MCP na linha ${i + 1}: use o JSON do Claude Code ({ "mcpServers": { … } }).`);
    map[name] = { command, args };
  });
  return map;
}

/** Texto do perfil → mapa nome → configuração (aceita JSON com ou sem "mcpServers", ou o formato antigo). */
export function mcpMap(text) {
  const raw = String(text || '').trim();
  if (!raw) return {};
  if (!raw.startsWith('{')) return fromLines(raw);
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Servidores MCP: JSON inválido (${err.message}).`);
  }
  const map = data?.mcpServers ?? data;
  if (!map || typeof map !== 'object' || Array.isArray(map)) throw new Error('Servidores MCP: esperado { "mcpServers": { "nome": { … } } }.');
  return map;
}

/** Confere cada servidor (nome, command ou url); lança com a mensagem do primeiro problema. */
export function checkMcp(text) {
  for (const [name, cfg] of Object.entries(mcpMap(text))) {
    if (!NAME.test(name)) throw new Error(`Servidor MCP “${name}”: use letras, números, . _ ou -.`);
    if (name === 'brain-organizer') throw new Error('Servidor MCP “brain-organizer” já vem sempre: use outro nome.');
    if (!cfg || typeof cfg !== 'object') throw new Error(`Servidor MCP “${name}”: esperado um objeto.`);
    const remote = cfg.type === 'http' || cfg.type === 'sse' || (!cfg.type && cfg.url);
    if (remote ? !cfg.url : !cfg.command) throw new Error(`Servidor MCP “${name}”: falta "${remote ? 'url' : 'command'}".`);
  }
}

/** JSON bonito do mapa (vazio → ""). */
export const formatMcp = (map) => (Object.keys(map).length ? JSON.stringify({ mcpServers: map }, null, 2) : '');

/** Texto para mostrar no editor: sempre JSON (o formato antigo é convertido). */
export function mcpForEditor(text) {
  try {
    return formatMcp(mcpMap(text));
  } catch {
    return String(text || ''); // inválido: mostra como está, para a pessoa corrigir
  }
}

/** Acrescenta o Playwright (se ainda não houver um "playwright"). */
export function withPlaywright(text) {
  const map = mcpMap(text);
  map.playwright ??= PLAYWRIGHT;
  return formatMcp(map);
}
