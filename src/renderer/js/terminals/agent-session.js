// Sessão de agente (terminal do tipo "agente"): conversa com o agente do perfil via ACP em vez de
// um pty. Tem a mesma interface das sessões de terminal usada pelo resto do app (host, ready,
// running, focus, send, readLines, restart, dispose), então lado a lado, sidebar e avisos funcionam.
// Guarda o id da sessão no terminal (t.acpSessionId): ao reabrir o app, continua de onde parou.
import { el } from '../core/dom.js';
import { notify, persist } from '../core/store.js';
import { profileById } from '../agents/profiles.js';
import { renderAgentView } from '../ui/agent/view.js';
import { onPrompt, onPermission, onPermissionAnswered, onTurnEnd } from '../actions/agent-tasks.js';
import { applyUpdate, permissionItem, waitingYou, transcriptText } from './agent-transcript.js';

const STATE_LABEL = { iniciando: 'iniciando…', pronto: 'pronto', trabalhando: 'trabalhando…', encerrado: 'encerrado' };

function handle(s, ev) {
  if (ev.type === 'state') {
    s.state = ev.state;
    s.exited = ev.state === 'encerrado';
    s.running = ev.state === 'trabalhando' ? { cmd: `${s.label} trabalhando`, since: s.running?.since || Date.now() } : null;
  } else if (ev.type === 'session') {
    s.t.acpSessionId = ev.sessionId;
    if (ev.resumed) s.items.push({ type: 'note', text: 'Sessão anterior retomada.' });
    persist();
  } else if (ev.type === 'capabilities') s.caps = ev;
  else if (ev.type === 'modes') s.modes = { current: ev.current, available: ev.available };
  else if (ev.type === 'config') s.config = ev.options;
  else if (ev.type === 'update') applyUpdate(s, ev.update);
  else if (ev.type === 'permission') {
    const item = permissionItem(ev);
    s.items.push(item);
    onPermission(s.id, item);
  } else if (ev.type === 'permission-answered') {
    const item = s.items.find((i) => i.type === 'permission' && i.requestId === ev.requestId);
    if (item) item.answer = ev.optionId;
    onPermissionAnswered(s.id, item);
  } else if (ev.type === 'turn') {
    s.items.push({ type: 'turn', stopReason: ev.stopReason });
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
    t,
    host, head, body,
    items: [],
    state: 'iniciando',
    modes: null,
    config: null, // opções do agente (modelo, esforço, modo…)
    commands: [], // comandos de / anunciados pelo agente
    caps: null,
    exited: false, running: null, lastExit: null,
    get label() {
      return profileById(t.agent).label;
    },
    stateLabel: () => (s.state === 'trabalhando' && waitingYou(s) ? 'aguardando você' : STATE_LABEL[s.state] || s.state),
    /** Envia uma mensagem ao agente, com anexos opcionais (`ui/agent/attachments.js`); também usado por "responder no terminal de origem". */
    send(text, attachments = []) {
      const clean = String(text || '').trim();
      if (!clean && !attachments.length) return;
      if (s.state !== 'pronto') throw new Error(s.state === 'trabalhando' ? 'O agente ainda está trabalhando.' : 'A sessão do agente não está pronta.');
      s.items.push({ type: 'user', text: clean, attachments: attachments.map(({ kind, name, url, path }) => ({ kind, name, url, path })) });
      onPrompt(t.id, clean || `Anexos: ${attachments.map((a) => a.name).join(', ')}`);
      s.render();
      return api.acp.prompt(t.id, clean, attachments.map(({ url, ...a }) => a));
    },
    answer: (requestId, optionId) => api.acp.permission(t.id, requestId, optionId),
    cancel: () => api.acp.cancel(t.id),
    setMode: (modeId) => api.acp.setMode(t.id, modeId),
    setConfig: (configId, value) => api.acp.setConfig(t.id, configId, value),
    listSessions: () => api.acp.sessions(t.id),
    focus: () => body.querySelector('textarea')?.focus(),
    readLines: (count = 40) => transcriptText(s, count),
    /**
     * (Re)inicia o agente. `resume`: id da sessão a continuar — padrão, a última deste terminal;
     * null abre uma sessão nova.
     */
    restart({ resume = t.acpSessionId || null } = {}) {
      s.items = [];
      s.modes = null;
      s.config = null;
      s.commands = [];
      if (!resume) t.acpSessionId = null;
      s.ready = api.acp.start(t.id, { profile: { ...profileById(t.agent) }, cwd: t.cwd, resume });
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
