// "Navegador" mínimo para os testes de SSO: segue redirecionamentos guardando cookies por host e
// preenche o formulário de login do Keycloak de teste (bo-memory-server/docker/keycloak).
// Senhas aqui são só do realm de teste.

/** Cookies por host (nome=valor; sem caminho/validade: suficiente para um login). */
function jar() {
  const byHost = new Map();
  return {
    header: (url) => [...(byHost.get(new URL(url).host) || new Map())].map(([k, v]) => `${k}=${v}`).join('; '),
    store(url, res) {
      const host = new URL(url).host;
      const map = byHost.get(host) || new Map();
      for (const c of res.headers.getSetCookie?.() || []) {
        const [pair] = c.split(';');
        const i = pair.indexOf('=');
        map.set(pair.slice(0, i).trim(), pair.slice(i + 1));
      }
      byHost.set(host, map);
    },
  };
}

const unescape = (s) => s.replace(/&amp;/g, '&');

/**
 * Faz o login a partir de `startUrl` (ex.: /auth/desktop?…) até chegar a `stopHost` (o endereço local
 * do app), entrando no Keycloak com `user`/`password`. Devolve a URL final.
 */
async function browserLogin(startUrl, { user, password, stopHost }) {
  const cookies = jar();
  let url = startUrl;
  let body;
  let method = 'GET';
  for (let i = 0; i < 12; i++) {
    if (new URL(url).host === stopHost) {
      await fetch(url); // entrega ao app (ele responde com a página "Pronto")
      return url;
    }
    const res = await fetch(url, {
      method,
      body,
      redirect: 'manual',
      headers: { Cookie: cookies.header(url), ...(body && { 'Content-Type': 'application/x-www-form-urlencoded' }) },
    });
    cookies.store(url, res);
    [method, body] = ['GET', undefined];
    const location = res.headers.get('location');
    if (location) {
      url = new URL(location, url).toString();
      continue;
    }
    const html = await res.text();
    const action = /<form[^>]*id="kc-form-login"[^>]*action="([^"]+)"/.exec(html)?.[1];
    if (!action) throw new Error(`login travou em ${url} (${res.status}): ${html.slice(0, 200)}`);
    url = unescape(action);
    method = 'POST';
    body = new URLSearchParams({ username: user, password, credentialId: '' }).toString();
  }
  throw new Error('login não terminou');
}

module.exports = { browserLogin };
