// Sessão de agente (terminal do tipo "agente"): conversa com o agente via ACP em vez de um pty.
// Tem a mesma interface das sessões de terminal usada pelo resto do app (host, ready, running,
// focus, send, readLines, restart, dispose), então lado a lado, sidebar e avisos funcionam igual.
// Itens da conversa: user | agent | thought | tool | plan | permission | error | turn.
import { el } from '../core/dom.js';
import { notify } from '../core/store.js';
import { renderAgentView } from '../ui/agent/view.js';
import { onPrompt, onPermission, onPermissionAnswered, onTurnEnd } from '../actions/agent-tasks.js';

const STATE_LABEL = { iniciando: 'iniciando…', pronto: 'pronto', trabalhando: 'trabalhando…', encerrado: 'encerrado' };

/** Há um pedido de permissão sem resposta? */
const waitingYou = (s) => s.items.some((i) => i.type === 'permission' && i.answer === undefined);

/** Aplica um session/update à conversa. */
function applyUpdate(s, u) {
  const last = s.items.at(-1);
  const text = u.content?.type === 'text' ? u.content.text : '';
  switch (u.sessionUpdate) {
    case 'agent_message_chunk':
      if (last?.type === 'agent') last.text += text;
      else s.items.push({ type: 'agent', text });
      break;
    case 'agent_thought_chunk':
      if (last?.type === 'thought') last.text += text;
      else s.items.push({ type: 'thought', text });
      break;
    case 'tool_call':
      s.items.push({ type: 'tool', id: u.toolCallId, title: u.title, kind: u.kind || 'other', status: u.status || 'pending' });
      break;
    case 'tool_call_update': {
      const tool = s.items.findLast((i) => i.type === 'tool' && i.id === u.toolCallId);
      if (tool) Object.assign(tool, u.title && { title: u.title }, u.status && { status: u.status });
      break;
    }
    case 'plan': {
      const plan = s.items.findLast((i) => i.type === 'plan');
      if (plan && s.items.indexOf(plan) > s.items.findLastIndex((i) => i.type === 'user')) plan.entries = u.entries;
      else s.items.push({ type: 'plan', entries: u.entries || [] });
      break;
    }
    default:
      break; // outros tipos (comandos disponíveis, modo, uso…) não aparecem por enquanto
  }
}

function handle(s, ev) {
  if (ev.type === 'state') {
    s.state = ev.state;
    s.exited = ev.state === 'encerrado';
    s.running = ev.state === 'trabalhando' ? { cmd: `${s.label} trabalhando`, since: s.running?.since || Date.now() } : null;
  } else if (ev.type === 'update') applyUpdate(s, ev.update);
  else if (ev.type === 'permission') {
    const item = { type: 'permission', requestId: ev.requestId, title: ev.toolCall?.title || 'Ação do agente', options: ev.options || [], answer: undefined };
    s.items.push(item);
    onPermission(s.id, item);
  } else if (ev.type === 'permission-answered') {
    const item = s.items.find((i) => i.type === 'permission' && i.requestId === ev.requestId);
    if (item) item.answer = ev.optionId;
    onPermissionAnswered(s.id, item);
  } else if (ev.type === 'turn') {
    s.items.push({ type: 'turn', stopReason: ev.stopReason });
    s.lastExit = ev.stopReason === 'end_turn' ? 0 : 1;
    onTurnEnd(s.id, s.items.findLast((i) => i.type === 'agent')?.text || '', ev.stopReason);
  } else if (ev.type === 'error') s.items.push({ type: 'error', text: ev.message });
  if (s.running) s.running.cmd = waitingYou(s) ? `${s.label} aguardando você` : `${s.label} trabalhando`;
  s.render();
  notify();
}

const sessionsById = new Map();

/** Liga os eventos do processo principal às sessões (uma vez). */
export function initAgentEvents() {
  api.acp.onEvent((id, ev) => {
    const s = sessionsById.get(id);
    if (s) handle(s, ev);
  });
}

export function createAgentSession(t, { container, onFocus }) {
  const head = el('div', { class: 'term-head' });
  const body = el('div', { class: 'term-body agent-body' });
  const host = el('div', { class: 'term-host agent-host', onmousedown: onFocus }, head, body);
  container.append(host);

  const s = {
    agent: true,
    id: t.id,
    label: t.agentLabel || 'Agente',
    host, head, body,
    items: [],
    state: 'iniciando',
    exited: false, running: null, lastExit: null,
    stateLabel: () => (s.state === 'trabalhando' && waitingYou(s) ? 'aguardando você' : STATE_LABEL[s.state] || s.state),
    /** Envia uma mensagem ao agente (também usado por "responder no terminal de origem"). */
    send(text) {
      const clean = String(text || '').trim();
      if (!clean) return;
      if (s.state !== 'pronto') throw new Error(s.state === 'trabalhando' ? 'O agente ainda está trabalhando.' : 'A sessão do agente não está pronta.');
      s.items.push({ type: 'user', text: clean });
      onPrompt(t.id, clean);
      s.render();
      return api.acp.prompt(t.id, clean);
    },
    answer: (requestId, optionId) => api.acp.permission(t.id, requestId, optionId),
    cancel: () => api.acp.cancel(t.id),
    focus: () => body.querySelector('textarea')?.focus(),
    readLines(count = 40) {
      const text = s.items.map((i) => (i.type === 'user' ? `> ${i.text}` : i.type === 'agent' ? i.text : i.type === 'tool' ? `[${i.status}] ${i.title}` : '')).join('\n');
      return text.split('\n').slice(-count).join('\n');
    },
    restart() {
      s.items = [];
      s.ready = api.acp.start(t.id, { agent: t.agent || 'claude', cwd: t.cwd });
      s.render();
    },
    dispose() {
      api.acp.stop(t.id);
      sessionsById.delete(t.id);
    },
    render: () => renderAgentView(s),
  };
  sessionsById.set(t.id, s);
  s.restart();
  return s;
}
