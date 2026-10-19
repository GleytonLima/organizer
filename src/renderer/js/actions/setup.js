// Primeiros passos: o que falta nesta máquina (Git Bash e os agentes de IA), instalar com a saída ao
// vivo (ou num terminal, quando o instalador é interativo), entrar na conta e conectar o agente ao app.
// A tela fica em ui/welcome/; o processo principal, em src/main/setup/.
import { el } from '../core/dom.js';
import { store, notify, currentGroup } from '../core/store.js';
import { cleanError } from '../core/errors.js';
import { openModal } from '../ui/modal.js';
import { agentProfileFor, ensureAgentProfile } from '../agents/profiles.js';
import { setTaskView } from './tasks.js';
import { newTerminal } from './terminals.js';

const MAX_LOG = 200;
const POLL_MS = 4000;
const WAIT_MS = 10 * 60 * 1000;

/** Estado da tela (não vai para o state.json). */
export const setup = { status: null, busy: null, log: [], error: null };

export const isWelcomeOpen = () => store.state.taskView === 'welcome';

const readyAt = {};
/** Desde quando `key` está pronto (para o check se desenhar uma vez só); null se não está. */
export function doneSince(key, done) {
  if (!done) return (delete readyAt[key], null);
  return (readyAt[key] ||= Date.now());
}

/** Conectado: MCP (e hooks) no agente e, se ele roda por ACP, o perfil no app. */
export const agentConnected = (a) => a.connected && (!a.acp || !!agentProfileFor(a.id));
export const agentReady = (a) => a.installed && a.loggedIn && agentConnected(a);
/** Pronta: Git Bash e pelo menos um agente pronto (o projeto é à parte). */
export const machineReady = (s = setup.status) => !!(s?.bash && s.agents.some(agentReady));

export async function refreshSetup() {
  try {
    setup.status = await api.setup.check();
  } catch (err) {
    setup.error = cleanError(err);
  }
  notify();
}

let poll = null;
/** Enquanto a tela está aberta e falta algo, verifica de novo (ex.: você entrou num agente). */
function startPolling() {
  clearInterval(poll);
  poll = setInterval(() => {
    if (!isWelcomeOpen()) return clearInterval(poll);
    if (!setup.busy && !setup.status?.agents.every(agentReady)) refreshSetup();
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

/** Instala em segundo plano ('git' ou o id de um agente), com a saída na tela. */
export const installStep = (step) =>
  busy(step, async () => {
    setup.log = [];
    const r = await api.setup.install(step);
    if (!r.ok) throw new Error(`A instalação terminou com erro (código ${r.code}). Veja a saída abaixo.`);
  });

/** Roda `line` num terminal novo e volta aos Primeiros passos quando `done(agente)` ficar verdadeiro. */
function inTerminal(agentId, name, line, done) {
  newTerminal(currentGroup(), { name, startup: line });
  setTaskView('off');
  const until = Date.now() + WAIT_MS;
  const wait = setInterval(async () => {
    if (Date.now() > until) return clearInterval(wait);
    const s = await api.setup.check().catch(() => null);
    if (!s || !done(s.agents.find((a) => a.id === agentId))) return;
    clearInterval(wait);
    setup.status = s;
    openWelcome();
  }, POLL_MS);
}

/** Instalar: em segundo plano, ou num terminal quando o instalador termina pedindo o login. */
export function installAgent(a) {
  if (a.installMode === 'terminal') return inTerminal(a.id, `Instalar ${a.label}`, a.installCommand, (x) => x?.installed && x.loggedIn);
  return installStep(a.id);
}

/** Entrar: o login do agente num terminal (abre o navegador); a tela percebe quando você entrou. */
export const loginAgent = (a) => inTerminal(a.id, a.label, a.loginCommand, (x) => x?.loggedIn);

function previewContent(p) {
  return el(
    'div',
    { class: 'setup-preview' },
    p.items.map((it) => [el('p', { class: 'eyebrow', text: it.title }), el('pre', { text: it.text })]),
    p.note ? el('p', { class: 'folder-note', text: p.note }) : null,
  );
}

/** Mostra o que será gravado e, com o seu OK, conecta o agente (e cria o perfil ACP, se for o caso). */
export async function connectAgent(a) {
  const ok = await openModal({
    title: `Conectar o ${a.label}`,
    message: `O ${a.label} passa a usar seus terminais, tarefas e memória.`,
    content: previewContent(await api.setup.preview(a.id)),
    submit: 'Conectar',
    wide: true,
  });
  if (!ok) return;
  await busy(`connect-${a.id}`, async () => {
    const r = await api.setup.connect(a.id);
    if (r?.profile) ensureAgentProfile(r.profile);
  });
}
