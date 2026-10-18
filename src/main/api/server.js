// API local (HTTP em 127.0.0.1 + token) usada pelo CLI `bo` e pelo servidor MCP.
// Rotas: POST /v1/<método> com corpo JSON → { ok, result } ou { ok: false, error }.
// Tokens: o mestre (api.json, para você fora do app) e um por terminal (BO_API_TOKEN dos terminais e
// agentes: "bot_<id>_<hmac>"). Com o do terminal, a identidade vem do token — `from` do pedido é
// ignorado — e vai como `_caller` para os handlers (que pedem o seu OK para agir em outro terminal).
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');
const { userFile, writeJsonAtomic } = require('../files');
const { callRenderer } = require('./bridge');

const MAX_BODY = 1024 * 1024;
const discoveryFile = () => userFile('api.json');
let info = null; // { url, token, pid }

const send = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('Corpo grande demais.'));
        req.destroy();
      }
      else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const signature = (master, id) => crypto.createHmac('sha256', master).update(`terminal:${id}`).digest('hex').slice(0, 40);

/** Token de um terminal (vai no ambiente dele): só vale como aquele terminal. */
const terminalToken = (id) => (info ? `bot_${id}_${signature(info.token, id)}` : null);

/**
 * Quem chama: { master: true } | { terminal: id } | null. Só aceita Host local (barra DNS rebinding).
 * Comparações em tempo constante.
 */
function identify(req, master) {
  if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host || '')) return null;
  const given = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1] || '';
  if (same(given, master)) return { master: true };
  const m = /^bot_([A-Za-z0-9-]{1,40})_([0-9a-f]{40})$/.exec(given);
  return m && same(m[2], signature(master, m[1])) ? { terminal: m[1] } : null;
}

async function handle(req, res, token) {
  const who = identify(req, token);
  if (!who) return send(res, 401, { ok: false, error: 'Não autorizado.' });
  const m = /^\/v1\/([a-z_]+)$/.exec(req.url || '');
  if (req.method !== 'POST' || !m) return send(res, 404, { ok: false, error: 'Rota inexistente.' });
  try {
    const raw = await readBody(req);
    const params = raw ? JSON.parse(raw) : {};
    delete params._caller; // só o servidor define
    if (who.terminal) Object.assign(params, { from: who.terminal, _caller: { terminal: who.terminal } });
    send(res, 200, { ok: true, result: await callRenderer(m[1], params) });
  } catch (err) {
    send(res, 400, { ok: false, error: err.message });
  }
}

function startApiServer() {
  const token = crypto.randomBytes(24).toString('hex');
  const server = http.createServer((req, res) => handle(req, res, token));
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      info = { url: `http://127.0.0.1:${server.address().port}`, token, pid: process.pid };
      writeJsonAtomic(discoveryFile(), info);
      try {
        fs.chmodSync(discoveryFile(), 0o600); // token mestre: só o usuário (no Windows, o %APPDATA% já é dele)
      } catch {}
      resolve(info);
    });
  });
}

function stopApiServer() {
  try {
    fs.rmSync(discoveryFile(), { force: true });
  } catch {}
}

const apiInfo = () => info;

module.exports = { startApiServer, stopApiServer, apiInfo, terminalToken };
