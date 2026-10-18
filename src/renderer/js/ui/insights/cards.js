// Cartões do painel Insights: um número principal, linhas de apoio e uma explicação curta do que a
// métrica mede (o "porquê" importa mais que o número). Formatos em pt-BR.
import { el } from '../../core/dom.js';

const MIN = 60000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** 95 min → "1 h 35 min"; 3 dias → "3 d 2 h". */
export function duration(ms) {
  if (ms == null) return '—';
  if (ms < MIN) return `${Math.max(1, Math.round(ms / 1000))} s`;
  if (ms < HOUR) return `${Math.round(ms / MIN)} min`;
  // horas (+ minutos) abaixo de um dia; dias (+ horas) acima
  const [unit, label, sub, subLabel] = ms < DAY ? [HOUR, 'h', MIN, 'min'] : [DAY, 'd', HOUR, 'h'];
  const rest = ms % unit >= sub ? ` ${Math.round((ms % unit) / sub)} ${subLabel}` : '';
  return `${Math.floor(ms / unit)} ${label}${rest}`;
}

/** 1234567 → "1,2 mi"; 12345 → "12 mil". */
export function compact(n) {
  if (n == null) return '—';
  if (n >= 1e6) return `${(n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (n >= 1e4) return `${Math.round(n / 1e3).toLocaleString('pt-BR')} mil`;
  return Math.round(n).toLocaleString('pt-BR');
}

export const money = (v) => (v == null ? null : v.toLocaleString('pt-BR', { style: 'currency', currency: 'USD', maximumFractionDigits: v < 1 ? 3 : 2 }));
export const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');

/** Linha "rótulo · valor". */
export const line = (label, value) => el('div', { class: 'ins-line' }, el('span', { text: label }), el('strong', { text: value }));

/**
 * Cartão: título, número em destaque (com legenda), linhas e, embaixo, a explicação.
 * `extra`: nós a mais (gráfico, lista). `id`: para os testes e para o foco.
 */
export const card = ({ id, title, big, caption, lines = [], extra = null, hint }) =>
  el(
    'section',
    { class: 'ins-card', 'data-card': id },
    el('header', { class: 'ins-card-title', text: title }),
    el('div', { class: 'ins-big', text: big }),
    caption ? el('div', { class: 'ins-caption', text: caption }) : null,
    el('div', { class: 'ins-lines' }, lines),
    extra,
    hint ? el('p', { class: 'ins-hint', text: hint }) : null,
  );

/** Barras por semana (concluídas): SVG simples, cor do tema; o título de cada barra diz o valor. */
export function weekBars(weeks) {
  if (!weeks.length) return null;
  const max = Math.max(1, ...weeks.map((w) => w.done));
  const W = 100 / weeks.length;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 32');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('class', 'ins-bars');
  weeks.forEach((w, i) => {
    const h = Math.max(w.done ? 3 : 1, (w.done / max) * 30);
    const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    Object.entries({ x: i * W + W * 0.15, y: 32 - h, width: W * 0.7, height: h, rx: 1.5, class: w.done ? 'on' : '' }).forEach(([k, v]) => r.setAttribute(k, v));
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    t.textContent = `semana de ${new Date(w.week).toLocaleDateString('pt-BR')}: ${w.done} concluída(s)`;
    r.append(t);
    svg.append(r);
  });
  return svg;
}
