// Integração com o shell: sinais OSC 6973 (start/end/cwd) emitidos pelo bash-init.sh e o estado
// que o app deriva deles (comando em execução, código de saída, pasta atual).
const os = require('os');
const { suite, seed } = require('./harness');

const norm = (p) => String(p || '').replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();

suite('shell: sinais OSC 6973', {
  seed: (dir) => {
    const [work] = seed.makeFolders(dir, ['work'], { git: false });
    return seed.state([seed.project('p1', 'shell', [work], [seed.group('g1', 'Terminais', [seed.term('sh', 'sh', work)])])]);
  },
}, async (t) => {
  t.check(await t.shellReady('sh'), 'Git Bash fica pronto');

  // Captura as sequências cruas sem atrapalhar o handler do app (devolver false repassa adiante).
  await t.js(`window.__osc = []; SE.getSession('sh').term.parser.registerOscHandler(6973, (d) => (window.__osc.push(d), false));`);
  const osc = () => t.js(`return window.__osc`);
  const session = () => t.js(`const s = SE.getSession('sh'); return { running: s.running?.cmd ?? null, lastExit: s.lastExit }`);

  await t.type('sh', 'echo ola');
  let seen = await t.waitFor(async () => ((await osc()).some((d) => d.startsWith('cwd;')) ? osc() : null));
  t.includes((seen || []).join(' | '), 'start;echo ola', 'start traz o comando digitado');
  t.check((seen || []).includes('end;0'), 'end traz o código de saída 0', JSON.stringify(seen));
  const order = (seen || []).map((d) => d.split(';')[0]);
  t.equal(order.slice(0, 3), ['start', 'end', 'cwd'], 'ordem: start → end → cwd');

  await t.type('sh', 'false');
  await t.waitFor(async () => (await osc()).includes('end;1'));
  t.equal((await session()).lastExit, 1, 'código de saída diferente de zero fica no estado do terminal');

  // Enter vazio não gera start/end, só um novo cwd.
  await t.js(`window.__osc.length = 0`);
  await t.type('sh', '');
  seen = await t.waitFor(async () => ((await osc()).length ? osc() : null));
  t.check(seen && seen.every((d) => d.startsWith('cwd;')), 'Enter vazio emite só cwd', JSON.stringify(seen));

  // Comando longo: o app sabe que está rodando e a API mostra o status.
  const agent = await t.mcp();
  await t.type('sh', 'sleep 3');
  const running = await t.waitFor(async () => (await session()).running);
  t.equal(running, 'sleep 3', 'comando em execução é conhecido pelo app');
  const st = await agent.tool('terminal_status', { terminal: 'sh' });
  t.equal(st.data?.running, 'sleep 3', 'terminal_status (MCP) mostra o comando rodando');
  await t.waitFor(async () => (await session()).running === null, { timeout: 10000 });
  t.equal(await session(), { running: null, lastExit: 0 }, 'fim do comando limpa o estado');

  // cwd vem de `pwd -W`: /tmp do Git Bash é o %TEMP% do Windows.
  await t.type('sh', 'cd /tmp');
  const tmp = norm(os.tmpdir());
  const cwd = await t.waitFor(async () => {
    const c = await t.js(`return S.findTerm('sh').t.cwd`);
    return norm(c) === tmp ? c : null;
  });
  t.check(cwd, 'cd /tmp atualiza a pasta do terminal para %TEMP% (formato Windows)', `esperado ${tmp}`);
});
