// Utilidades da primeira abertura: achar um executável, rodá-lo (inclusive .cmd do npm) e ler JSON
// sem quebrar. E o comando do MCP do Brain Organizer (`bo mcp`), igual para todos os agentes.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { childEnv } = require('../env');

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * [comando, ...argumentos fixos] ou null. `override` (variável de ambiente dos testes): JSON
 * '["node", "falso.js"]' ou um caminho. Procura nas pastas fixas e depois no PATH.
 */
function findBin(names, dirs = [], override = '') {
  if (override) return override.trim().startsWith('[') ? JSON.parse(override) : [override];
  const all = [...dirs, ...String(process.env.PATH || '').split(';')].filter(Boolean);
  for (const dir of all) {
    for (const name of names) {
      const file = path.join(dir, name);
      if (fs.existsSync(file)) return [file];
    }
  }
  return null;
}

const quote = (a) => (/[\s"&|<>^]/.test(a) ? `"${a}"` : a);

/** Roda `bin` (de findBin) com `args`. Resolve { code, out } — nunca rejeita. */
function runBin(bin, args, { timeout = 30000 } = {}) {
  if (!bin) return Promise.resolve({ code: 1, out: 'não instalado' });
  const [cmd, ...pre] = bin;
  const all = [...pre, ...args];
  const shell = /\.cmd$/i.test(cmd); // .cmd do npm só roda pelo shell
  return new Promise((resolve) => {
    execFile(shell ? quote(cmd) : cmd, shell ? all.map(quote) : all, { timeout, windowsHide: true, shell, env: childEnv() }, (err, stdout, stderr) =>
      resolve({ code: err ? err.code ?? 1 : 0, out: `${stdout || ''}${stderr || ''}`.trim() }),
    );
  });
}

const unpacked = (p) => p.replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
const BIN_DIR = unpacked(path.resolve(__dirname, '..', '..', '..', 'bin'));

/** Servidor MCP do app para registrar num agente: o runtime do app rodando `bo.js mcp`. */
const boMcp = () => ({ name: 'bash-organizer', command: process.execPath, args: [path.join(BIN_DIR, 'bo.js'), 'mcp'], env: { ELECTRON_RUN_AS_NODE: '1' } });

module.exports = { readJsonSafe, findBin, runBin, quote, boMcp, BIN_DIR };
