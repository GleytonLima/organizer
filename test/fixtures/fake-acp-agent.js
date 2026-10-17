// Agente ACP falso para os testes (JSON-RPC por linha no stdio). A cada prompt:
//   plano → mensagem em partes → ferramenta "Editar config.json" → pede permissão (permitir/recusar)
//   → conclui a ferramenta (ou desiste, se recusada) → mensagem final → end_turn.
// Prompt com "sem permissão" pula o pedido; "erro" responde com erro JSON-RPC. No modo
// "acceptEdits" não pede permissão. FAKE_GREETING (variável do perfil) abre a 1ª resposta.
// Sessões ficam num arquivo (FAKE_ACP_STORE) para session/load e session/list entre processos.
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');

const STORE = process.env.FAKE_ACP_STORE || path.join(os.tmpdir(), 'bo-fake-acp-sessions.json');
const load = () => { try { return JSON.parse(fs.readFileSync(STORE, 'utf8')); } catch { return {}; } };
const save = (all) => fs.writeFileSync(STORE, JSON.stringify(all));
const MODES = [{ id: 'default', name: 'Padrão' }, { id: 'acceptEdits', name: 'Aceitar edições' }, { id: 'plan', name: 'Planejar' }];
// Como o adaptador do Claude: modelo, esforço e modo como opções de configuração; comandos de "/".
const MODELS = [{ value: 'rapido', name: 'Rápido', description: 'Respostas curtas' }, { value: 'forte', name: 'Forte', description: 'Para tarefas difíceis' }];
const EFFORTS = { rapido: ['low', 'medium'], forte: ['low', 'medium', 'high', 'max'] };
const COMMANDS = [
  { name: 'revisar', description: 'Revisa as mudanças pendentes', input: null },
  { name: 'resumir', description: 'Resume a conversa', input: { hint: '<tamanho>' } },
  { name: 'ajuda', description: 'Mostra a ajuda', input: null },
];
const config = { model: 'rapido', effort: 'low' };
const configOptions = () => [
  { id: 'mode', name: 'Mode', category: 'mode', type: 'select', currentValue: mode, options: MODES.map((m) => ({ value: m.id, name: m.name })) },
  { id: 'model', name: 'Model', category: 'model', type: 'select', currentValue: config.model, options: MODELS },
  { id: 'effort', name: 'Effort', category: 'thought_level', type: 'select', currentValue: config.effort, options: EFFORTS[config.model].map((v) => ({ value: v, name: v })) },
];

let seq = 1000;
let mode = 'default';
let cancelled = false;
const pending = new Map();
const send = (msg) => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...msg })}\n`);
const update = (sessionId, u) => send({ method: 'session/update', params: { sessionId, update: u } });
const ask = (method, params) => new Promise((resolve) => { const id = ++seq; pending.set(id, resolve); send({ id, method, params }); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (sessionId, text) => update(sessionId, { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } });

function remember(sessionId, role, text) {
  const all = load();
  (all[sessionId] ||= { cwd: process.cwd(), title: null, messages: [] }).messages.push({ role, text });
  all[sessionId].title ||= text.slice(0, 40);
  all[sessionId].updatedAt = new Date().toISOString();
  save(all);
}

async function prompt(id, { sessionId, prompt: blocks }) {
  const text = blocks.map((b) => b.text || '').join(' ');
  if (text.includes('erro')) return send({ id, error: { code: -32000, message: 'Falha simulada do agente.' } });
  cancelled = false;
  remember(sessionId, 'user', text);
  update(sessionId, { sessionUpdate: 'plan', entries: [{ content: 'Ler a config', priority: 'high', status: 'completed' }, { content: 'Editar a config', priority: 'high', status: 'pending' }] });
  if (text.startsWith('/')) {
    say(sessionId, `Comando ${text.split(' ')[0]} executado (modelo ${config.model}, esforço ${config.effort}).`);
    return send({ id, result: { stopReason: 'end_turn' } });
  }
  const greeting = process.env.FAKE_GREETING ? `${process.env.FAKE_GREETING} ` : '';
  for (const part of [greeting, 'Entendi: ', `"${text}". `, 'Vou editar a config.']) {
    if (part) say(sessionId, part);
    await wait(30);
  }
  update(sessionId, { sessionUpdate: 'tool_call', toolCallId: 't1', title: 'Editar config.json', kind: 'edit', status: 'pending' });
  let allowed = true;
  if (!text.includes('sem permissão') && mode !== 'acceptEdits') {
    const r = await ask('session/request_permission', {
      sessionId,
      toolCall: { toolCallId: 't1', title: 'Editar config.json', kind: 'edit' },
      options: [{ optionId: 'allow', name: 'Permitir', kind: 'allow_once' }, { optionId: 'reject', name: 'Recusar', kind: 'reject_once' }],
    });
    allowed = r?.outcome?.outcome === 'selected' && r.outcome.optionId === 'allow';
  }
  if (cancelled) return send({ id, result: { stopReason: 'cancelled' } });
  update(sessionId, { sessionUpdate: 'tool_call_update', toolCallId: 't1', status: allowed ? 'completed' : 'failed' });
  const final = allowed ? '\nPronto: config atualizada.' : '\nOk, não editei.';
  say(sessionId, final);
  remember(sessionId, 'agent', `Vou editar a config.${final}`);
  send({ id, result: { stopReason: 'end_turn' } });
}

function loadSession(id, { sessionId }) {
  const s = load()[sessionId];
  if (!s) return send({ id, error: { code: -32002, message: 'Sessão não encontrada.' } });
  for (const m of s.messages) update(sessionId, { sessionUpdate: m.role === 'user' ? 'user_message_chunk' : 'agent_message_chunk', content: { type: 'text', text: m.text } });
  send({ id, result: { modes: { currentModeId: mode, availableModes: MODES } } });
}

const HANDLERS = {
  initialize: () => ({ protocolVersion: 1, agentCapabilities: { loadSession: true, sessionCapabilities: { list: {} } }, authMethods: [] }),
  'session/new': (p) => {
    const sessionId = `fake-${Date.now()}-${p.mcpServers.length}`;
    setTimeout(() => update(sessionId, { sessionUpdate: 'available_commands_update', availableCommands: COMMANDS }), 20);
    return { sessionId, modes: { currentModeId: mode, availableModes: MODES }, configOptions: configOptions() };
  },
  'session/set_config_option': (p) => {
    if (p.configId === 'mode') mode = p.value;
    else config[p.configId] = p.value;
    if (p.configId === 'model' && !EFFORTS[p.value].includes(config.effort)) config.effort = EFFORTS[p.value][0];
    return { configOptions: configOptions() };
  },
  'session/set_mode': (p) => {
    mode = p.modeId;
    update(p.sessionId, { sessionUpdate: 'current_mode_update', currentModeId: mode });
    return {};
  },
  'session/list': (p) => ({
    sessions: Object.entries(load())
      .filter(([, s]) => s.cwd === p.cwd)
      .map(([sessionId, s]) => ({ sessionId, cwd: s.cwd, title: s.title, updatedAt: s.updatedAt })),
  }),
};

readline.createInterface({ input: process.stdin }).on('line', (line) => {
  const msg = JSON.parse(line);
  if (msg.id != null && !msg.method) return pending.get(msg.id)?.(msg.result);
  if (msg.method === 'session/cancel') return (cancelled = true);
  if (msg.method === 'session/prompt') return prompt(msg.id, msg.params);
  if (msg.method === 'session/load') return loadSession(msg.id, msg.params);
  const fn = HANDLERS[msg.method];
  if (fn) send({ id: msg.id, result: fn(msg.params) });
  else if (msg.id != null) send({ id: msg.id, error: { code: -32601, message: `não suportado: ${msg.method}` } });
});
