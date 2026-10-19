// Home: a primeira coisa que você vê ao abrir o app (na área do quadro, como o Insights).
// Responde duas perguntas — "o que precisa de mim?" e "onde eu parei?" — e resume o que aconteceu
// enquanto você esteve fora. Feita para o "AI brain fry": uma tela só, calma, no lugar de dez avisos.
import { el, remount } from '../../core/dom.js';
import { store, notify } from '../../core/store.js';
import { waitingItems, resumeItems, awaySummary, isEmptySummary } from '../../home/data.js';
import { closeHome, openHome, isHomeOpen, replyWithSuggestions, setFocusMode } from '../../actions/home.js';
import { iconButton } from '../components.js';
import { waitingCard, resumeCard } from './cards.js';

const drafts = {}; // respostas em edição, por tarefa (sobrevivem aos re-renders)
const selected = new Set(); // esperas marcadas para responder em lote
const away = { since: null, decisions: [] }; // decisões novas desde a última visita (memória, assíncrono)

export const homeButton = () => {
  const waiting = waitingItems().length;
  return iconButton('home', waiting ? `Início — ${waiting} esperando você` : 'Início', () => (isHomeOpen() ? closeHome() : openHome()),
    `tasks-btn${isHomeOpen() ? ' on' : ''}${waiting ? ' has-waiting' : ''}`);
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

async function loadDecisions(since) {
  if (away.since === since) return;
  away.since = since;
  away.decisions = [];
  if (!since) return;
  const items = await api.memory.list({ kind: 'decision', limit: 30 }).catch(() => []);
  away.decisions = items.filter((m) => m.createdAt > since && !/^você/.test(m.source || ''));
  notify();
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function header(waiting) {
  const line = waiting ? `${plural(waiting, 'coisa esperando você', 'coisas esperando você')}.` : 'Nada esperando você.';
  return el('header', { class: 'home-head' },
    el('div', {}, el('h2', { class: 'home-hello', text: greeting() }), el('p', { class: 'home-line', text: line })),
    el('span', { class: 'spacer' }),
    el('label', { class: 'home-focus', title: 'Com o modo foco, só um agente esperando você vira aviso do Windows; o resto fica aqui.' },
      el('input', { type: 'checkbox', checked: store.state.focusMode, onchange: (e) => setFocusMode(e.target.checked) }), 'Modo foco'),
    iconButton('close', 'Voltar aos terminais', closeHome));
}

function waitingSection(items) {
  const picked = items.filter(({ task }) => selected.has(task.id));
  const batch = picked.length
    ? el('div', { class: 'home-batch' }, el('span', { text: `${plural(picked.length, 'marcada', 'marcadas')}` }), el('span', { class: 'spacer' }),
      el('button', { type: 'button', class: 'btn primary', onclick: async () => { await replyWithSuggestions(picked.map((x) => x.task)); selected.clear(); },
        text: `Responder ${picked.length === 1 ? 'com a sugestão' : 'todas com as sugestões'}` }))
    : null;
  return el('section', { class: 'home-section' },
    el('h3', { class: 'home-h', text: 'Aguardando você' }),
    items.length ? [batch, items.map((it) => waitingCard(it, drafts, selected, notify))] : el('div', { class: 'home-calm', text: 'Nada esperando você ✓  Os agentes seguem trabalhando.' }));
}

function resumeSection(items) {
  if (!items.length) return null;
  return el('section', { class: 'home-section' }, el('h3', { class: 'home-h', text: 'Continue de onde parou' }), el('div', { class: 'home-grid' }, items.map(resumeCard)));
}

function awaySection(summary) {
  const d = away.decisions;
  if (isEmptySummary(summary) && !d.length) return null;
  const titles = (list) => list.slice(0, 3).map((t) => t.title).join(' · ') + (list.length > 3 ? ' …' : '');
  const rows = [
    summary.done.length ? [plural(summary.done.length, 'tarefa concluída', 'tarefas concluídas'), titles(summary.done)] : null,
    summary.created.length ? [plural(summary.created.length, 'tarefa nova', 'tarefas novas'), titles(summary.created)] : null,
    summary.reports ? [plural(summary.reports, 'relato dos agentes', 'relatos dos agentes'), ''] : null,
    d.length ? [plural(d.length, 'decisão nova na memória', 'decisões novas na memória'), d.slice(0, 2).map((m) => m.text).join(' · ')] : null,
    summary.people.length ? ['Do time', summary.people.join(', ')] : null,
  ].filter(Boolean);
  return el('section', { class: 'home-section' }, el('h3', { class: 'home-h', text: 'Enquanto você esteve fora' }),
    el('ul', { class: 'home-away' }, rows.map(([a, b]) => el('li', {}, el('strong', { text: a }), b ? el('span', { class: 'hint', text: b }) : null))));
}

export function renderHome(node) {
  const since = store.state.homeSeenAt;
  loadDecisions(since);
  const waiting = waitingItems();
  for (const id of selected) if (!waiting.some(({ task }) => task.id === id)) selected.delete(id);
  remount(node, el('div', { class: 'home' }, header(waiting.length), waitingSection(waiting), resumeSection(resumeItems()), awaySection(awaySummary(since) || { done: [], created: [], reports: 0, people: [] })));
}
