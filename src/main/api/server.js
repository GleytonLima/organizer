// API local (HTTP em 127.0.0.1 + token) usada pelo CLI `bo` e pelo servidor MCP.
// Rotas: POST /v1/<método> com corpo JSON → { ok, result } ou { ok: false, error }.
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
      if (size > MAX_BODY) reject(new Error('Corpo grande demais.'));
      else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// Só aceita Host local (barra DNS rebinding) e o token correto.
function authorized(req, token) {
  const hostOk = /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host || '');
  const given = Buffer.from(req.headers.authorization || '');
  const expected = Buffer.from(`Bearer ${token}`);
  return hostOk && given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

async function handle(req, res, token) {
  if (!authorized(req, token)) return send(res, 401, { ok: false, error: 'Não autorizado.' });
  const m = /^\/v1\/([a-z_]+)$/.exec(req.url || '');
  if (req.method !== 'POST' || !m) return send(res, 404, { ok: false, error: 'Rota inexistente.' });
  try {
    const raw = await readBody(req);
    const params = raw ? JSON.parse(raw) : {};
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

module.exports = { startApiServer, stopApiServer, apiInfo };
