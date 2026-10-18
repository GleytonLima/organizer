// Cobertura dos testes (`npm run test:coverage`, para o SonarQube): o processo principal e os filhos
// Node (CLI `bo`, servidor MCP) gravam a cobertura V8 sozinhos em NODE_V8_COVERAGE; o renderer não,
// então ela é coletada pelo Profiler do DevTools (CDP) e gravada no mesmo formato e na mesma pasta.
// Depois o run.js usa o c8 para virar lcov (coverage/lcov.info) com caminhos relativos.
const fs = require('fs');
const path = require('path');

const DIR = () => process.env.NODE_V8_COVERAGE;

/**
 * Começa a medir o renderer desta janela. Devolve a função que grava o resultado (ou null, fora do
 * modo cobertura). `toFileUrl(url)` converte URLs que não são file:// (ex.: a web servida por HTTP).
 */
async function startRendererCoverage(wc, { toFileUrl = (u) => u } = {}) {
  if (!DIR()) return null;
  const dbg = wc.debugger;
  dbg.attach('1.3');
  await dbg.sendCommand('Profiler.enable');
  await dbg.sendCommand('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
  return async () => {
    const { result } = await dbg.sendCommand('Profiler.takePreciseCoverage');
    const scripts = result.map((r) => ({ ...r, url: toFileUrl(r.url) })).filter((r) => r.url.startsWith('file:'));
    fs.mkdirSync(DIR(), { recursive: true });
    fs.writeFileSync(path.join(DIR(), `coverage-renderer-${process.pid}-${Date.now()}.json`), JSON.stringify({ result: scripts }));
    dbg.detach();
  };
}

/** lcov com caminhos relativos a `root` e barras normais (o scanner roda em outra raiz, no Docker). */
function relativizeLcov(file, root) {
  const prefix = path.resolve(root) + path.sep;
  const text = fs.readFileSync(file, 'utf8').replace(/^SF:(.*)$/gm, (_m, p) => {
    const rel = p.toLowerCase().startsWith(prefix.toLowerCase()) ? p.slice(prefix.length) : p;
    return `SF:${rel.replace(/\\/g, '/')}`;
  });
  fs.writeFileSync(file, text);
}

module.exports = { startRendererCoverage, relativizeLcov };
