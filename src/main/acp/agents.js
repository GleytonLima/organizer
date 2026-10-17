// Agentes que falam ACP (Agent Client Protocol) e como iniciá-los.
//   claude — adaptador @agentclientprotocol/claude-agent-acp (usa o login do Claude Code), rodando
//            com o próprio runtime do app (Electron em modo Node, ≥ 22).
// BO_ACP_AGENT substitui o comando de qualquer agente (testes): '["executável", "script"]' ou "exe script".
const path = require('path');

const unpacked = (p) => p.replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);

const AGENTS = {
  claude: {
    label: 'Claude Code',
    command: () => ({
      command: process.execPath,
      args: [unpacked(require.resolve('@agentclientprotocol/claude-agent-acp/dist/index.js'))],
      env: { ELECTRON_RUN_AS_NODE: '1' },
    }),
  },
};

function agentCommand(id) {
  const override = process.env.BO_ACP_AGENT;
  if (override) {
    // lista JSON (["exe", "script"]) ou texto separado por espaço
    const [command, ...args] = override.trim().startsWith('[') ? JSON.parse(override) : override.split(' ');
    return { command, args, env: { ELECTRON_RUN_AS_NODE: '1' } };
  }
  const agent = AGENTS[id];
  if (!agent) throw new Error(`Agente ACP desconhecido: ${id}`);
  return agent.command();
}

/** Servidor MCP do Bash Organizer para o agente (quadro, memória, terminais), via `bo mcp`. */
function boMcpServer(env) {
  const script = unpacked(path.resolve(__dirname, '..', '..', '..', 'bin', 'bo.js'));
  const vars = { ELECTRON_RUN_AS_NODE: '1', ...env };
  return { name: 'bash-organizer', command: process.execPath, args: [script, 'mcp'], env: Object.entries(vars).map(([name, value]) => ({ name, value: String(value) })) };
}

const agentList = () => Object.entries(AGENTS).map(([id, a]) => ({ id, label: a.label }));

module.exports = { agentCommand, boMcpServer, agentList };
