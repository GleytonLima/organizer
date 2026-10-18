// Conectar ao servidor do time (bo-memory-server/docs/API.md → "Autenticação"):
//   probe: o endereço responde? é um servidor de memória? como ele deixa entrar (SSO, token)?
//   loginWithBrowser: SSO pelo navegador do sistema (RFC 8252) — endereço local temporário em
//     127.0.0.1, desafio PKCE, código de uso único trocado pela sessão. O app nunca vê a senha.
const http = require('http');
const crypto = require('crypto');
const { shell } = require('electron');
const { failure } = require('./client');

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
let pending = null; // { cancel } do login em andamento

const clean = (url) => String(url || '').trim().replace(/\/+$/, '');
const b64url = (buf) => buf.toString('base64url');

async function getJson(url) {
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  } catch (err) {
    throw failure(`Não encontrei nada em ${new URL(url).host}. Confira o endereço e a sua rede (VPN?).`, 'offline');
  }
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

/** { url, sso, provider, personalTokens } — ou erro em linguagem humana. */
async function probe(rawUrl) {
  const url = clean(rawUrl);
  if (!/^https?:\/\/[^/\s]+/.test(url)) throw new Error('Informe o endereço completo, começando com https://');
  const health = await getJson(`${url}/healthz`);
  const config = await getJson(`${url}/auth/config`);
  if (!health.data?.ok || typeof config.data?.sso !== 'boolean') {
    throw new Error('Esse endereço respondeu, mas não é um servidor de memória do Bash Organizer.');
  }
  return { url, sso: config.data.sso, provider: config.data.provider || 'SSO', personalTokens: config.data.personalTokens !== false };
}

const page = (title, text) =>
  `<!doctype html><meta charset="utf-8"><title>${title}</title><body style="font:15px system-ui;display:grid;place-items:center;height:90vh;color:#333">` +
  `<div style="text-align:center"><h2 style="font-weight:500">${title}</h2><p>${text}</p></div>`;

/** Espera o navegador voltar a http://127.0.0.1:<porta>/callback?code=… (ou ?error=…). */
function waitForCallback(server) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('O login não foi concluído no navegador (tempo esgotado).')), LOGIN_TIMEOUT_MS);
    pending = { cancel: () => reject(new Error('Login cancelado.')) };
    server.on('request', (req, res) => {
      const u = new URL(req.url, 'http://127.0.0.1');
      if (u.pathname !== '/callback') return res.writeHead(404).end();
      const code = u.searchParams.get('code');
      const ok = !!code;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(ok ? page('Pronto', 'Você já pode voltar ao Bash Organizer.') : page('Não foi possível entrar', u.searchParams.get('error') || 'Tente de novo pelo app.'));
      clearTimeout(timer);
      ok ? resolve(code) : reject(new Error(u.searchParams.get('error') || 'O servidor não concluiu o login.'));
    });
  });
}

/** SSO pelo navegador; devolve a sessão (bos_…). */
async function loginWithBrowser(rawUrl) {
  const url = clean(rawUrl);
  pending?.cancel();
  const verifier = b64url(crypto.randomBytes(32)); // 43 caracteres
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const server = http.createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const port = server.address().port;
    const done = waitForCallback(server);
    await shell.openExternal(`${url}/auth/desktop?port=${port}&challenge=${challenge}`);
    const code = await done;
    const res = await fetch(`${url}/auth/desktop/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, verifier }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.session) throw new Error(data.error || 'O servidor recusou o login.');
    return data.session;
  } finally {
    pending = null;
    server.close();
  }
}

const cancelLogin = () => pending?.cancel();

module.exports = { probe, loginWithBrowser, cancelLogin };
