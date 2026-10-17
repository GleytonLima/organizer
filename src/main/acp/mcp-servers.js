// Servidores MCP extras do perfil de agente (além do Bash Organizer), passados no session/new.
// Texto do perfil, um por linha: "nome: comando argumentos" — ex.: "playwright: npx @playwright/mcp@latest".
// Linhas vazias e # são ignoradas; argumentos com espaço vão entre aspas.
// No Windows, um comando sem caminho nem .exe (npx, uvx, um .cmd do npm…) roda por "cmd /c": quem
// inicia o servidor (o agente) não usa o shell, e o spawn direto não acha .cmd.

const NAME = /^[A-Za-z0-9_.-]+$/;

/** "a 'b c' \"d\"" → ["a", "b c", "d"] */
function splitArgs(text) {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(text))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

const needsCmd = (command) => process.platform === 'win32' && !/[\\/]/.test(command) && !/\.exe$/i.test(command);

/** Texto do perfil → [{ name, command, args, env: [] }] no formato do ACP (stdio). Erros dizem a linha. */
function parseMcpServers(text) {
  const servers = [];
  String(text || '').split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const m = /^([^:\s]+)\s*:\s*(.+)$/.exec(line);
    if (!m || !NAME.test(m[1])) throw new Error(`Servidor MCP na linha ${i + 1}: use "nome: comando argumentos".`);
    const [command, ...args] = splitArgs(m[2]);
    servers.push(needsCmd(command) ? { name: m[1], command: 'cmd', args: ['/c', command, ...args], env: [] } : { name: m[1], command, args, env: [] });
  });
  const names = servers.map((s) => s.name);
  const dup = names.find((n, i) => names.indexOf(n) !== i || n === 'bash-organizer');
  if (dup) throw new Error(`Servidor MCP “${dup}” repetido (bash-organizer já vem sempre).`);
  return servers;
}

module.exports = { parseMcpServers };
