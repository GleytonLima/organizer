// Métodos da API para os lembretes (usados pelo MCP — o agente — e pelo `bo remind`).
import { callerOf } from './resolve.js';
import { resolveTaskRef, taskById } from '../tasks/queries.js';
import { addReminder, completeReminder, dueReminders, reminderById, snoozeReminder, upcomingReminders } from '../actions/reminders.js';
import { describeWhen } from '../reminders/when.js';

const info = (r) => ({
  id: r.id,
  text: r.text,
  at: new Date(r.at).toISOString(),
  when: describeWhen(r.at),
  rang: !!r.firedAt, // já tocou e está esperando você na Home
  by: r.by,
  task: r.taskId ? taskById(r.taskId)?.key ?? null : null,
});

const found = (id) => reminderById(id) || (() => { throw new Error(`Lembrete não encontrado: ${id}`); })();

export const reminderHandlers = {
  /** { text, when: "amanhã 9h" | ISO, task?, via?: 'agent' } — o lembrete vale para o terminal que pediu. */
  reminder_add(p) {
    const caller = callerOf(p);
    const task = p.task ? resolveTaskRef(p.task, { terminalId: caller?.t.id }) : null;
    const r = addReminder({
      text: p.text,
      when: p.when,
      taskId: task?.id ?? null,
      terminalId: caller?.t.id ?? null,
      projectId: task?.projectId ?? caller?.project.id ?? null,
      by: p.via === 'agent' ? 'agente' : 'você',
    });
    return info(r);
  },

  /** Os que tocaram (esperando você) e os próximos. */
  reminder_list() {
    return { rang: dueReminders().map(info), upcoming: upcomingReminders().map(info) };
  },

  reminder_done(p) {
    const r = found(p.id);
    completeReminder(r.id);
    return { done: r.id, text: r.text };
  },

  reminder_snooze(p) {
    return info(snoozeReminder(found(p.id).id, p.when));
  },
};
