// Contexto entregue a cada teste: acesso ao renderer, terminais, MCP, CLI `bo` e janelas de diálogo.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { startMcp, BO } = require('./mcp');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Módulos do renderer sempre disponíveis no código passado a `js()`.
const BASE_IMPORTS = {
  S: './js/core/store.js',
  SE: './js/terminals/sessions.js',
  B: './js/terminals/buffer.js',
  T: './js/actions/terminals.js',
};

/** Repete `fn` até devolver algo verdadeiro ou o tempo acabar; devolve o último valor. */
async function waitFor(fn, { timeout = 15000, every = 250 } = {}) {
  const end = Date.now() + timeout;
  let value;
  do {
    value = await fn();
    if (value) return value;
    await wait(every);
  } while (Date.now() < end);
  return value;
}

function createContext({ win, dir, ud, run, checks }) {
  const wc = win.webContents;
  const api = JSON.parse(fs.readFileSync(path.join(ud, 'api.json'), 'utf8'));
  const clients = [];

  /** Executa `code` (corpo de função async) no renderer; `imports`: { Nome: './js/…' } extras. */
  function js(code, imports = {}) {
    const pre = Object.entries({ ...BASE_IMPORTS, ...imports })
      .map(([k, v]) => `const ${k} = await import(${JSON.stringify(v)});`)
      .join(' ');
    return wc.executeJavaScript(`(async () => { ${pre}\n${code}\n})()`);
  }

  const lines = (id, count = 40) => js(`return B.readLines(${JSON.stringify(id)}, ${count}) || ''`);
  const type = (id, text) => js(`await SE.writeWhenReady(${JSON.stringify(id)}, ${JSON.stringify(text + '\r')})`);

  /** Espera o bash do terminal responder (o Git Bash demora alguns segundos no primeiro início). */
  async function shellReady(id, timeout = 30000) {
    await waitFor(() => js(`return !!SE.getSession(${JSON.stringify(id)})`), { timeout });
    await type(id, 'echo __BO_$((40+2))_PRONTO');
    return !!(await waitFor(async () => (await lines(id, 200)).includes('__BO_42_PRONTO'), { timeout }));
  }

  /** Ambiente de um agente: aponta só para este app (APPDATA isolado evita cair no app real). */
  // `token`: o do terminal (como um agente rodando nele) em vez do mestre — ver src/main/api/server.js
  const agentEnv = (terminalId = '', token = api.token) => ({
    ...process.env,
    APPDATA: dir,
    BO_API_URL: api.url,
    BO_API_TOKEN: token,
    BO_TERMINAL_ID: terminalId,
  });

  async function mcp(terminalId = '', { cwd, token } = {}) {
    const client = startMcp({ env: agentEnv(terminalId, token), cwd });
    clients.push(client);
    await client.init();
    return client;
  }

  // Sempre assíncrono: execFileSync travaria o processo principal, que é quem atende a API.
  const bo = (args, { terminal = '', cwd } = {}) =>
    new Promise((resolve) => {
      const env = { ...agentEnv(terminal), ELECTRON_RUN_AS_NODE: '1' };
      execFile(process.execPath, [BO, ...args], { env, cwd, encoding: 'utf8', timeout: 30000 }, (err, stdout, stderr) =>
        resolve({ code: err ? (err.code ?? 1) : 0, stdout, stderr }),
      );
    });

  // Diálogo modal (#modal): texto visível, confirmar ou cancelar.
  const modal = {
    open: () => js(`return !document.querySelector('#modal-backdrop').classList.contains('hidden')`),
    text: () => js(`return document.querySelector('#modal').innerText`),
    submit: () => js(`document.querySelector('#modal [type=submit]').click()`),
    cancel: () => js(`[...document.querySelectorAll('#modal .btn.ghost')].find((b) => b.textContent === 'Cancelar').click()`),
  };

  return {
    ...checks,
    win, wc, dir, ud, run, api,
    root: path.resolve(__dirname, '..', '..'),
    wait, waitFor, js, lines, type, shellReady, agentEnv, mcp, bo, modal,
    closeClients: () => clients.forEach((c) => c.close()),
  };
}

module.exports = { createContext, waitFor, wait };
