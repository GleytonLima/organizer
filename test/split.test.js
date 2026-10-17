// Visão lado a lado (grupo em grade) e confirmações de ações destrutivas.
const { suite, seed } = require('./harness');

const UI = { SP: './js/actions/split.js', C: './js/actions/commands.js', G: './js/actions/groups.js' };

suite('lado a lado e confirmações', {
  seed: (dir) => {
    const [app] = seed.makeFolders(dir, ['minha-app'], { git: false });
    return seed.state(
      [
        seed.project('p1', 'minha-app', [app], [
          seed.group('g1', 'Agente', [seed.term('dev1', 'devtools', app)]),
          seed.group('g2', 'Serviços', [seed.term('be', 'backend', app, 'sleep 300'), seed.term('fe', 'frontend', app)]),
        ]),
      ],
      { commands: [{ id: 'c1', label: 'status', cmd: 'git status' }, { id: 'c2', label: 'log', cmd: 'git log --oneline -5' }] },
    );
  },
}, async (t) => {
  const js = (code) => t.js(code, UI);
  const visible = () => js(`return [...document.querySelectorAll('.term-host.visible')].map((h) => { const r = h.getBoundingClientRect(); return { x: Math.round(r.x), w: Math.round(r.width) }; })`);
  const split = () => js(`return S.store.state.split`);

  // Grupo "Serviços" lado a lado.
  await js(`SP.splitGroup(S.store.state.projects[0].groups[1])`);
  t.equal(await split(), { kind: 'group', id: 'g2' }, 'splitGroup liga a divisão do grupo');
  const two = await t.waitFor(async () => ((await visible()).length === 2 ? visible() : null));
  t.check(two && two[0].x !== two[1].x && two.every((p) => p.w > 100), 'dois painéis visíveis lado a lado', JSON.stringify(two));

  await js(`T.addTerminal(S.store.state.projects[0].groups[1], { name: 'worker', cwd: S.store.state.projects[0].cwd }, { focus: false })`);
  const three = await t.waitFor(async () => ((await visible()).length === 3 ? visible() : null));
  t.check(three, 'terminal novo no grupo entra na divisão', JSON.stringify(await visible()));

  await js(`T.activate('fe')`);
  t.equal(await split(), { kind: 'group', id: 'g2' }, 'ativar um terminal da divisão a mantém');
  await js(`T.activate('dev1')`);
  t.equal(await split(), null, 'ativar um terminal de fora desfaz a divisão');
  t.equal((await t.waitFor(async () => ((await visible()).length === 1 ? visible() : null)))?.length, 1, 'volta a um painel só');

  await js(`SP.splitGroup(S.store.state.projects[0].groups[1])`);
  await js(`document.querySelector('.split-indicator .icon-btn').click()`);
  t.equal(await split(), null, 'botão da barra superior sai da divisão');

  // Remover comando salvo: cancelar mantém, confirmar remove.
  const labels = () => js(`return S.store.state.commands.map((c) => c.label)`);
  js(`C.removeCommand(S.store.state.commands[0])`); // sem await: fica esperando o diálogo
  t.check(await t.waitFor(t.modal.open), 'remover comando pede confirmação');
  t.includes(await t.modal.text(), 'git status', 'confirmação mostra o comando');
  await t.modal.cancel();
  t.equal(await labels(), ['status', 'log'], 'cancelar mantém o comando');
  js(`C.removeCommand(S.store.state.commands[0])`);
  await t.waitFor(t.modal.open);
  await t.modal.submit();
  t.equal(await t.waitFor(async () => ((await labels()).length === 1 ? labels() : null)), ['log'], 'confirmar remove o comando');

  // Fechar terminal com processo rodando: pede confirmação citando o comando; a API exige force.
  // (sem shellReady: o startup ocupa o bash, e o eco de prontidão ficaria na fila)
  const running = await t.waitFor(() => js(`return SE.runningCommand('be')`), { timeout: 30000 });
  t.includes(running, 'sleep 300', 'startup do backend está em execução');
  js(`T.closeTerminal('be')`);
  t.check(await t.waitFor(t.modal.open), 'fechar terminal em execução pede confirmação');
  t.includes(await t.modal.text(), 'sleep 300', 'confirmação cita o processo em execução');
  await t.modal.cancel();
  t.check(await js(`return !!S.findTerm('be')`), 'cancelar mantém o terminal');
  const agent = await t.mcp('dev1');
  const refused = await agent.tool('close_terminal', { terminal: 'backend' });
  t.check(!refused.ok && /force/.test(refused.error), 'close_terminal sem force é recusado', JSON.stringify(refused));

  // Excluir grupo: resume terminais e processos; cancelar mantém.
  js(`G.deleteGroup(S.store.state.projects[0].groups[1])`);
  await t.waitFor(t.modal.open);
  t.match(await t.modal.text(), /3 terminais.*em execução/s, 'excluir grupo resume terminais e processos');
  await t.modal.cancel();
  t.equal(await js(`return S.store.state.projects[0].groups.length`), 2, 'cancelar mantém o grupo');
  const forced = await agent.tool('close_terminal', { terminal: 'backend', force: true });
  t.check(forced.ok && !(await js(`return !!S.findTerm('be')`)), 'close_terminal com force encerra', JSON.stringify(forced));
});
