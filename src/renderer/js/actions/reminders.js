// Lembretes: você (ou o agente) pede "me lembre de X amanhã 9h"; na hora, um aviso urgente (passa pelo
// modo foco, porque foi pedido) e o lembrete entra em "Aguardando você" na Home até ser concluído ou adiado.
// Ficam no state.json: { id, text, at, createdAt, by, taskId, terminalId, projectId, firedAt }.
import { store, commit } from '../core/store.js';
import { uid } from '../core/model.js';
import { pushNotification } from '../notify/center.js';
import { parseWhen, describeWhen } from '../reminders/when.js';

const TICK_MS = 15000;
const MAX_TEXT = 300;

const list = () => store.state.reminders;
export const reminderById = (id) => list().find((r) => r.id === id) || null;

/** Já tocaram e esperam você (o mais antigo primeiro). */
export const dueReminders = () => list().filter((r) => r.firedAt).sort((a, b) => a.at - b.at);
/** Ainda vão tocar (o mais próximo primeiro). */
export const upcomingReminders = () => list().filter((r) => !r.firedAt).sort((a, b) => a.at - b.at);

/** `when`: texto ("amanhã 9h") ou instante em ms. Devolve o lembrete criado. */
export function addReminder({ text, when, taskId = null, terminalId = null, projectId = null, by = 'você' }) {
  const clean = String(text || '').trim().slice(0, MAX_TEXT);
  if (!clean) throw new Error('Diga do que lembrar.');
  const at = typeof when === 'number' ? when : parseWhen(when);
  const reminder = { id: uid(), text: clean, at, createdAt: Date.now(), by, taskId, terminalId, projectId, firedAt: null };
  list().push(reminder);
  commit();
  if (at <= Date.now()) checkReminders(); // "agora" ou já passou: toca já
  return reminder;
}

/** Adia para `when` ("em 10 min", "amanhã 9h"…): volta para a fila e sai da Home. */
export function snoozeReminder(id, when) {
  const r = reminderById(id);
  if (!r) throw new Error('Lembrete não encontrado.');
  r.at = typeof when === 'number' ? when : parseWhen(when);
  r.firedAt = null;
  commit();
  return r;
}

/** Concluído (ou cancelado antes de tocar): sai da lista. */
export function completeReminder(id) {
  const before = list().length;
  store.state.reminders = list().filter((r) => r.id !== id);
  if (store.state.reminders.length === before) throw new Error('Lembrete não encontrado.');
  commit();
}

/** Toca os que venceram até `now`: aviso urgente e "Aguardando você" na Home. */
export function checkReminders(now = Date.now()) {
  const due = list().filter((r) => !r.firedAt && r.at <= now);
  for (const r of due) {
    r.firedAt = now;
    const late = now - r.at > 5 * 60e3 ? ` (era para ${describeWhen(r.at)})` : '';
    pushNotification({ taskId: r.taskId, label: 'Lembrete', body: r.text + late, urgent: true });
  }
  if (due.length) commit();
  return due.length;
}

let timer = null;
/** Confere a cada 15 s e ao voltar para a janela; os atrasados (app fechado) tocam ao abrir. */
export function startReminders() {
  clearInterval(timer);
  timer = setInterval(() => checkReminders(), TICK_MS);
  window.addEventListener('focus', () => checkReminders());
  checkReminders();
}
