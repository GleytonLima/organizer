// Sobe o bo-memory-server (repo irmão ../bo-memory-server) para os testes de sync, num banco de
// testes zerado, com dois devs: Ana (o app) e Bruno (outra máquina, via HTTP).
// Requer o binário (go build -o bin/bo-memory-server.exe ./cmd/bo-memory-server) e o PostgreSQL do
// docker compose. Sem eles, a suíte é pulada. BO_MEMORY_SERVER / TEST_DATABASE_URL sobrescrevem.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile, spawn } = require('child_process');

const SERVER_DIR = path.resolve(__dirname, '..', '..', '..', 'bo-memory-server');
const BIN = process.env.BO_MEMORY_SERVER || path.join(SERVER_DIR, 'bin', 'bo-memory-server.exe');
const DB = process.env.TEST_DATABASE_URL || 'postgres://bo:bo@localhost:55432/bo_memory_test?sslmode=disable';
const PORT = 18787;

const run = (args, env) =>
  new Promise((resolve) => {
    execFile(BIN, args, { env, encoding: 'utf8', timeout: 30000, windowsHide: true }, (err, stdout, stderr) =>
      resolve({ code: err ? err.code || 1 : 0, stdout, stderr }),
    );
  });

const lastLine = (s) => s.trim().split(/\r?\n/).pop().trim();

async function http(url, token, method, route, body) {
  const res = await fetch(`${url}${route}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body && { 'Content-Type': 'application/json' }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

/**
 * { url, tokenA, tokenB, as(token) → (method, rota, corpo), stop } ou { skip: motivo }.
 * `env`: variáveis extras do servidor (ex.: BO_OIDC_* para o SSO com o Keycloak de teste).
 */
async function startMemoryServer({ env: extra = {} } = {}) {
  if (!fs.existsSync(BIN)) return { skip: `binário do servidor não encontrado (${BIN})` };
  const env = { ...process.env, DATABASE_URL: DB, BO_ADDR: `127.0.0.1:${PORT}`, BO_WEB_DIR: os.tmpdir(), ...extra };
  const up = await run(['migrate', 'up'], env); // cria a tabela de versões (o reset precisa dela)
  if (up.code) return { skip: `PostgreSQL de testes indisponível (${lastLine(up.stderr || up.stdout)}) — rode docker compose up -d` };
  await run(['migrate', 'reset'], env);
  const tokenA = lastLine((await run(['admin', 'create', '--name', 'Ana', '--email', 'ana@x.com'], env)).stdout);
  const tokenB = lastLine((await run(['admin', 'create', '--name', 'Bruno', '--email', 'bruno@x.com'], env)).stdout);
  const child = spawn(BIN, ['serve'], { env, stdio: 'ignore', windowsHide: true });
  const url = `http://127.0.0.1:${PORT}`;
  for (let i = 0; i < 60; i++) {
    const ok = await fetch(`${url}/healthz`).then((r) => r.ok, () => false);
    if (ok) return { url, tokenA, tokenB, as: (token) => (...a) => http(url, token, ...a), stop: () => child.kill() };
    await new Promise((r) => setTimeout(r, 250));
  }
  child.kill();
  return { skip: 'o servidor não respondeu em /healthz' };
}

module.exports = { startMemoryServer, PORT };
