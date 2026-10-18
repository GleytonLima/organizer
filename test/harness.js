// Harness dos testes de ponta a ponta: roda dentro do Electron (processo principal), sobe o app
// com uma pasta de dados isolada e um state.json semeado, e entrega um contexto ao teste.
// Variáveis (definidas pelo test/run.js): BO_TEST_DIR = pasta temporária da suíte,
// BO_TEST_RUN = número da execução (suítes com várias execuções reabrem o app na mesma pasta).
const { app } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createChecks } = require('./lib/checks');
const { createContext, wait } = require('./lib/context');
const { startRendererCoverage } = require('./lib/coverage');

const ROOT = path.resolve(__dirname, '..');
const TIMEOUT = 150000;
const print = (s) => process.stdout.write(s + '\n');

/**
 * Define e executa a suíte. `seed(dir)` devolve o state.json inicial (só na 1ª execução);
 * `body(t)` recebe o contexto (ver lib/context.js) e faz as verificações.
 */
function suite(name, { seed }, body) {
  const dir = process.env.BO_TEST_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'bo-test-'));
  const run = Number(process.env.BO_TEST_RUN || 1);
  const ud = path.join(dir, 'userdata');
  const checks = createChecks(print);
  const consoleErrors = [];

  if (run === 1) {
    fs.mkdirSync(ud, { recursive: true });
    fs.writeFileSync(path.join(ud, 'state.json'), JSON.stringify(seed(dir), null, 2));
  }
  process.env.BO_USER_DATA = ud; // lido pelo src/main/index.js (pasta de dados e trava de instância)

  let exitCode = 1;
  const finish = (code) => {
    exitCode = code;
    fs.writeFileSync(path.join(dir, `result-${run}.json`), JSON.stringify({ name, run, results: checks.results }, null, 2));
  };
  app.on('quit', () => (process.exitCode = exitCode));
  process.on('uncaughtException', (e) => checks.fail('exceção não tratada no processo principal', e.stack));

  const timer = setTimeout(() => {
    checks.fail(`tempo esgotado (${TIMEOUT / 1000} s)`);
    finish(1);
    app.exit(1);
  }, TIMEOUT);

  app.once('browser-window-created', async (_e, win) => {
    const wc = win.webContents;
    const saveCoverage = startRendererCoverage(wc); // só com --coverage (NODE_V8_COVERAGE)
    win.setSize(1400, 860);
    // Electron novo: um objeto com `level` em texto; antigo: (evento, nível numérico, mensagem).
    wc.on('console-message', (e, level, message) => {
      const lv = e.level ?? level;
      if (lv === 'error' || lv === 3) consoleErrors.push(e.message ?? message);
    });
    await new Promise((r) => wc.once('did-finish-load', r));
    print(`\n▶ ${name}${run > 1 ? ` (execução ${run})` : ''}`);
    let t;
    try {
      t = createContext({ win, dir, ud, run, checks });
      await t.waitFor(() => t.js(`return !!S.store.state?.projects`).catch(() => false));
      await body(t);
    } catch (err) {
      checks.fail('o teste lançou uma exceção', err.stack || String(err));
    }
    t?.closeClients();
    checks.check(!consoleErrors.length, 'sem erros no console do renderer', consoleErrors.join('\n      '));
    clearTimeout(timer);
    finish(checks.failed() ? 1 : 0);
    await (await saveCoverage)?.().catch(() => {});
    await wait(300);
    win.close(); // fecha como o usuário: salva o estado e encerra a memória normalmente
  });

  require(path.join(ROOT, 'src', 'main', 'index.js'));
}

module.exports = { suite, seed: require('./lib/seed') };
