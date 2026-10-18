// Seção "Sugestões de memória" da gaveta: o que o agente propôs guardar ao concluir (consolidação do
// curto para o longo prazo). Você edita se quiser e aceita (vira memória vinculada) ou descarta.
// Concluída e com agente aberto, sem sugestões: um botão pede as sugestões ao agente.
import { el } from '../../core/dom.js';
import { timeAgo } from '../../core/format.js';
import { cleanError } from '../../core/errors.js';
import { isDoneColumn } from '../../tasks/columns.js';
import { taskProject } from '../../tasks/queries.js';
import { SUGGESTION_KINDS, acceptSuggestion, discardSuggestion } from '../../actions/task-suggestions.js';
import { askForSuggestions, canAskAgent } from '../../actions/task-consolidate.js';
import { openModal } from '../modal.js';

const fail = (title) => (err) => openModal({ title, message: cleanError(err) });

function item(task, s, draft) {
  const box = el('textarea', {
    class: 'input textarea',
    rows: s.kind === 'decision' ? 2 : 3,
    'data-draft': `suggestion-${s.id}`,
    oninput: (e) => (draft[s.id] = e.target.value),
  });
  box.value = draft[s.id] ?? s.text;
  const accept = () =>
    acceptSuggestion(task, s.id, { text: box.value })
      .then(() => delete draft[s.id])
      .catch(fail('Não foi possível aceitar a sugestão'));
  return el(
    'div',
    { class: 'td-feedback-item', 'data-suggestion': s.id },
    el('div', { class: 'td-feedback-meta' }, el('span', { class: 'task-chip', text: SUGGESTION_KINDS[s.kind] }), el('span', { text: `${s.by} · ${timeAgo(s.at)}` })),
    box,
    el(
      'div',
      { class: 'td-feedback-actions' },
      el('button', { type: 'button', class: 'btn small ghost', onclick: () => discardSuggestion(task, s.id), text: 'Descartar' }),
      el('button', { type: 'button', class: 'btn small', onclick: accept, text: 'Aceitar' }),
    ),
  );
}

/** null quando não há nada a mostrar (sem sugestões e sem como pedir). */
export function suggestionsBox(task, draft) {
  const pending = task.memorySuggestions || [];
  const done = isDoneColumn(taskProject(task), task.columnId);
  if (!pending.length && !(done && canAskAgent(task))) return null;
  const notes = (draft.suggestions ||= {});
  const ask = () => {
    try {
      askForSuggestions(task);
    } catch (err) {
      fail('Não foi possível pedir ao agente')(err);
    }
  };
  return el(
    'div',
    { class: 'td-feedback td-suggestions' },
    pending.map((s) => item(task, s, notes)),
    pending.length
      ? el('div', { class: 'hint', text: 'Aceita, vira memória do projeto vinculada a esta tarefa.' })
      : el('div', { class: 'td-feedback-actions' }, el('span', { class: 'hint', text: 'O que vale guardar desta tarefa?' }), el('button', { type: 'button', class: 'btn small', onclick: ask, text: 'Pedir ao agente' })),
  );
}
