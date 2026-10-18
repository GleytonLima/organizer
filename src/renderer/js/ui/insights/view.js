// Painel Insights (tela cheia, como o quadro): fluxo, espera humana, custo, assertividade do agente e
// retrabalho do período e do escopo escolhidos. Dados locais (ver metrics/insights.js).
import { el, mount } from '../../core/dom.js';
import { store } from '../../core/store.js';
import { setTaskView } from '../../actions/tasks.js';
import { insights, insightsSettings, setInsights, refreshInsights, INSIGHT_PERIODS } from '../../metrics/insights.js';
import { iconButton } from '../components.js';
import { icon } from '../icons.js';
import { showMenu } from '../menu.js';
import { openModal, field } from '../modal.js';
import { card, line, duration, compact, money, pct, weekBars } from './cards.js';

const isOn = () => store.state.taskView === 'insights';
const plural = (n, one, many) => (n === 1 ? one : many);

/** Botão da barra superior. */
export const insightsButton = () =>
  iconButton('chart', 'Insights: fluxo, espera, custo e qualidade', () => setTaskView(isOn() ? 'off' : 'insights'), `tasks-btn${isOn() ? ' on' : ''}`);

const menuButton = (label, items) =>
  el('button', { class: 'period-btn', onclick: (e) => showMenu(e, items()) }, el('span', { text: label }), icon('chevron'));

/** Exporta os feedbacks (JSONL) para onde você escolher. */
async function exportFeedback() {
  const r = await api.feedback.exportAll();
  if (r) await openModal({ title: 'Feedback exportado', message: `${r.count} feedback(s) em ${r.path}` });
}

async function pricesDialog() {
  const p = insightsSettings().prices || {};
  const v = await openModal({
    title: 'Preços dos tokens',
    message: 'US$ por milhão de tokens, como na sua conta ou contrato — o app não sabe o preço, só conta os tokens. Deixe vazio para não estimar.',
    fields: [
      field.text('in', 'Entrada', p.in ?? '', { placeholder: 'ex.: 3' }),
      field.text('out', 'Saída', p.out ?? '', { placeholder: 'ex.: 15' }),
      field.text('cacheRead', 'Leitura de cache', p.cacheRead ?? '', { placeholder: 'ex.: 0,3' }),
      field.text('cacheWrite', 'Escrita de cache', p.cacheWrite ?? '', { placeholder: 'ex.: 3,75' }),
    ],
    submit: 'Salvar',
  });
  if (!v) return;
  const num = (s) => (String(s).trim() ? Number(String(s).replace(',', '.')) || 0 : null);
  const prices = Object.fromEntries(Object.entries(v).map(([k, s]) => [k, num(s)]));
  setInsights({ prices: Object.values(prices).some(Boolean) ? prices : null });
}

function header(d) {
  const s = insightsSettings();
  return el(
    'header',
    { class: 'kb-header' },
    el('h2', { class: 'kb-title', text: 'Insights' }),
    el('span', { class: 'ins-scope', text: d.scope.map((p) => p.name).join(', ') || '—' }),
    d.loading ? el('span', { class: 'ins-loading', text: 'carregando…' }) : null,
    el('span', { class: 'spacer' }),
    menuButton(s.scope === 'all' ? 'Todos os projetos' : 'Projeto em foco', () => [
      { label: 'Projeto em foco', checked: s.scope !== 'all', action: () => setInsights({ scope: 'project' }) },
      { label: 'Todos os projetos', checked: s.scope === 'all', action: () => setInsights({ scope: 'all' }) },
    ]),
    menuButton(d.period.label, () => INSIGHT_PERIODS.map((p) => ({ label: p.label, checked: p.id === d.period.id, action: () => setInsights({ period: p.id }) }))),
    el('button', { class: 'btn small ghost', onclick: pricesDialog, text: 'Preços…' }),
    el('button', { class: 'btn small ghost', onclick: exportFeedback, title: 'Seus feedbacks com a foto do contexto, um por linha (JSONL), para análise', text: 'Exportar feedback…' }),
    iconButton('refresh', 'Atualizar', refreshInsights),
    iconButton('close', 'Voltar aos terminais', () => setTaskView('off')),
  );
}

function cards(d) {
  const cost = d.cost.cost != null ? money(d.cost.cost) : null;
  return [
    card({
      id: 'flow', title: 'Fluxo', big: String(d.flow.done), caption: plural(d.flow.done, 'tarefa concluída', 'tarefas concluídas'),
      lines: [line('lead time mediano', duration(d.flow.leadMedianMs)), line('criadas', String(d.flow.created)), line('em aberto agora', String(d.flow.open))],
      extra: weekBars(d.flow.weeks),
      hint: 'Lead time: da criação à primeira chegada na última coluna. Barras: concluídas por semana.',
    }),
    card({
      id: 'waiting', title: 'Espera humana', big: duration(d.waiting.totalMs), caption: 'de agentes esperando você',
      lines: [line('esperas', String(d.waiting.count)), line('resposta mediana', duration(d.waiting.medianMs)), line('esperando agora', String(d.waiting.open))],
      hint: 'Com agentes, o gargalo costuma ser a decisão humana: do “Em espera” até a sua resposta.',
    }),
    card({
      id: 'cost', title: 'Custo', big: compact(d.cost.tokens.total), caption: cost ? `tokens · ${cost} estimados` : 'tokens (defina os preços para estimar US$)',
      lines: [line('turnos do agente', String(d.cost.turns)), line('tokens por tarefa', compact(d.cost.tokensPerTask)), ...(d.cost.costPerTask != null ? [line('custo por tarefa', money(d.cost.costPerTask))] : []),
        ...d.cost.byModel.slice(0, 3).map((m) => line(m.model, compact(m.total)))],
      hint: 'Tokens que o adaptador do agente informa a cada turno (entrada, saída e cache).',
    }),
    card({
      id: 'agent', title: 'Assertividade do agente', big: pct(d.agent.turns - d.agent.interrupted, d.agent.turns), caption: 'dos turnos sem interrupção',
      lines: [line('interrompidos', `${d.agent.interrupted} de ${d.agent.turns}`), line('permissões negadas', `${d.agent.denied} de ${d.agent.permissions}`),
        line('turnos por tarefa', d.agent.turnsPerTask == null ? '—' : d.agent.turnsPerTask.toLocaleString('pt-BR', { maximumFractionDigits: 1 })), line('você responde em', duration(d.agent.answerMedianMs))],
      hint: 'Interromper ou negar é sinal de que o agente foi por um caminho que você não queria.',
    }),
    card({
      id: 'rework', title: 'Retrabalho', big: String(d.rework.reopened), caption: `${plural(d.rework.reopened, 'tarefa reaberta', 'tarefas reabertas')} depois de concluída(s)`,
      lines: [line('falhas de teste (Playwright)', String(d.rework.testFailures)), line('comandos com erro', `${d.rework.failedCommands} de ${d.rework.commands} (${pct(d.rework.failedCommands, d.rework.commands)})`),
        ...d.rework.top.map((c) => line(`  ${c.program}`, `${c.n} erro(s)`))],
      hint: '“Pronto” que volta a abrir, teste que quebra e comando que falha custam mais do que parecem.',
    }),
  ];
}

export function renderInsights(node) {
  const d = insights();
  mount(node, header(d), d.error ? el('div', { class: 'mem-warning', text: d.error }) : null, el('div', { class: 'ins-grid' }, cards(d)));
}
