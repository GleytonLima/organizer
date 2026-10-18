// Como iniciar um agente ACP (Agent Client Protocol) a partir do perfil escolhido no app.
//   Perfil embutido "claude": adaptador @agentclientprotocol/claude-agent-acp (usa o login do Claude
//   Code), rodando com o próprio runtime do app (Electron em modo Node, ≥ 22).
//   Perfil próprio: { command, args, env } — ex.: `gemini --experimental-acp`. Roda pelo shell, porque
//   CLIs instalados pelo npm no Windows são .cmd.
// BO_ACP_AGENT substitui o comando de qualquer agente (testes): '["executável", "script"]' ou "exe script".
const path = require('path');

const unpacked = (p) => p.replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);

const builtinClaude = () => ({
  command: process.execPath,
  args: [unpacked(require.resolve('@agentclientprotocol/claude-agent-acp/dist/index.js'))],
  env: { ELECTRON_RUN_AS_NODE: '1' },
  shell: false,
});

/** Variáveis do perfil: texto "NOME=valor" por linha (linhas vazias e # são ignoradas). */
function parseEnv(text) {
  const env = {};
  for (const line of String(text || '').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line);
    if (m && !line.trim().startsWith('#')) env[m[1]] = m[2].trim();
  }
  return env;
}

/** `profile`: { id, command?, args?, env? } — sem command, só o embutido "claude" é aceito. */
function agentCommand(profile = {}) {
  const override = process.env.BO_ACP_AGENT;
  if (override) {
    const [command, ...args] = override.trim().startsWith('[') ? JSON.parse(override) : override.split(' ');
    return { command, args, env: { ELECTRON_RUN_AS_NODE: '1', ...parseEnv(profile.env) }, shell: false };
  }
  if (profile.command?.trim()) {
    const line = [profile.command.trim(), String(profile.args || '').trim()].filter(Boolean).join(' ');
    return { command: line, args: [], env: parseEnv(profile.env), shell: true };
  }
  if ((profile.id || 'claude') !== 'claude') throw new Error(`O perfil “${profile.label || profile.id}” não tem comando.`);
  return { ...builtinClaude(), env: { ...builtinClaude().env, ...parseEnv(profile.env) } };
}

/** Servidor MCP do Brain Organizer para o agente (quadro, memória, terminais), via `bo mcp`. */
function boMcpServer(env) {
  const script = unpacked(path.resolve(__dirname, '..', '..', '..', 'bin', 'bo.js'));
  const vars = { ELECTRON_RUN_AS_NODE: '1', ...env };
  return { name: 'bash-organizer', command: process.execPath, args: [script, 'mcp'], env: Object.entries(vars).map(([name, value]) => ({ name, value: String(value) })) };
}

module.exports = { agentCommand, boMcpServer, parseEnv };
