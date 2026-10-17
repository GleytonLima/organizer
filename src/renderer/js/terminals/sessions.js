/* global Terminal, FitAddon, WebLinksAddon */
// Sessões de terminal: uma instância xterm ligada a um pty no processo principal.
import { store, findTerm, persist, notify } from '../core/store.js';
import { el } from '../core/dom.js';
import { currentTheme } from '../themes/apply.js';
import { refreshGit } from '../git/git.js';
import { terminalKeyHandler } from './keys.js';
import { copyOrPaste } from './clipboard.js';

// id -> { term, fit, host, head, exited, running: { cmd, since } | null, lastExit: number | null }
const sessions = new Map();
let container = null;
let onFocusRequest = () => {};

export const getSession = (id) => sessions.get(id);
export const allSessions = () => sessions.entries();
export const activeSession = () => sessions.get(store.state.activeId);

/** Comando em execução no terminal (texto), ou null se estiver no prompt. */
export const runningCommand = (id) => sessions.get(id)?.running?.cmd || null;

/** Estado resumido do processo: 'running' | 'error' | 'exited' | 'idle'. */
export function processStatus(id) {
  const s = sessions.get(id);
  if (!s) return 'idle';
  if (s.exited) return 'exited';
  if (s.running) return 'running';
  return s.lastExit ? 'error' : 'idle';
}

/** `onFocus(id)`: chamado quando o usuário clica num terminal (ex.: na visão lado a lado). */
export function initSessions(node, { onFocus } = {}) {
  container = node;
  if (onFocus) onFocusRequest = onFocus;
  api.onPtyData((id, data) => sessions.get(id)?.term.write(data));
  api.onPtyExit((id) => {
    const s = sessions.get(id);
    if (!s || s.exited) return;
    s.exited = true;
    s.running = null;
    s.term.write('\r\n\x1b[2m[processo encerrado — Enter para reiniciar]\x1b[0m\r\n');
    notify();
  });
}

export function createSession(t) {
  if (sessions.has(t.id)) return sessions.get(t.id);
  // host = cabeçalho (só na visão lado a lado) + corpo onde o xterm é montado
  const head = el('div', { class: 'term-head' });
  const body = el('div', { class: 'term-body' });
  const host = el('div', { class: 'term-host', onmousedown: () => onFocusRequest(t.id) }, head, body);
  container.append(host);

  const term = new Terminal({
    fontFamily: "'Cascadia Mono', 'Cascadia Code', Consolas, monospace",
    fontSize: 13,
    lineHeight: 1.2,
    cursorBlink: true,
    cursorStyle: 'bar',
    scrollback: 10000,
    allowProposedApi: true,
    theme: currentTheme().term,
  });
  const fit = new FitAddon.FitAddon();
  term.loadAddon(fit);
  term.loadAddon(new WebLinksAddon.WebLinksAddon((_e, url) => window.open(url)));
  term.open(body);

  const s = { term, fit, host, head, exited: false, running: null, lastExit: null };
  sessions.set(t.id, s);
  registerShellIntegration(t.id, s);
  term.onData((data) => {
    if (!s.exited) api.ptyWrite(t.id, data);
    else if (data === '\r') restartSession(t.id);
  });
  term.onResize(({ cols, rows }) => api.ptyResize(t.id, cols, rows));
  term.attachCustomKeyEventHandler((e) => terminalKeyHandler(e, s));
  host.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    copyOrPaste(term);
  });

  s.ready = spawn(t, s); // resolve quando o pty existe (antes disso, escritas se perderiam)
  return s;
}

/** Escreve no terminal assim que o pty estiver pronto. */
export async function writeWhenReady(id, data) {
  const s = sessions.get(id);
  if (!s) throw new Error('Terminal não está aberto.');
  await s.ready;
  if (s.exited) throw new Error('O shell deste terminal foi encerrado.');
  api.ptyWrite(id, data);
}

async function spawn(t, s) {
  safeFit(s);
  const r = await api.ptyCreate({ id: t.id, cwd: t.cwd, cols: s.term.cols, rows: s.term.rows });
  if (!r.ok) {
    s.term.write(`\x1b[31m${r.error}\x1b[0m\r\n`);
    s.exited = true;
    return;
  }
  if (r.cwd && r.cwd !== t.cwd) {
    t.cwd = r.cwd;
    persist();
  }
  if (t.startup) api.ptyWrite(t.id, t.startup + '\r');
}

// Sequências emitidas pelo src/main/shell/bash-init.sh.
function registerShellIntegration(id, s) {
  s.term.parser.registerOscHandler(7, (data) => {
    const m = /^file:\/\/[^/]*(\/.*)$/.exec(data);
    if (m) onCwdChange(id, m[1]);
    return true;
  });
  s.term.parser.registerOscHandler(6973, (data) => {
    const [kind, ...rest] = data.split(';');
    const arg = rest.join(';');
    if (kind === 'start') s.running = { cmd: arg, since: Date.now() };
    else if (kind === 'end') [s.running, s.lastExit] = [null, Number(arg) || 0];
    notify();
    return true;
  });
}

export function restartSession(id) {
  const s = sessions.get(id);
  const entry = findTerm(id);
  if (!s || !entry) return;
  api.ptyKill(id);
  Object.assign(s, { running: null, lastExit: null });
  s.exited = false;
  s.term.reset();
  s.ready = spawn(entry.t, s);
  notify();
}

export function destroySession(id) {
  const s = sessions.get(id);
  if (!s) return;
  api.ptyKill(id);
  s.term.dispose();
  s.host.remove();
  sessions.delete(id);
}

async function onCwdChange(id, msysPath) {
  const entry = findTerm(id);
  if (!entry) return;
  const cwd = await api.fromMsys(msysPath);
  if (cwd === entry.t.cwd) return;
  entry.t.cwd = cwd;
  persist();
  await refreshGit(cwd);
  notify();
}

/** Envia uma linha de comando ao terminal ativo. */
export function runInActive(cmd) {
  const s = activeSession();
  if (!s || s.exited) return;
  api.ptyWrite(store.state.activeId, cmd + '\r');
  s.term.focus();
}

function safeFit(s) {
  try {
    s.fit.fit();
  } catch {}
}

/** Ajusta o tamanho de todos os terminais visíveis (ver terminals/layout.js). */
export function fitVisible() {
  for (const s of sessions.values()) if (s.host.classList.contains('visible')) safeFit(s);
}

export const focusActive = () => activeSession()?.term.focus();

export function setTerminalTheme(theme) {
  for (const s of sessions.values()) s.term.options.theme = theme;
}
