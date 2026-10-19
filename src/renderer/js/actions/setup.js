// Primeiros passos: o que falta nesta máquina (Git Bash, Claude Code, integração), instalar com a saída
// ao vivo, entrar no Claude Code e conectá-lo ao app. A tela fica em ui/welcome/; o processo principal,
// em src/main/setup/.
import { el } from '../core/dom.js';
import { store, notify, currentGroup } from '../core/store.js';
import { cleanError } from '../core/errors.js';
import { openModal } from '../ui/modal.js';
import { setTaskView } from './tasks.js';
import { newTerminal } from './terminals.js';

const MAX_LOG = 200;
const POLL_MS = 4000;
const LOGIN_WAIT_MS = 10 * 60 * 1000;

/** Estado da tela (não vai para o state.json). */
export const setup = { status: null, busy: null, log: [], error: null };

export const isWelcomeOpen = () => store.state.taskView === 'welcome';

/** Tudo pronto nesta máquina (o projeto é à parte). */
export const machineReady = (s = setup.status) => !!(s?.bash && s.claude.installed && s.claude.loggedIn && s.claude.mcp && s.claude.hooks);

export async function refreshSetup() {
  try {
    setup.status = await api.setup.check();
  } catch (err) {
    setup.error = cleanError(err);
  }
  notify();
}

let poll = null;
/** Enquanto a tela está aberta e falta algo, verifica de novo (ex.: você entrou no Claude Code). */
function startPolling() {
  clearInterval(poll);
  poll = setInterval(() => {
    if (!isWelcomeOpen()) return clearInterval(poll);
    if (!setup.busy && !machineReady()) refreshSetup();
  }, POLL_MS);
}

export function openWelcome() {
  setTaskView('welcome');
  refreshSetup();
  startPolling();
}

export const closeWelcome = () => setTaskView('off');

export function initSetup() {
  api.setup.onLog((_step, line) => {
    setup.log.push(line);
    if (setup.log.length > MAX_LOG) setup.log.shift();
    notify();
  });
}

async function busy(name, fn) {
  setup.busy = name;
  setup.error = null;
  notify();
  try {
    await fn();
  } catch (err) {
    setup.error = cleanError(err);
  }
  setup.busy = null;
  await refreshSetup();
}

/** 'git' | 'claude': instala pelo winget / instalador oficial, com a saída na tela. */
export const installStep = (step) =>
  busy(step, async () => {
    setup.log = [];
    const r = await api.setup.install(step);
    if (!r.ok) throw new Error(`A instalação terminou com erro (código ${r.code}). Veja a saída abaixo.`);
  });

/** Abre um terminal com o `claude` (ele pede o login) e volta aos Primeiros passos quando você entrar. */
export function loginClaude() {
  newTerminal(currentGroup(), { name: 'Claude Code', startup: 'claude' });
  setTaskView('off');
  const until = Date.now() + LOGIN_WAIT_MS;
  const wait = setInterval(async () => {
    if (Date.now() > until) return clearInterval(wait);
    const s = await api.setup.check().catch(() => null);
    if (!s?.claude.loggedIn) return;
    clearInterval(wait);
    setup.status = s;
    openWelcome();
  }, POLL_MS);
}

function previewContent(p) {
  return el(
    'div',
    { class: 'setup-preview' },
    el('p', { class: 'eyebrow', text: 'Servidor MCP no Claude Code (todas as pastas)' }),
    el('pre', { text: p.mcp }),
    el('p', { class: 'eyebrow', text: `Avisos (hooks) em ${p.settings}` }),
    el('pre', { text: p.hooks.join('\n') }),
    el('p', { class: 'folder-note', text: `O resto do arquivo fica como está; antes, uma cópia vai para ${p.backup}.` }),
  );
}

/** Mostra o que será gravado e, com o seu OK, registra o MCP e os hooks. */
export async function connectClaude() {
  const ok = await openModal({
    title: 'Conectar o Claude Code',
    message: 'O Claude Code passa a usar seus terminais, tarefas e memória e avisa aqui quando termina ou precisa de você.',
    content: previewContent(await api.setup.preview()),
    submit: 'Conectar',
    wide: true,
  });
  if (ok) await busy('integrate', () => api.setup.integrate());
}
