// Caixa "Em espera" do detalhe: pergunta do agente, sugestão do supervisor e sua resposta,
// que é enviada direto ao terminal que perguntou.
import { el } from '../../core/dom.js';
import { findTerm } from '../../core/store.js';
import { termLabel, timeAgo } from '../../core/format.js';
import { replyToTask, dismissWaiting } from '../../actions/task-waiting.js';
import { answerFromTask } from '../../actions/agent-tasks.js';
import { icon } from '../icons.js';

const ALLOW = new Set(['allow_once', 'allow_always']);

/** Pedido de permissão de um agente (ACP): as opções dele viram botões. */
function choicesBox(task) {
  const w = task.needsInput;
  const answer = (id) => answerFromTask(task, id).catch((err) => console.warn('ACP:', err.message));
  return el(
    'section',
    { class: 'td-waiting' },
    el('div', { class: 'td-waiting-head' }, icon('pause'), el('span', { text: `Em espera há ${timeAgo(w.at)}` })),
    el('p', { class: 'td-question', text: w.question }),
    el(
      'div',
      { class: 'td-waiting-actions' },
      el('button', { type: 'button', class: 'btn ghost', onclick: () => answer(null), text: 'Cancelar pedido' }),
      el('span', { class: 'spacer' }),
      w.choices.map((c) => el('button', { type: 'button', class: `btn${ALLOW.has(c.kind) ? ' primary' : ''}`, onclick: () => answer(c.id), text: c.label })),
    ),
  );
}

/** `draft`: { reply } persistente entre renders (ver detail.js). */
export function waitingBox(task, draft) {
  const w = task.needsInput;
  if (w.choices?.length) return choicesBox(task);
  const origin = findTerm(task.terminalId);
  if (draft.reply === undefined) draft.reply = w.suggestion?.text || '';

  const send = async () => {
    if (!draft.reply.trim()) return;
    await replyToTask(task, draft.reply);
    draft.reply = undefined;
  };
  const textarea = el('textarea', {
    class: 'input textarea',
    rows: 4,
    'data-draft': 'reply',
    placeholder: 'Sua resposta para o agente…',
    oninput: (e) => (draft.reply = e.target.value),
    onkeydown: (e) => {
      if (e.key !== 'Enter' || !e.ctrlKey) return;
      e.preventDefault();
      send();
    },
  });
  textarea.value = draft.reply;

  return el(
    'section',
    { class: 'td-waiting' },
    el('div', { class: 'td-waiting-head' }, icon('pause'), el('span', { text: `Em espera há ${timeAgo(w.at)}` })),
    el('p', { class: 'td-question', text: w.question }),
    w.suggestion
      ? el('div', { class: 'td-suggestion-note', text: `Sugestão de ${w.suggestion.by} (${timeAgo(w.suggestion.at)}) já preenchida abaixo — edite se quiser.` })
      : null,
    textarea,
    el('div', { class: 'hint', text: origin ? `Vai para o terminal “${termLabel(origin.t)}” · Ctrl+Enter envia` : 'Terminal de origem fechado: a resposta fica só no histórico' }),
    el(
      'div',
      { class: 'td-waiting-actions' },
      el('span', { class: 'spacer' }),
      el('button', { type: 'button', class: 'btn ghost', onclick: () => dismissWaiting(task), text: 'Encerrar espera' }),
      el('button', { type: 'button', class: 'btn primary', onclick: send }, icon('send'), origin ? 'Enviar ao terminal' : 'Registrar resposta'),
    ),
  );
}
