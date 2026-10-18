// Fechar terminal não deixa processos para trás: nem o bash (o Git\bin\bash.exe é só um lançador
// do usr\bin\bash.exe), nem o que rodava nele. Duas execuções: a 2ª confere que fechar o app
// também encerrou os shells da 1ª.
const fs = require('fs');
const path = require('path');
const { suite, seed } = require('./harness');
const { listProcesses, shellsOf } = require('./lib/procs');

const MARK = 'bo-marca-limpeza';
// processo nativo do Windows (o node-pty avisa que esses podem se soltar do console) e um do MSYS
const NATIVE = `ELECTRON_RUN_AS_NODE=1 "$BO_NODE" -e "setInterval(() => {}, 1e6)" ${MARK}`;
const MSYS = 'sleep 3123';

const sleeping = (procs) => procs.filter((p) => /sleep(\.exe)?"?\s+3123/.test(p.cmd));
const natives = (procs) => procs.filter((p) => p.cmd.includes(MARK) && p.name === 'electron.exe');

suite('limpeza dos ptys', {
  seed: (dir) => {
    const [work] = seed.makeFolders(dir, ['work'], { git: false });
    return seed.state([
      seed.project('p1', 'limpeza', [work], [
        seed.group('g1', 'Terminais', [seed.term('idle', 'ocioso', work), seed.term('srv', 'servidor', work, NATIVE), seed.term('slp', 'sono', work, MSYS)]),
      ]),
    ]);
  },
}, async (t) => {
  const pidsFile = path.join(t.dir, 'shells-run1.json');
  if (t.run === 2) {
    const alive = new Set((await listProcesses()).map((p) => p.pid));
    const left = JSON.parse(fs.readFileSync(pidsFile, 'utf8')).filter((p) => alive.has(p.pid));
    t.equal(left.map((p) => p.cmd), [], 'fechar o app encerrou todos os shells e processos da execução anterior');
    return;
  }

  // Lado a lado: as três sessões existem (e os comandos iniciais rodam) sem precisar ativar uma a uma.
  await t.js(`(await import('./js/actions/split.js')).splitGroup(S.store.state.projects[0].groups[0])`);
  t.check(await t.shellReady('idle'), 'terminal ocioso pronto');
  const procs = await t.waitFor(async () => {
    const all = await listProcesses();
    return sleeping(all).length && natives(all).length && shellsOf(all, t.ud).length >= 6 ? all : null;
  }, { timeout: 30000, every: 1000 });
  t.check(procs, 'os três shells (lançador + bash) e os dois comandos estão rodando');
  const all = procs || [];
  // bash.exe do lançador (Git\bin) e o de verdade (Git\usr\bin), filho dele. (Um comando nativo
  // ganha mais um bash.exe intermediário do MSYS, por isso não dá para contar só os internos.)
  const shells = shellsOf(all, t.ud);
  const isInner = (p) => /usr[\\/]bin[\\/]bash\.exe/i.test(p.cmd);
  const launchers = shells.filter((p) => !isInner(p));
  t.check(launchers.length === 3 && launchers.every((l) => shells.some((p) => isInner(p) && p.ppid === l.pid)), 'cada terminal = lançador bin\\bash.exe → usr\\bin\\bash.exe', JSON.stringify(shells.map((p) => [p.pid, p.ppid, p.cmd.slice(0, 50)])));

  await t.js(`T.removeTerminal('srv'); T.removeTerminal('slp')`);
  const after = await t.waitFor(async () => {
    const now = await listProcesses();
    return !sleeping(now).length && !natives(now).length && shellsOf(now, t.ud).length === 2 ? now : null;
  }, { timeout: 10000, every: 500 });
  const now = after || (await listProcesses());
  t.equal(sleeping(now).map((p) => p.cmd), [], 'fechar o terminal encerra o comando do MSYS que rodava nele');
  t.equal(natives(now).map((p) => p.cmd), [], 'fechar o terminal encerra o processo nativo que rodava nele');
  t.equal(shellsOf(now, t.ud).length, 2, 'só restam os dois bash do terminal que continua aberto');

  // para a 2ª execução: tudo o que este app abriu e ainda está vivo
  fs.writeFileSync(pidsFile, JSON.stringify(shellsOf(now, t.ud).map(({ pid, cmd }) => ({ pid, cmd }))));
});
