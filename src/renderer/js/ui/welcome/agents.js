// Passo "Agentes de IA" dos Primeiros passos: uma linha por agente (Claude Code, Devin…), cada uma com o
// próximo botão — Instalar, Entrar ou Conectar — até ficar pronta.
import { el } from '../../core/dom.js';
import { icon } from '../icons.js';
import { setup, installAgent, loginAgent, connectAgent, agentConnected, agentReady } from '../../actions/setup.js';

const button = (text, onclick, primary = true) => el('button', { type: 'button', class: `btn${primary ? ' primary' : ''}`, disabled: !!setup.busy, onclick, text });
const note = (text) => el('span', { class: 'folder-note', text });

function next(a) {
  if (!a.installed) {
    return {
      text: a.about,
      action: setup.busy === a.id ? note('Instalando…') : button('Instalar', () => installAgent(a)),
    };
  }
  const version = a.version || 'Instalado';
  if (!a.loggedIn) return { text: `${version} · falta entrar na sua conta (abre num terminal)`, action: button('Entrar', () => loginAgent(a)) };
  if (!agentConnected(a)) {
    return {
      text: `${version} · conectado à sua conta; falta ligá-lo ao app`,
      action: setup.busy === `connect-${a.id}` ? note('Conectando…') : button('Conectar', () => connectAgent(a)),
    };
  }
  return { text: `${version} · pronto: usa seus terminais, tarefas e memória`, action: icon('check', 'wl-ok') };
}

function agentRow(a) {
  const { text, action } = next(a);
  return el(
    'div',
    { class: `wl-agent${agentReady(a) ? ' done' : ''}`, 'data-agent': a.id },
    el('div', { class: 'wl-body' }, el('div', { class: 'wl-agent-name', text: a.label }), el('div', { class: 'wl-text', text })),
    el('div', { class: 'wl-actions' }, action),
  );
}

/** `step(n, opts)` vem da tela (mesmo desenho dos outros passos). */
export function agentsStep(step, agents) {
  return step(2, {
    title: 'Agentes de IA',
    done: agents.some(agentReady),
    text: 'Pelo menos um. Rodam nos terminais de agente e avisam aqui quando precisam de você.',
    extra: el('div', { class: 'wl-agents' }, agents.map(agentRow)),
  });
}
