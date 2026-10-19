// Primeiros passos (na área do quadro, como a Home): Git Bash, Claude Code, a integração entre os dois
// e o primeiro projeto a partir de uma pasta. Cada passo diz o que está pronto ou resolve com um botão.
import { el, mount } from '../../core/dom.js';
import { store } from '../../core/store.js';
import { iconButton } from '../components.js';
import { icon } from '../icons.js';
import { setup, installStep, loginClaude, connectClaude, closeWelcome, machineReady } from '../../actions/setup.js';
import { projectFromFolder } from '../../actions/project-folder.js';

const GIT_SITE = 'https://git-scm.com/download/win';

const button = (text, onclick, { primary = false, disabled = false } = {}) =>
  el('button', { type: 'button', class: `btn${primary ? ' primary' : ''}`, disabled: disabled || !!setup.busy, onclick, text });

const working = (name, text) => (setup.busy === name ? el('span', { class: 'folder-note', text }) : null);

function step(n, { title, done, text, actions = [], extra = null }) {
  return el(
    'section',
    { class: `wl-step${done ? ' done' : ''}` },
    el('span', { class: 'wl-mark' }, done ? icon('check') : el('span', { text: String(n) })),
    el('div', { class: 'wl-body' }, el('div', { class: 'wl-title', text: title }), el('p', { class: 'wl-text', text }), extra),
    el('div', { class: 'wl-actions' }, actions),
  );
}

function gitStep(s) {
  if (s.bash) return step(1, { title: 'Git Bash', done: true, text: `Encontrado em ${s.bash.replace(/\\bin\\bash\.exe$/i, '')}` });
  return step(1, {
    title: 'Git Bash',
    text: 'Os terminais do app rodam no Git Bash, que vem com o Git for Windows.',
    actions: s.winget
      ? [working('git', 'Instalando…'), button('Instalar o Git', () => installStep('git'), { primary: true })]
      : [el('a', { class: 'btn primary', href: GIT_SITE, target: '_blank', text: 'Baixar o Git' })],
  });
}

function claudeStep(c) {
  if (c.installed && c.loggedIn) return step(2, { title: 'Claude Code', done: true, text: `${c.version || 'Instalado'} · conectado à sua conta` });
  if (c.installed) return step(2, { title: 'Claude Code', text: 'Instalado; falta entrar na sua conta (abre num terminal).', actions: [button('Entrar', loginClaude, { primary: true })] });
  return step(2, {
    title: 'Claude Code',
    text: 'O agente dos terminais de agente. Opcional: sem ele, terminais e tarefas funcionam.',
    actions: [working('claude', 'Instalando…'), button('Instalar o Claude Code', () => installStep('claude'), { primary: true })],
  });
}

function integrationStep(c) {
  if (c.mcp && c.hooks) return step(3, { title: 'Claude Code ↔ Brain Organizer', done: true, text: 'O agente usa seus terminais, tarefas e memória e avisa aqui quando precisa de você.' });
  return step(3, {
    title: 'Claude Code ↔ Brain Organizer',
    text: 'Um clique: o agente passa a usar seus terminais, tarefas e memória e a avisar aqui quando termina.',
    actions: [working('integrate', 'Conectando…'), button('Conectar', connectClaude, { primary: true, disabled: !c.installed })],
  });
}

/** Arraste a pasta para o cartão (ou escolha pelo botão). */
function projectStep() {
  const project = store.state.projects.find((p) => p.repos.length);
  const onDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) projectFromFolder(api.filePath(file));
  };
  const node = step(4, {
    title: 'Primeiro projeto',
    done: !!project,
    text: project ? `Pronto: “${project.name}”. Abra outro quando quiser.` : 'Arraste a pasta do projeto para cá. O app acha os repositórios e os comandos (npm run dev…) e monta os terminais.',
    actions: [button(project ? 'Outra pasta…' : 'Abrir pasta…', () => projectFromFolder(), { primary: !project })],
  });
  node.addEventListener('dragover', (e) => (e.preventDefault(), node.classList.add('drop')));
  node.addEventListener('dragleave', () => node.classList.remove('drop'));
  node.addEventListener('drop', onDrop);
  return node;
}

const logPanel = () => (setup.busy || setup.log.length ? el('pre', { class: 'wl-log', text: setup.log.slice(-12).join('\n') || '…' }) : null);

export function renderWelcome(node) {
  const s = setup.status;
  mount(
    node,
    el('header', { class: 'kb-header' }, el('h2', { class: 'kb-title', text: 'Primeiros passos' }), el('span', { class: 'spacer' }), iconButton('close', 'Fechar', closeWelcome)),
    el(
      'div',
      { class: 'welcome' },
      el('div', {}, el('h2', { class: 'wl-hello', text: 'Vamos deixar tudo pronto' }), el('p', { class: 'wl-line', text: machineReady(s) ? 'Esta máquina está pronta. Falta só o seu projeto?' : 'Três verificações e o seu primeiro projeto. Leva um minuto.' })),
      s ? [gitStep(s), claudeStep(s.claude), integrationStep(s.claude), projectStep()] : el('p', { class: 'wl-text', text: 'Verificando esta máquina…' }),
      setup.error ? el('p', { class: 'wl-error', text: setup.error }) : null,
      logPanel(),
      el('div', { class: 'wl-footer' }, el('span', { class: 'spacer' }), button(machineReady(s) ? 'Começar' : 'Pular por agora', closeWelcome, { primary: machineReady(s) })),
    ),
  );
}
