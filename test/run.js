// Runner dos testes de ponta a ponta (`npm test`): cada suíte roda num processo Electron próprio,
// com pasta temporária isolada. Uso: node test/run.js [nome…]   (ex.: node test/run.js memory)
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const electron = require('electron'); // em Node, o pacote devolve o caminho do executável

// `runs`: quantas vezes abrir o app na mesma pasta (ex.: persistência ao reabrir).
const SUITES = [
  { name: 'shell' },
  { name: 'tasks' },
  { name: 'memory', runs: 2 },
  { name: 'memory-scopes' },
  { name: 'projects' },
  { name: 'split' },
  { name: 'pty-cleanup', runs: 2 }, // fechar terminal/app não deixa bash nem comandos órfãos
  { name: 'machine' }, // trocar de máquina: projeto e layout no servidor (pulada sem o bo-memory-server)
  { name: 'tasks-sync' }, // quadro de tarefas do workspace (pulada sem o bo-memory-server)
  { name: 'settings' }, // Configurações → Servidor do time; SSO com o Keycloak de teste se estiver no ar
  { name: 'data-folder' }, // troca de nome: a pasta de dados antiga migra sozinha
  { name: 'home' }, // Home: aguardando você, continue de onde parou, enquanto você esteve fora, modo foco
  { name: 'links' },
  { name: 'agent', runs: 2 },
  { name: 'insights' },
  { name: 'consolidate' }, // consolidação da memória ao concluir tarefas
  { name: 'search-eval' }, // avaliação da busca (hit@k); imprime as métricas
  { name: 'sync' }, // precisa do bo-memory-server (binário) e do PostgreSQL de testes; sem eles, é pulada
];
// `manual`: fora do `npm test`, roda só pelo nome (ex.: node test/run.js promo-shots)
SUITES.push({ name: 'promo-shots', manual: true });
const SUITE_TIMEOUT = 180000;

function runOnce(suite, dir, run) {
  return new Promise((resolve) => {
    const env = { ...process.env, BO_TEST_DIR: dir, BO_TEST_RUN: String(run) };
    delete env.ELECTRON_RUN_AS_NODE;
    const child = spawn(electron, [path.join(__dirname, `${suite.name}.test.js`)], { env, stdio: ['ignore', 'inherit', 'pipe'] });
    // stderr só aparece se falhar (o node-pty solta ruído como "AttachConsole failed" ao encerrar)
    let stderr = '';
    child.stderr.on('data', (d) => (stderr += d));
    const timer = setTimeout(() => {
      console.error(`  ✗ ${suite.name}: processo não terminou em ${SUITE_TIMEOUT / 1000} s`);
      child.kill();
    }, SUITE_TIMEOUT);
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ code, stderr });
    });
  });
}

function readResults(dir, run) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, `result-${run}.json`), 'utf8')).results;
  } catch {
    return null; // o processo caiu antes de gravar o resultado
  }
}

/** --coverage: cobertura V8 de tudo (main, renderer, CLI) → coverage/lcov.info (ver lib/coverage.js). */
const COVERAGE = process.argv.includes('--coverage');
const COV_DIR = path.join(__dirname, '..', 'coverage');
if (COVERAGE) {
  fs.rmSync(COV_DIR, { recursive: true, force: true });
  process.env.NODE_V8_COVERAGE = path.join(COV_DIR, 'v8');
}

function coverageReport() {
  const { spawnSync } = require('child_process');
  const c8 = require.resolve('c8/bin/c8.js');
  spawnSync(process.execPath, [c8, 'report', '--temp-directory', process.env.NODE_V8_COVERAGE, '--report-dir', COV_DIR, '--reporter', 'lcov', '--reporter', 'text-summary',
    '--src', path.join(__dirname, '..'), '--include', 'src/**', '--include', 'bin/**', '--exclude', 'test/**'], { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  require('./lib/coverage').relativizeLcov(path.join(COV_DIR, 'lcov.info'), path.join(__dirname, '..'));
}

async function main() {
  const only = process.argv.slice(2).filter((a) => a !== '--coverage');
  const selected = only.length ? SUITES.filter((s) => only.includes(s.name)) : SUITES.filter((s) => !s.manual);
  if (!selected.length) throw new Error(`Suíte desconhecida: ${only.join(', ')}`);
  const summary = [];
  for (const suite of selected) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `bo-test-${suite.name}-`));
    let ok = true;
    let passed = 0;
    let total = 0;
    for (let run = 1; run <= (suite.runs || 1); run++) {
      const { code, stderr } = await runOnce(suite, dir, run);
      const results = readResults(dir, run);
      if (!results) console.error(`  ✗ ${suite.name}: execução ${run} terminou sem resultado (código ${code})`);
      passed += results ? results.filter((r) => r.ok).length : 0;
      total += results ? results.length : 0;
      // Sair com código ≠ 0 depois de gravar os resultados = o app quebrou ao fechar (ex.: 0xC0000409
      // quando os ptys não terminam antes do processo; ver closeAll em src/main/pty.js).
      const runOk = !!results && results.every((r) => r.ok) && code === 0;
      if (results && code !== 0) console.error(`  ✗ ${suite.name}: execução ${run} saiu com código ${code} ao encerrar o app`);
      if (!runOk && stderr.trim()) console.error(`  stderr de ${suite.name}:\n${stderr.trim().replace(/^/gm, '    ')}`);
      ok &&= runOk;
    }
    summary.push({ name: suite.name, ok, passed, total, dir });
    if (ok) {
      try {
        fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
      } catch {} // arquivo ainda preso por um processo filho: fica no %TEMP%
    }
  }

  console.log('\nResumo');
  for (const s of summary) {
    console.log(`  ${s.ok ? '✓' : '✗'} ${s.name.padEnd(14)} ${s.passed}/${s.total}${s.ok ? '' : `  (dados mantidos em ${s.dir})`}`);
  }
  const failed = summary.filter((s) => !s.ok).length;
  console.log(failed ? `\n${failed} suíte(s) falharam.` : '\nTudo passou.');
  process.exitCode = failed ? 1 : 0;
  if (COVERAGE) coverageReport();
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
