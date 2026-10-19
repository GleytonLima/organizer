// `bo remind` e `bo reminders`: lembretes pela linha de comando (mesmos métodos do MCP).
const { request } = require('./client');

const line = (r) => `[${r.id}]  ${r.when}${r.rang ? ' (tocou)' : ''}  ${r.text}${r.task ? `  ↳ ${r.task}` : ''}`;
const print = (opts, data, fmt) => console.log(opts.json ? JSON.stringify(data, null, 2) : fmt(data));

/** bo remind <texto...> --em 30min | --quando "amanhã 9h" [--task BO-3] */
async function remind({ pos, opts }) {
  const when = opts.em ? `em ${opts.em}` : opts.quando || opts.when;
  if (!pos.length || !when) throw new Error('uso: bo remind <texto...> --em 30min | --quando "amanhã 9h" [--task BO-3]');
  const r = await request('reminder_add', { text: pos.join(' '), when: String(when), task: opts.task });
  print(opts, r, (x) => `Lembrete para ${x.when}: ${x.text}`);
}

/** bo reminders [done <id> | snooze <id> <quando...>] */
async function reminders({ pos, opts }) {
  const [action, id, ...when] = pos;
  if (action === 'done') return print(opts, await request('reminder_done', { id }), (x) => `Concluído: ${x.text}`);
  if (action === 'snooze') return print(opts, await request('reminder_snooze', { id, when: when.join(' ') }), (x) => `Adiado para ${x.when}: ${x.text}`);
  const r = await request('reminder_list');
  print(opts, r, (x) => [...x.rang, ...x.upcoming].map(line).join('\n') || '(sem lembretes)');
}

module.exports = { remind, reminders };
