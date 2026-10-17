// Agente ACP falso para os testes (JSON-RPC por linha no stdio). A cada prompt:
//   plano → mensagem em partes → ferramenta "Editar config.json" → pede permissão (permitir/recusar)
//   → conclui a ferramenta (ou desiste, se recusada) → mensagem final → end_turn.
// Prompt contendo "sem permissão" pula o pedido; "erro" responde com erro JSON-RPC.
const readline = require('readline');

let seq = 1000;
const pending = new Map();
const send = (msg) => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...msg })}\n`);
const update = (sessionId, u) => send({ method: 'session/update', params: { sessionId, update: u } });
const ask = (method, params) =>
  new Promise((resolve) => {
    const id = ++seq;
    pending.set(id, resolve);
    send({ id, method, params });
  });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let cancelled = false;

async function prompt(id, { sessionId, prompt: blocks }) {
  const text = blocks.map((b) => b.text || '').join(' ');
  if (text.includes('erro')) return send({ id, error: { code: -32000, message: 'Falha simulada do agente.' } });
  cancelled = false;
  update(sessionId, { sessionUpdate: 'plan', entries: [{ content: 'Ler a config', priority: 'high', status: 'completed' }, { content: 'Editar a config', priority: 'high', status: 'pending' }] });
  for (const part of ['Entendi: ', `"${text}". `, 'Vou editar a config.']) {
    update(sessionId, { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: part } });
    await wait(30);
  }
  update(sessionId, { sessionUpdate: 'tool_call', toolCallId: 't1', title: 'Editar config.json', kind: 'edit', status: 'pending' });
  let allowed = true;
  if (!text.includes('sem permissão')) {
    const r = await ask('session/request_permission', {
      sessionId,
      toolCall: { toolCallId: 't1', title: 'Editar config.json', kind: 'edit' },
      options: [
        { optionId: 'allow', name: 'Permitir', kind: 'allow_once' },
        { optionId: 'reject', name: 'Recusar', kind: 'reject_once' },
      ],
    });
    allowed = r?.outcome?.outcome === 'selected' && r.outcome.optionId === 'allow';
  }
  if (cancelled) return send({ id, result: { stopReason: 'cancelled' } });
  update(sessionId, { sessionUpdate: 'tool_call_update', toolCallId: 't1', status: allowed ? 'completed' : 'failed' });
  update(sessionId, { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: allowed ? '\nPronto: config atualizada.' : '\nOk, não editei.' } });
  send({ id, result: { stopReason: 'end_turn' } });
}

readline.createInterface({ input: process.stdin }).on('line', (line) => {
  const msg = JSON.parse(line);
  if (msg.id != null && !msg.method) return pending.get(msg.id)?.(msg.result);
  if (msg.method === 'initialize') return send({ id: msg.id, result: { protocolVersion: 1, agentCapabilities: {}, authMethods: [] } });
  if (msg.method === 'session/new') return send({ id: msg.id, result: { sessionId: `fake-${msg.params.mcpServers.length}` } });
  if (msg.method === 'session/prompt') return prompt(msg.id, msg.params);
  if (msg.method === 'session/cancel') cancelled = true;
});
