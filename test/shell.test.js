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
  // Cada sequência traz o nonce do terminal na frente ("<nonce>;start;…"): aqui ele é conferido e tirado.
  await t.js(`window.__osc = []; const s = SE.getSession('sh');
    s.term.parser.registerOscHandler(6973, (d) => (window.__osc.push(d.startsWith(s.oscNonce + ';') ? d.slice(s.oscNonce.length + 1) : 'SEM-NONCE:' + d), false));`);
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

  // Sequência forjada pela saída de um programa (sem o nonce): o app ignora — a pasta não muda.
  await t.type('sh', `printf '\\033]6973;cwd;C:/forjado\\007\\033]6973;x;cwd;C:/forjado\\007'; echo forjou`);
  await t.waitFor(async () => (await osc()).some((d) => d.startsWith('SEM-NONCE:')));
  await t.wait(300);
  t.equal(norm(await t.js(`return S.findTerm('sh').t.cwd`)), tmp, 'sequência OSC sem o nonce do terminal (forjada) não muda a pasta');
  await t.type('sh', 'echo "nonce:[${BO_OSC_NONCE}]"');
  const out = await t.waitFor(async () => { const r = await t.js(`return (await import('./js/terminals/buffer.js')).readLines('sh', 5)`); return /nonce:\[.*\]\s*$/m.test(r) && r; });
  t.check(/nonce:\[\]/.test(out || ''), 'o nonce não fica no ambiente dos comandos', out);

  // zoom: Ctrl + (sem Shift) aumenta, Ctrl − diminui até um limite, Ctrl 0 volta a 100%
  const press = async (keyCode, times = 1) => {
    for (let i = 0; i < times; i++) {
      t.wc.sendInputEvent({ type: 'keyDown', keyCode, modifiers: ['control'] });
      t.wc.sendInputEvent({ type: 'keyUp', keyCode, modifiers: ['control'] });
      await t.wait(60);
    }
  };
  const zoom = () => Math.round(t.wc.getZoomFactor() * 100);
  await press('=');
  t.equal(zoom(), 110, 'Ctrl + (tecla =, sem Shift) aumenta o zoom');
  await press('-', 12);
  t.equal(zoom(), 67, 'Ctrl − para no mínimo legível (67%)');
  await press('0');
  t.equal(zoom(), 100, 'Ctrl 0 volta a 100%');

  // avisos por OSC 9: no máximo um a cada 5 s por terminal (a saída de qualquer programa os emite)
  await t.js(`(await import('./js/notify/center.js')).clearNotifications()`);
  await t.type('sh', `printf '\\033]9;aviso-um\\007\\033]9;aviso-dois\\007'`);
  await t.wait(800);
  const notices = await t.js(`return (await import('./js/notify/center.js')).recentNotifications().map((n) => n.body)`);
  t.check(notices.filter((b) => /aviso-(um|dois)/.test(b)).length <= 1, 'OSC 9 em rajada vira no máximo um aviso', JSON.stringify(notices));

  // IPC só da página do app; estado salvo validado no processo principal
  const path = require('path');
  const { pathToFileURL } = require('url');
  const { fromApp } = require('../src/main/ipc-guard');
  const page = pathToFileURL(path.join(__dirname, '..', 'src', 'renderer', 'index.html')).href;
  t.equal(
    [fromApp({ senderFrame: { url: page } }), fromApp({ senderFrame: { url: 'https://evil.example/' } }), fromApp({ senderFrame: { url: page, parent: {} } }), fromApp({})],
    [true, false, false, false],
    'IPC aceita só o frame principal com a página do app',
  );
  const { validState } = require('../src/main/system');
  const ok = { projects: [{ groups: [{ terminals: [{ id: 'a', cwd: 'C:/x', startup: '' }] }] }], agentProfiles: [{ id: 'claude', command: '', mcp: '' }] };
  t.equal(
    [validState(ok), validState(null), validState({ projects: 'x' }), validState({ ...ok, agentProfiles: [{ id: 'p', command: { evil: 1 } }] }), validState({ projects: [{ groups: [{ terminals: [{ id: 'a', startup: 42 }] }] }] })],
    [true, false, false, false, false],
    'estado com formato inesperado não é gravado',
  );
});
