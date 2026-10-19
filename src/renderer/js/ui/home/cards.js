// Cartões da Home: uma espera (responda ali mesmo — a resposta vai ao terminal do agente) e uma
// frente de trabalho em andamento (um clique e você está no terminal certo).
import { el, stop } from '../../core/dom.js';
import { termLabel, timeAgo } from '../../core/format.js';
import { replyToTask } from '../../actions/task-waiting.js';
import { answerFromTask } from '../../actions/agent-tasks.js';
import { resumeTask } from '../../actions/home.js';
import { setTaskView } from '../../actions/tasks.js';
import { openTask } from '../tasks/selection.js';
import { dot } from '../components.js';
import { icon } from '../icons.js';
import { reportPreview } from '../../tasks/report-text.js';

const ALLOW = new Set(['allow_once', 'allow_always']);

/** Abre a tarefa na gaveta (painel de tarefas), saindo da Home. */
export function openInPanel(task) {
  setTaskView('panel');
  openTask(task.id);
}

const where = (project, task) =>
  el('div', { class: 'home-where' }, dot(project.color), el('span', { text: project.name }), el('span', { class: 'home-key', text: task.key }));

/** `drafts`: respostas em edição por tarefa; `selected`: Set de ids marcados para responder em lote. */
function replyBox(task, drafts, send) {
  const box = el('textarea', { class: 'input textarea', rows: 2, 'data-draft': `home-${task.id}`, placeholder: 'Sua resposta para o agente…',
    oninput: (e) => (drafts[task.id] = e.target.value),
    onkeydown: (e) => e.key === 'Enter' && e.ctrlKey && (e.preventDefault(), send()) });
  box.value = drafts[task.id]; // textarea: o valor é propriedade, não atributo
  return box;
}

export function waitingCard({ task, project, origin }, drafts, selected, refresh) {
  const w = task.needsInput;
  const choices = w.choices?.length;
  if (drafts[task.id] === undefined) drafts[task.id] = w.suggestion?.text || '';
  const send = async () => {
    if (!drafts[task.id].trim()) return;
    await replyToTask(task, drafts[task.id]);
    delete drafts[task.id];
    selected.delete(task.id);
  };
  const pick = w.suggestion && !choices
    ? el('input', { type: 'checkbox', class: 'home-pick', title: 'Marcar para responder em lote', checked: selected.has(task.id),
      onchange: (e) => (e.target.checked ? selected.add(task.id) : selected.delete(task.id), refresh()) })
    : null;
  const answer = choices
    ? el('div', { class: 'home-actions' }, el('span', { class: 'spacer' }),
      w.choices.map((c) => el('button', { type: 'button', class: `btn${ALLOW.has(c.kind) ? ' primary' : ''}`, onclick: () => answerFromTask(task, c.id), text: c.label })))
    : [
      replyBox(task, drafts, send),
      el('div', { class: 'home-actions' },
        el('span', { class: 'hint', text: origin ? `Vai para o terminal “${termLabel(origin.t)}”` : 'Terminal fechado: fica só no histórico' }),
        el('span', { class: 'spacer' }),
        el('button', { type: 'button', class: 'btn ghost', onclick: () => openInPanel(task), text: 'Abrir tarefa' }),
        el('button', { type: 'button', class: 'btn primary', onclick: send, text: 'Enviar' })),
    ];
  return el('article', { class: `home-card wait${selected.has(task.id) ? ' picked' : ''}` },
    el('header', { class: 'home-card-head' }, pick, where(project, task), el('span', { class: 'spacer' }), el('span', { class: 'hint', text: `esperando há ${timeAgo(w.at)}` })),
    el('div', { class: 'home-title', text: task.title }),
    el('p', { class: 'home-question', text: w.question }),
    w.suggestion && !choices ? el('div', { class: 'hint', text: `Sugestão de ${w.suggestion.by} já preenchida — edite se quiser.` }) : null,
    answer);
}

export function resumeCard({ task, project, origin, report }) {
  const go = () => resumeTask(task) || openInPanel(task);
  return el('article', { class: 'home-card resume', onclick: go, title: origin ? 'Continuar no terminal' : 'Abrir a tarefa' },
    el('header', { class: 'home-card-head' }, where(project, task), el('span', { class: 'spacer' }), el('span', { class: 'hint', text: timeAgo(task.updatedAt) })),
    el('div', { class: 'home-title', text: task.title }),
    report ? el('p', { class: 'home-report', text: reportPreview(report) }) : null,
    el('footer', { class: 'home-meta' },
      origin ? el('span', {}, icon('terminal'), termLabel(origin.t)) : null,
      task.branch ? el('span', {}, icon('branch'), task.branch) : null,
      el('span', { class: 'spacer' }),
      el('button', { type: 'button', class: 'btn small', onclick: stop(go), text: origin ? 'Continuar' : 'Abrir tarefa' })));
}
