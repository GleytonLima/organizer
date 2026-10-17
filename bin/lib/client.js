// Cliente da API local do Bash Organizer.
// Descoberta: variáveis BO_API_URL/BO_API_TOKEN (terminais do app) ou %APPDATA%/Bash Organizer/api.json.
const fs = require('fs');
const path = require('path');
const http = require('http');

const DISCOVERY_FILE = path.join(process.env.APPDATA || '', 'Bash Organizer', 'api.json');

function endpoints() {
  const list = [];
  const { BO_API_URL: url, BO_API_TOKEN: token } = process.env;
  if (url && token) list.push({ url, token });
  try {
    const file = JSON.parse(fs.readFileSync(DISCOVERY_FILE, 'utf8'));
    if (file.url !== url) list.push(file);
  } catch {}
  return list;
}

function post({ url, token }, method, params) {
  const body = JSON.stringify(params);
  return new Promise((resolve, reject) => {
    const req = http.request(
      `${url}/v1/${method}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), Authorization: `Bearer ${token}` },
        timeout: 20000,
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

/** Chama um método da API; `from` (terminal de origem) vem de BO_TERMINAL_ID. */
async function request(method, params = {}) {
  const payload = { from: process.env.BO_TERMINAL_ID, ...params };
  const targets = endpoints();
  if (!targets.length) throw new Error('Bash Organizer não está aberto (api.json não encontrado).');
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
  throw new Error(`Não foi possível conectar ao Bash Organizer (${lastErr.code}). O app está aberto?`);
}

module.exports = { request };
