// Instruções para registrar o servidor MCP em agentes.
const path = require('path');

function mcpConfig() {
  const runtime = process.execPath; // electron.exe (modo Node) ou node.exe
  const script = path.resolve(__dirname, '..', 'bo.js');
  const json = {
    mcpServers: {
      'bash-organizer': { command: runtime, args: [script, 'mcp'], env: { ELECTRON_RUN_AS_NODE: '1' } },
    },
  };
  return [
    'Claude Code (todas as pastas):',
    `  claude mcp add -s user -e ELECTRON_RUN_AS_NODE=1 bash-organizer -- "${runtime}" "${script}" mcp`,
    '',
    'Outros agentes (Devin, Cursor…), no arquivo de configuração MCP:',
    JSON.stringify(json, null, 2),
    '',
    'Dica: rode o agente dentro de um terminal do Bash Organizer para que os terminais',
    'que ele abrir entrem automaticamente no mesmo grupo.',
  ].join('\n');
}

module.exports = { mcpConfig };
