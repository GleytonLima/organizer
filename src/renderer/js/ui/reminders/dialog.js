// Diálogo "Novo lembrete": o quê e quando, em português do dia a dia ("amanhã 9h", "em 30 min").
// Ligado a uma tarefa (aberto pelo menu dela), clicar no lembrete leva à tarefa.
import { openModal, field } from '../modal.js';
import { cleanError } from '../../core/errors.js';
import { store } from '../../core/store.js';
import { addReminder } from '../../actions/reminders.js';
import { describeWhen, parseWhen } from '../../reminders/when.js';

const WHEN_HINT = 'Ex.: em 30 min · em 2h · amanhã 9h · sexta 14h · 20/10 10:00 · 18h';

/** Abre o diálogo; `task` liga o lembrete a uma tarefa. Devolve o lembrete criado (ou null). */
export async function newReminderDialog({ task = null } = {}) {
  let values = { text: task ? `Ver “${task.title}”` : '', when: '' };
  let error = null;
  for (;;) {
    const v = await openModal({
      title: 'Novo lembrete',
      message: error,
      fields: [
        field.text('text', 'Lembrar de', values.text, { placeholder: 'revisar o PR do Pix', max: 300 }),
        field.text('when', 'Quando', values.when, { placeholder: 'amanhã 9h', hint: WHEN_HINT }),
      ],
      submit: 'Lembrar',
    });
    if (!v) return null;
    values = v;
    try {
      const at = parseWhen(v.when);
      if (at <= Date.now() - 60e3) throw new Error(`${describeWhen(at)} já passou. Escolha um horário futuro.`);
      return addReminder({ text: v.text, when: at, taskId: task?.id ?? null, projectId: task?.projectId ?? store.state.focusProjectId });
    } catch (err) {
      error = cleanError(err); // reabre com o que você digitou e o motivo
    }
  }
}
