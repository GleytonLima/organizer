// Cliente da API local do Brain Organizer.
// Descoberta: variáveis BO_API_URL/BO_API_TOKEN (terminais do app) ou %APPDATA%/Brain Organizer/api.json
// (ou a pasta antiga, "Bash Organizer", enquanto o app não migrou — ver src/main/data-folder.js).
const fs = require('fs');
const path = require('path');
const http = require('http');

const DISCOVERY_FILES = ['Brain Organizer', 'Bash Organizer'].map((dir) => path.join(process.env.APPDATA || '', dir, 'api.json'));

function endpoints() {
  const list = [];
  const { BO_API_URL: url, BO_API_TOKEN: token } = process.env;
  if (url && token) list.push({ url, token });
  for (const f of DISCOVERY_FILES) {
    try {
      const file = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (!list.some((e) => e.url === file.url)) list.push(file);
    } catch {}
  }
  return list;
}

// Métodos que podem esperar a sua confirmação no app. Mesma lista em src/main/api/bridge.js.
const ASKS_YOU = new Set(['send', 'close', 'memory_forget', 'task_delete']);

function post({ url, token }, method, params) {
  const body = JSON.stringify(params);
  return new Promise((resolve, reject) => {
    const req = http.request(
      `${url}/v1/${method}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), Authorization: `Bearer ${token}` },
        timeout: ASKS_YOU.has(method) ? 5 * 60000 + 5000 : 20000, // confirmações no app esperam você
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error(`Resposta inválida (${res.statusCode}).`));
          }
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error('Tempo esgotado falando com o app.')));
    req.on('error', reject);
    req.end(body);
  });
}

const isConnError = (err) => ['ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH'].includes(err.code);

/**
 * Chama um método da API. Contexto enviado junto: `from` (terminal de origem, BO_TERMINAL_ID) e
 * `fromCwd` (pasta atual) — fora de um terminal do app, o projeto é deduzido pela pasta.
 */
async function request(method, params = {}) {
  const payload = { from: process.env.BO_TERMINAL_ID, fromCwd: process.cwd(), ...params };
  const targets = endpoints();
  if (!targets.length) throw new Error('Brain Organizer não está aberto (api.json não encontrado).');
  let lastErr;
  for (const target of targets) {
    try {
      const res = await post(target, method, payload);
      if (!res.ok) throw Object.assign(new Error(res.error || 'Erro desconhecido.'), { fromApi: true });
      return res.result;
    } catch (err) {
      if (err.fromApi || !isConnError(err)) throw err;
      lastErr = err;
    }
  }
  throw new Error(`Não foi possível conectar ao Brain Organizer (${lastErr.code}). O app está aberto?`);
}

module.exports = { request };
