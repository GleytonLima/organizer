// Seção "Seu feedback" da gaveta da tarefa: texto livre e um rótulo opcional de 1 clique; os
// feedbacks anteriores ficam listados (com data), e cada um leva a foto do contexto do momento
// (ver metrics/feedback.js). Rascunho no `draft` da gaveta: sobrevive aos re-renders.
import { el } from '../../core/dom.js';
import { timeAgo } from '../../core/format.js';
import { cleanError } from '../../core/errors.js';
import { FEEDBACK_LABELS, labelName, taskFeedback, addTaskFeedback, removeTaskFeedback } from '../../metrics/feedback.js';
import { iconButton } from '../components.js';
import { openModal } from '../modal.js';

function item(task, f) {
  return el(
    'div',
    { class: 'td-feedback-item', 'data-feedback': f.id },
    el(
      'div',
      { class: 'td-feedback-meta' },
      el('span', { text: timeAgo(f.ts) }),
      f.label ? el('span', { class: 'task-chip', text: labelName(f.label) }) : null,
      el('span', { class: 'spacer' }),
      iconButton('close', 'Apagar este feedback', () => removeTaskFeedback(task, f.id), 'reveal'),
    ),
    f.text ? el('div', { class: 'td-feedback-text', text: f.text }) : null,
  );
}

export function feedbackBox(task, draft) {
  const fb = (draft.feedback ||= { text: '', label: null });
  const box = el('textarea', {
    class: 'input textarea',
    rows: 3,
    'data-draft': 'feedback',
    placeholder: 'Como foi? O que funcionou, o que travou, o que você faria diferente…',
    oninput: (e) => (fb.text = e.target.value),
  });
  box.value = fb.text;
  const labels = el(
    'div',
    { class: 'mem-filters' },
    FEEDBACK_LABELS.map((l) =>
      el('button', { type: 'button', class: `chip${fb.label === l.id ? ' on' : ''}`, 'data-label': l.id, onclick: (e) => {
        fb.label = fb.label === l.id ? null : l.id;
        [...e.currentTarget.parentNode.children].forEach((c) => c.classList.toggle('on', c.dataset.label === fb.label));
      }, text: l.label }),
    ),
  );
  async function save() {
    try {
      await addTaskFeedback(task, { text: fb.text, label: fb.label });
      draft.feedback = { text: '', label: null };
    } catch (err) {
      await openModal({ title: 'Não foi possível salvar o feedback', message: cleanError(err) });
    }
  }
  const items = taskFeedback(task);
  return el(
    'div',
    { class: 'td-feedback' },
    items.map((f) => item(task, f)),
    box,
    el('div', { class: 'td-feedback-actions' }, labels, el('button', { type: 'button', class: 'btn small', onclick: save, text: 'Salvar feedback' })),
    el('div', { class: 'hint', text: 'Fica nesta máquina, com a foto da tarefa agora (tempo, esperas, uso do agente). Exporte pelo Insights para análise.' }),
  );
}
