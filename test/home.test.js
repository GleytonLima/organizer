// Home: o app abre nela quando algo espera você; responder em lote (com as sugestões) e uma a uma,
// e as respostas chegam nos terminais dos agentes; "continue de onde parou" leva ao terminal certo;
// o resumo do que aconteceu enquanto você esteve fora; modo foco segura só o que não é urgente.
const { suite, seed } = require('./harness');

const HOUR = 3600e3;
const now = Date.now();
const task = (id, title, columnId, extra = {}) => ({
  id, key: `HM-${id.slice(1)}`, projectId: 'p1', columnId, title, description: '', terminalId: null, progress: null,
  needsInput: null, parentId: null, tags: [], createdAt: now - 5 * HOUR, updatedAt: now - 2 * HOUR,
  history: [{ at: now - 5 * HOUR, by: 'agente', type: 'created', text: 'Criada em “A fazer”' }], ...extra,
});

suite('home', {
  seed: (dir) => {
    const [app] = seed.makeFolders(dir, ['app'], { git: false });
    const p = seed.project('p1', 'Loja', [app], [seed.group('g1', 'Agentes', [seed.term('ag', 'agente-1', app), seed.term('ag2', 'agente-2', app), seed.term('t3', 'shell', app)])]);
    p.taskColumns = [{ id: 'k1', name: 'A fazer' }, { id: 'k2', name: 'Fazendo' }, { id: 'k3', name: 'Feito' }].map((c) => ({ ...c, description: '' }));
    const tasks = [
      task('t1', 'Webhook de pagamento', 'k2', { terminalId: 'ag', needsInput: { question: 'SQS ou RabbitMQ?', at: now - 30 * 60e3, suggestion: { text: 'SQS, a infra já é AWS', by: 'supervisor', at: now } } }),
      task('t2', 'Tela de pedidos', 'k2', { terminalId: 'ag2', needsInput: { question: 'Tabela ou cartões?', at: now - 10 * 60e3, suggestion: null } }),
      task('t3', 'Checkout com Pix', 'k2', { terminalId: 't3', updatedAt: now - 20 * 60e3,
        history: [{ at: now - 5 * HOUR, by: 'agente', type: 'created', text: 'Criada' }, { at: now - 20 * 60e3, by: 'agente', type: 'report', text: 'QR code validado no sandbox' }] }),
      task('t4', 'Frete por CEP', 'k3', { history: [{ at: now - 5 * HOUR, by: 'agente', type: 'created', text: 'Criada' }, { at: now - 40 * 60e3, by: 'agente', type: 'moved', text: 'Movida para “Feito”', to: 'k3' }] }),
      task('t5', 'Cupom de desconto', 'k1', { history: [{ at: now - 50 * 60e3, by: 'Bruno', type: 'created', text: 'Criada' }] }),
    ];
    return seed.state([p], { tasks, homeSeenAt: now - HOUR, activeId: 't3' });
  },
}, async (t) => {
  const text = () => t.js(`return document.querySelector('.home')?.innerText || ''`);
  const H = { HV: './js/actions/home.js', NC: './js/notify/center.js' };
  t.equal(await t.js(`return S.store.state.taskView`), 'home', 'com algo esperando você, o app abre na Home');
  const home = await t.waitFor(text);
  if (process.env.BO_TEST_SHOTS) {
    await t.wait(600);
    require('fs').writeFileSync(require('path').join(process.env.BO_TEST_SHOTS, 'home.png'), (await t.wc.capturePage()).toPNG());
  }
  t.includes(home, '2 coisas esperando você', 'a saudação diz quantas coisas esperam você');
  t.check(home.indexOf('SQS ou RabbitMQ?') < home.indexOf('Tabela ou cartões?'), 'quem espera há mais tempo vem primeiro');
  t.equal(await t.js(`return document.querySelector('[data-draft="home-t1"]').value`), 'SQS, a infra já é AWS', 'a sugestão vem preenchida');
  t.includes(home.toLowerCase(), 'continue de onde parou', 'mostra onde você parou');
  t.includes(home, 'QR code validado no sandbox', 'com o último relato do agente');
  t.includes(home, '1 tarefa concluída', 'enquanto você esteve fora: o que os agentes concluíram');
  t.includes(home, 'Bruno', 'e quem do time mexeu');

  // Em lote: marca a que tem sugestão e responde com ela.
  t.check(await t.shellReady('ag'), 'terminal do agente pronto');
  await t.js(`document.querySelector('.home-pick').click()`);
  t.includes(await text(), 'Responder com a sugestão', 'marcar mostra a ação em lote');
  await t.js(`[...document.querySelectorAll('.home-batch .btn')].find((b) => b.innerText.includes('Responder')).click()`);
  t.check(await t.waitFor(async () => (await t.lines('ag', 20)).includes('SQS, a infra já é AWS')), 'a resposta em lote chega no terminal do agente');
  t.equal(await t.js(`return S.store.state.tasks.find((x) => x.id === 't1').needsInput`), null, 'a espera respondida sai da lista');

  // Uma a uma: escreve e envia.
  await t.js(`const a = document.querySelector('[data-draft="home-t2"]'); a.value = 'Cartões, como no app mobile'; a.dispatchEvent(new Event('input'));
    [...document.querySelectorAll('.home-card.wait .btn.primary')].find((b) => b.innerText.includes('Enviar')).click()`);
  t.check(await t.waitFor(async () => (await t.lines('ag2', 20)).includes('Cartões, como no app mobile')), 'a resposta escrita chega no terminal certo');
  t.includes(await t.waitFor(async () => ((await text()).includes('Nada esperando você.') ? text() : null)), 'Nada esperando você', 'sem pendências, a Home diz isso com calma');
  t.equal(await t.js(`return document.querySelector('.home-calm .done-check')?.getAttribute('class')`), 'done-check draw', 'com um check (círculo + v) que se desenha');
  if (process.env.BO_TEST_SHOTS) {
    await t.wait(1300);
    require('fs').writeFileSync(require('path').join(process.env.BO_TEST_SHOTS, 'home-calm.png'), (await t.wc.capturePage()).toPNG());
  }
  await t.wait(1300);
  await t.js(`S.notify(); await new Promise((r) => setTimeout(r, 50))`);
  t.equal(await t.js(`return document.querySelector('.home-calm .done-check')?.getAttribute('class')`), 'done-check', 'desenhado uma vez, fica parado nas atualizações seguintes');

  // Modo foco: o que não é urgente não vira aviso do Windows; o urgente vira.
  await t.js(`document.querySelector('.home-focus input').click()`);
  t.equal(await t.js(`return S.store.state.focusMode`), true, 'liga o modo foco');
  const toasts = await t.js(`document.hasFocus = () => false;
    return [NC.pushNotification({ body: 'comando longo terminou' }).toast, NC.pushNotification({ body: 'agente esperando', urgent: true }).toast]`, H);
  t.equal(toasts, [false, true], 'no modo foco só o urgente vira toast');

  // Continue de onde parou: um clique e você está no terminal certo, fora da Home.
  // (as esperas respondidas viraram frentes em andamento, mais recentes: procura a do Pix)
  await t.js(`[...document.querySelectorAll('.home-card.resume')].find((c) => c.innerText.includes('Checkout com Pix')).click()`);
  t.equal(await t.js(`return [S.store.state.taskView, S.store.state.activeId]`), ['off', 't3'], 'continuar leva ao terminal da tarefa');
  t.check(await t.js(`return S.store.state.homeSeenAt > ${now}`), 'sair da Home marca o resumo como visto');
  await t.js(`HV.openHome()`, H);
  t.check(!(await t.waitFor(text)).toLowerCase().includes('enquanto você esteve fora'), 'depois de visto, o resumo some');
});
