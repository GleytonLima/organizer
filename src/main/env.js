// Ambiente dos processos filhos (terminais e agentes ACP).
// Se o app foi aberto de dentro de uma sessão do Claude Code (ex.: `npm start` pedido a um
// agente), ele herda variáveis dessa sessão (CLAUDECODE, CLAUDE_CODE_*, ANTHROPIC_BASE_URL…). Elas
// fazem um `claude` iniciado aqui se comportar como sessão filha, com a autenticação da sessão
// hospedeira — que não vale fora dela ("OAuth session expired"). Os filhos não as recebem.
const HOST_SESSION = /^(CLAUDECODE|CLAUDE_CODE_.+|CLAUDE_AGENT_SDK_.+|CLAUDE_PID|CLAUDE_EFFORT|CLAUDE_PREVIEW_.+)$/;

function childEnv(extra = {}) {
  const env = { ...process.env };
  if (env.CLAUDECODE || env.CLAUDE_CODE_HOST_SESSION_ID) {
    for (const key of Object.keys(env)) if (HOST_SESSION.test(key)) delete env[key];
    delete env.ANTHROPIC_BASE_URL; // aponta para o proxy da sessão hospedeira
  }
  return { ...env, ...extra };
}

module.exports = { childEnv };
