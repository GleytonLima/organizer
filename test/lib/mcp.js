// Cliente MCP mínimo para os testes: inicia `bo mcp` (JSON-RPC via stdio) como um agente faria.
const path = require('path');
const { spawn } = require('child_process');

const BO = path.join(__dirname, '..', '..', 'bin', 'bo.js');

/**
 * `env`: variáveis do agente (BO_API_URL/BO_API_TOKEN, BO_TERMINAL_ID…); `cwd`: pasta de onde o
 * agente roda (vira `fromCwd` nos pedidos).
 */
function startMcp({ env, cwd } = {}) {
  const child = spawn(process.execPath, [BO, 'mcp'], { env: { ...env, ELECTRON_RUN_AS_NODE: '1' }, cwd });
  const waiters = new Map();
  let buf = '';
  let stderr = '';
  let nextId = 0;

  child.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      const msg = JSON.parse(line);
      waiters.get(msg.id)?.(msg);
      waiters.delete(msg.id);
    }
  });
  child.stderr.on('data', (d) => (stderr += d));

  const call = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => reject(new Error(`MCP ${method}: sem resposta em 30 s. ${stderr}`)), 30000);
      waiters.set(id, (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });

  /** Chama uma ferramenta: { ok, data } com o JSON devolvido, ou { ok: false, error }. */
  async function tool(name, args = {}) {
    const r = await call('tools/call', { name, arguments: args });
    if (r.error) return { ok: false, error: r.error.message };
    const text = r.result.content[0].text;
    if (r.result.isError) return { ok: false, error: text };
    try {
      return { ok: true, data: JSON.parse(text) };
    } catch {
      return { ok: true, data: text };
    }
  }

  async function init(name = 'teste') {
    const r = await call('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name, version: '1' } });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    return r.result;
  }

  return { call, tool, init, close: () => child.stdin.end() };
}

module.exports = { startMcp, BO };
