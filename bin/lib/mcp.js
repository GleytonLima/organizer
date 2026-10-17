// Servidor MCP mínimo (JSON-RPC 2.0 sobre stdio, uma mensagem por linha).
const path = require('path');
const readline = require('readline');
const { request } = require('./client');
const { TOOLS } = require('./tools');
// Em desenvolvimento, package.json está na raiz; empacotado, dentro do app.asar (vizinho de app.asar.unpacked).
const version = (() => {
  const candidates = ['../../package.json', path.join(__dirname.replace('app.asar.unpacked', 'app.asar'), '..', '..', 'package.json')];
  for (const file of candidates) {
    try {
      return require(file).version;
    } catch {}
  }
  return '0.0.0';
})();

const INSTRUCTIONS = [
  'Controla terminais Git Bash no app Bash Organizer, que o usuário está vendo.',
  'Terminais abertos sem "group" entram no mesmo grupo do terminal onde você roda, mantendo tudo associado.',
  'Para subir serviços de longa duração (backend, frontend), use open_terminal com "command" e um "group" como "Serviços",',
  'depois wait_for_output para confirmar que subiram. Não feche terminais do usuário sem ele pedir.',
  'O app também tem um quadro de tarefas (kanban) por projeto que o usuário acompanha: registre trabalho relevante com',
  'create_task, consulte list_columns para entender o fluxo e mova com move_task, relate andamento com report_progress,',
  'use request_input quando precisar de uma decisão e complete_task ao terminar.',
  'Há também uma memória persistente do projeto: no início, rode list_decisions para se contextualizar; antes de propor',
  'algo, consulte search_memory; registre decisões tomadas com record_decision (uma frase com o porquê) e fatos úteis com remember_note.',
].join(' ');

const write = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');
const reply = (id, result) => write({ jsonrpc: '2.0', id, result });
const fail = (id, code, message) => write({ jsonrpc: '2.0', id, error: { code, message } });

async function callTool(id, { name, arguments: args = {} }) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return fail(id, -32602, `Ferramenta desconhecida: ${name}`);
  try {
    const result = await tool.run(request, args);
    reply(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] });
  } catch (err) {
    reply(id, { content: [{ type: 'text', text: err.message }], isError: true });
  }
}

function handle(msg) {
  const { id, method, params = {} } = msg;
  switch (method) {
    case 'initialize':
      return reply(id, {
        protocolVersion: params.protocolVersion || '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'bash-organizer', version },
        instructions: INSTRUCTIONS,
      });
    case 'ping':
      return reply(id, {});
    case 'tools/list':
      return reply(id, { tools: TOOLS.map(({ run, ...def }) => def) });
    case 'tools/call':
      return callTool(id, params);
    default:
      // notificações (sem id) são ignoradas; métodos desconhecidos com id recebem erro
      if (id !== undefined) fail(id, -32601, `Método não suportado: ${method}`);
  }
}

function serve() {
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', (line) => {
    if (!line.trim()) return;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return fail(null, -32700, 'JSON inválido');
    }
    handle(msg);
  });
  rl.on('close', () => process.exit(0));
}

module.exports = { serve };
