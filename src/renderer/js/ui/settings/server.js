// Configurações → Servidor do time. Sem servidor o app é 100% local; conectar é opcional.
//   1. endereço → o app pergunta ao servidor como entrar (probe);
//   2. "Entrar com <provedor>" pelo navegador (SSO) ou token pessoal;
//   3. conectado: quem você é, o estado do sync, os projetos compartilhados e Desconectar.
import { el } from '../../core/dom.js';
import { notify } from '../../core/store.js';
import { cleanError } from '../../core/errors.js';
import { syncView } from '../../memory/sync.js';
import { openModal } from '../modal.js';
import { sharedProjectsList } from './shared-projects.js';
import { syncStateText } from '../sync-indicator.js';

// step: url | method | waiting | token
const ui = { settings: null, step: 'url', url: '', token: '', info: null, error: '', busy: false };

export async function refreshServer() {
  ui.settings = await api.sync.settings();
  if (!ui.url) ui.url = ui.settings.url || '';
  notify();
}

const set = (patch) => {
  Object.assign(ui, patch);
  notify();
};

async function run(patch, fn) {
  set({ ...patch, busy: true, error: '' });
  try {
    await fn();
  } catch (err) {
    set({ error: cleanError(err) });
  } finally {
    set({ busy: false });
  }
}

const probe = () =>
  run({}, async () => {
    const info = await api.sync.probe(ui.url);
    set({ info, url: info.url, step: info.sso ? 'method' : 'token' });
  });

const loginBrowser = () =>
  run({ step: 'waiting' }, async () => {
    try {
      ui.settings = await api.sync.loginBrowser(ui.url);
      set({ step: 'url', info: null });
    } catch (err) {
      ui.step = ui.info?.sso ? 'method' : 'url';
      throw err;
    }
  });

const loginToken = () =>
  run({}, async () => {
    ui.settings = await api.sync.loginToken(ui.url, ui.token);
    set({ step: 'url', token: '', info: null });
  });

async function disconnect() {
  const ok = await openModal({
    title: 'Desconectar do servidor?',
    message: 'Seus projetos, tarefas e memórias continuam nesta máquina. Os projetos compartilhados param de sincronizar até você conectar de novo.',
    submit: 'Desconectar',
    danger: true,
  });
  if (ok) run({}, async () => (ui.settings = await api.sync.disconnect()));
}

const error = () => (ui.error ? el('p', { class: 'set-error', text: ui.error }) : null);
const field = (key, attrs) => el('input', { class: 'input', 'data-draft': key, value: ui[key], oninput: (e) => (ui[key] = e.target.value), ...attrs });

function connectCard() {
  const host = ui.info ? new URL(ui.info.url).host : '';
  const steps = {
    url: [
      el('div', { class: 'set-inline' }, field('url', { placeholder: 'https://memoria.empresa.com', onkeydown: (e) => e.key === 'Enter' && probe() }), el('button', { type: 'button', class: 'btn primary', disabled: ui.busy, onclick: probe, text: ui.busy ? 'Verificando…' : 'Continuar' })),
    ],
    method: [
      el('p', { class: 'set-ok', text: `${host} · servidor de memória encontrado` }),
      el('button', { type: 'button', class: 'btn primary set-wide', onclick: loginBrowser, text: `Entrar com ${ui.info?.provider}` }),
      ui.info?.personalTokens ? el('button', { type: 'button', class: 'link set-center', onclick: () => set({ step: 'token' }), text: 'Usar um token pessoal' }) : null,
      el('p', { class: 'set-hint set-center', text: 'O login abre no seu navegador; o app nunca vê sua senha.' }),
    ],
    waiting: [
      el('p', { class: 'set-ok', text: 'Conclua o login no navegador…' }),
      el('button', { type: 'button', class: 'btn', onclick: () => api.sync.cancelLogin(), text: 'Cancelar' }),
    ],
    token: [
      el('p', { class: 'set-hint', text: `${host ? `${host} · ` : ''}Cole um token pessoal (bom_…), criado na web do servidor ou pelo administrador.` }),
      el('div', { class: 'set-inline' }, field('token', { placeholder: 'bom_…', type: 'password', onkeydown: (e) => e.key === 'Enter' && loginToken() }), el('button', { type: 'button', class: 'btn primary', disabled: ui.busy, onclick: loginToken, text: 'Entrar' })),
    ],
  };
  return el(
    'div',
    { class: 'set-card' },
    el('div', { class: 'set-row-title', text: 'Trabalhe sozinho ou com o time' }),
    el('p', { class: 'set-hint', text: 'O app funciona inteiro nesta máquina. Conecte um servidor de memória para compartilhar memória e quadro de tarefas com o time e abrir seus projetos em outra máquina.' }),
    steps[ui.step],
    ui.step !== 'url' && ui.step !== 'waiting' ? el('button', { type: 'button', class: 'link', onclick: () => set({ step: 'url', error: '' }), text: 'Usar outro endereço' }) : null,
    error(),
  );
}

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

function accountCard() {
  const s = ui.settings;
  const expired = syncView.status.state === 'auth';
  return el(
    'div',
    { class: 'set-card' },
    el(
      'div',
      { class: 'set-account' },
      el('div', { class: 'set-avatar', text: initials(s.account?.name) }),
      el('div', { class: 'set-row-text' }, el('div', { class: 'set-row-title', text: s.account?.name || 'Conectado' }), el('div', { class: 'set-hint', text: [s.account?.email, new URL(s.url).host].filter(Boolean).join(' · ') })),
      el('span', { class: `sync-pill${expired ? ' warn' : ''}`, text: syncStateText() }),
    ),
    expired
      ? el('div', { class: 'set-banner' }, el('span', { text: 'Sua sessão expirou. Entre de novo para voltar a sincronizar — nada do que você fez aqui se perde.' }), el('button', { type: 'button', class: 'btn primary', onclick: () => set({ step: 'url', url: s.url, settings: { ...s, hasToken: false } }), text: 'Entrar de novo' }))
      : null,
    sharedProjectsList(),
    el(
      'div',
      { class: 'set-inline' },
      el('button', { type: 'button', class: 'btn', onclick: () => api.sync.now(), text: 'Sincronizar agora' }),
      el('button', { type: 'button', class: 'btn', onclick: async () => (await import('../../actions/project-remote.js')).openRemoteProject(), text: 'Abrir projeto do servidor…' }),
      el('span', { class: 'spacer' }),
      el('button', { type: 'button', class: 'btn ghost', onclick: disconnect, text: 'Desconectar' }),
    ),
    error(),
  );
}

export function serverSection() {
  if (!ui.settings) {
    refreshServer();
    return el('p', { class: 'set-hint', text: 'Carregando…' });
  }
  return [el('h3', { class: 'set-title', text: 'Servidor do time' }), ui.settings.hasToken ? accountCard() : connectCard()];
}
