// Lembretes: "quando" em português ("amanhã 9h", "em 30 min"), criados pelo agente (MCP remind_me) e pelo
// `bo remind`; aparecem em "Próximos lembretes" na Home; na hora tocam como aviso urgente (passa pelo modo
// foco) e ficam em "Aguardando você" até concluir ou adiar; sobrevivem a reabrir o app.
const { suite, seed } = require('./harness');

suite('reminders', {
  seed: (dir) => {
    const [app] = seed.makeFolders(dir, ['app'], { git: false });
    return seed.state([seed.project('p1', 'Loja', [app], [seed.group('g1', 'Agentes', [seed.term('ag', 'agente-1', app)])])]);
  },
}, async (t) => {
  const R = { R: './js/actions/reminders.js', NC: './js/notify/center.js', W: './js/reminders/when.js' };
  if (t.run === 2) {
    const kept = await t.js(`return R.upcomingReminders().map((r) => r.text)`, R);
    t.check(kept.includes('Revisar o PR do Pix'), 'ao reabrir o app, o lembrete continua agendado', JSON.stringify(kept));
    return;
  }
  const agent = await t.mcp('ag');

  // "Quando" em português, relativo a uma segunda-feira 19/10/2026 10:00.
  const parsed = await t.js(`const now = new Date(2026, 9, 19, 10, 0);
    return ['em 30 min', 'amanhã 9h', 'sexta 14h', '18h', '20/10 10:00'].map((s) => W.describeWhen(W.parseWhen(s, now), now))`, R);
  t.equal(parsed, ['hoje 10:30', 'amanhã 09:00', 'sex 14:00', 'hoje 18:00', 'amanhã 10:00'], 'entende "em 30 min", "amanhã 9h", "sexta 14h", "18h" e "20/10 10:00"');

  // Pelo agente, ligado a uma tarefa; e pelo CLI.
  const task = (await agent.tool('create_task', { title: 'Deploy do checkout' })).data;
  const byAgent = await agent.tool('remind_me', { text: 'Conferir o deploy', when: 'em 30 min', task: task.key });
  t.check(byAgent.ok && byAgent.data.by === 'agente' && byAgent.data.task === task.key && /^hoje \d\d:\d\d$/.test(byAgent.data.when), 'remind_me agenda para daqui a 30 min, ligado à tarefa', JSON.stringify(byAgent));
  const bad = await agent.tool('remind_me', { text: 'x', when: 'qualquer hora' });
  t.check(!bad.ok && /Exemplos/.test(bad.error), 'quando não entende, explica com exemplos', bad.error);
  const cli = await t.bo(['remind', 'Revisar', 'o', 'PR', 'do', 'Pix', '--quando', 'amanhã 9h'], { terminal: 'ag' });
  t.check(cli.code === 0 && /amanhã 09:00/.test(cli.stdout), '`bo remind … --quando "amanhã 9h"`', cli.stdout + cli.stderr);
  const list = await t.bo(['reminders'], { terminal: 'ag' });
  t.check(/Conferir o deploy/.test(list.stdout) && /Revisar o PR do Pix/.test(list.stdout), '`bo reminders` lista os dois', list.stdout);

  // Home: os próximos lembretes, com a hora.
  await t.js(`S.store.state.taskView = 'home'; S.commit()`);
  const home = () => t.js(`return document.querySelector('.home')?.innerText || ''`);
  const upcoming = await t.waitFor(async () => ((await home()).includes('Conferir o deploy') ? home() : null));
  t.check(upcoming && /próximos lembretes/i.test(upcoming) && upcoming.includes('amanhã 09:00'), 'a Home mostra os próximos lembretes com a hora', upcoming);

  // Na hora (aqui, 31 min no futuro): toca como urgente, mesmo no modo foco e com a janela sem foco.
  const rang = await t.js(`S.store.state.focusMode = true; document.hasFocus = () => false;
    const n = R.checkReminders(Date.now() + 31 * 60e3);
    return { n, last: NC.recentNotifications()[0]?.body }`, R);
  t.check(rang.n === 1 && /Lembrete: Conferir o deploy/.test(rang.last || ''), 'na hora, vira aviso "Lembrete: …"', JSON.stringify(rang));
  const card = await t.waitFor(async () => {
    const text = await t.js(`return document.querySelector('.home-card.reminder')?.innerText || ''`);
    return text.includes('Conferir o deploy') ? text : null;
  });
  t.check(card && card.includes('Lembrete do agente') && card.includes('Deploy do checkout'), 'fica em "Aguardando você", com quem pediu e a tarefa ligada', card);
  t.includes(await home(), '1 coisa esperando você', 'conta como algo esperando você');
  if (process.env.BO_TEST_SHOTS) {
    await t.wait(500);
    require('fs').writeFileSync(require('path').join(process.env.BO_TEST_SHOTS, 'home-reminders.png'), (await t.wc.capturePage()).toPNG());
  }

  // Adiar: sai da Home e volta para a fila; Concluir: some.
  const id = byAgent.data.id;
  await t.js(`R.snoozeReminder(${JSON.stringify(id)}, 'em 10 min')`, R);
  t.check(await t.waitFor(async () => !(await t.js(`return !!document.querySelector('.home-card.reminder')`))), 'adiar tira da Home');
  t.equal(await t.js(`return R.upcomingReminders().some((r) => r.id === ${JSON.stringify(id)})`, R), true, 'e o lembrete volta para os próximos');
  await t.js(`R.checkReminders(Date.now() + 11 * 60e3)`, R);
  await t.waitFor(() => t.js(`return !!document.querySelector('.home-card.reminder')`));
  await t.js(`[...document.querySelectorAll('.home-card.reminder .btn')].find((b) => b.textContent === 'Concluir').click()`);
  t.check(await t.waitFor(async () => !(await t.js(`return R.reminderById(${JSON.stringify(id)})`, R))), 'concluir remove o lembrete');
  await t.js(`S.persistNow()`); // grava já: a 2ª execução reabre o app e confere
});
