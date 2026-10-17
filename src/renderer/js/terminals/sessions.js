/* global Terminal, FitAddon, WebLinksAddon */
// Sessões de terminal: uma instância xterm ligada a um pty no processo principal.
import { store, findTerm, persist, notify } from '../core/store.js';
import { el } from '../core/dom.js';
import { currentTheme } from '../themes/apply.js';
import { refreshGit } from '../git/git.js';
import { terminalKeyHandler } from './keys.js';
import { copyOrPaste } from './clipboard.js';

const sessions = new Map(); // id -> { term, fit, host, exited }
let container = null;

export const getSession = (id) => sessions.get(id);
export const activeSession = () => sessions.get(store.state.activeId);

export function initSessions(node) {
  container = node;
  api.onPtyData((id, data) => sessions.get(id)?.term.write(data));
  api.onPtyExit((id) => {
    const s = sessions.get(id);
    if (!s || s.exited) return;
    s.exited = true;
    s.term.write('\r\n\x1b[2m[processo encerrado — Enter para reiniciar]\x1b[0m\r\n');
    notify();
  });
  new ResizeObserver(fitActive).observe(container);
}

export function createSession(t) {
  if (sessions.has(t.id)) return sessions.get(t.id);
  const host = el('div', { class: 'term-host' });
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
  term.open(host);

  const s = { term, fit, host, exited: false };
  sessions.set(t.id, s);

  // O hook do bash emite OSC 7 com o $PWD a cada prompt.
  term.parser.registerOscHandler(7, (data) => {
    const m = /^file:\/\/[^/]*(\/.*)$/.exec(data);
    if (m) onCwdChange(t.id, m[1]);
    return true;
  });
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

  spawn(t, s);
  return s;
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

export function restartSession(id) {
  const s = sessions.get(id);
  const entry = findTerm(id);
  if (!s || !entry) return;
  api.ptyKill(id);
  s.exited = false;
  s.term.reset();
  spawn(entry.t, s);
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

export function syncVisibility() {
  for (const [id, s] of sessions) s.host.classList.toggle('active', id === store.state.activeId);
}

function safeFit(s) {
  try {
    s.fit.fit();
  } catch {}
}

export function fitActive() {
  const s = activeSession();
  if (s) safeFit(s);
}

export const focusActive = () => activeSession()?.term.focus();

export function setTerminalTheme(theme) {
  for (const s of sessions.values()) s.term.options.theme = theme;
}
