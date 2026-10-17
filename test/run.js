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
  { name: 'links' },
  { name: 'agent', runs: 2 },
  { name: 'sync' }, // precisa do bo-memory-server (binário) e do PostgreSQL de testes; sem eles, é pulada
];
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

async function main() {
  const only = process.argv.slice(2);
  const selected = only.length ? SUITES.filter((s) => only.includes(s.name)) : SUITES;
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
      // O arquivo de resultados é a verdade: o node-pty às vezes derruba o processo ao encerrar os
      // ptys (0xC0000409) depois de tudo gravado — isso vira aviso, não falha.
      const runOk = !!results && results.every((r) => r.ok);
      if (results && code !== 0) console.error(`  ! ${suite.name}: execução ${run} saiu com código ${code} ao encerrar (resultados já gravados)`);
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
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
