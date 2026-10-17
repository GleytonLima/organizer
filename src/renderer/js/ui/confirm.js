// Confirmações de ações destrutivas, cientes dos processos em execução.
import { termLabel } from '../core/format.js';
import { runningCommand } from '../terminals/sessions.js';
import { openModal } from './modal.js';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Resume o que será encerrado: "3 terminais, 2 em execução (npm run dev, …)". */
export function describeTerminals(terminals) {
  const running = terminals.map((t) => [t, runningCommand(t.id)]).filter(([, cmd]) => cmd);
  const base = plural(terminals.length, 'terminal será encerrado', 'terminais serão encerrados');
  if (!running.length) return base + '.';
  const list = running.map(([t, cmd]) => `${termLabel(t)}: ${cmd}`).join(' · ');
  return `${base}, ${plural(running.length, 'com processo', 'com processos')} em execução — ${list}`;
}

export const hasRunning = (terminals) => terminals.some((t) => runningCommand(t.id));

export function confirmDanger({ title, message, submit = 'Excluir' }) {
  return openModal({ title, message, submit, danger: true });
}
