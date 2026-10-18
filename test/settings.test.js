// Configurações → Servidor do time, pela interface: sem servidor o app é "Local"; conectar pergunta ao
// servidor como entrar; token pessoal e SSO pelo navegador (Keycloak de teste, se estiver no ar);
// compartilhar projeto; sessão expirada; offline com fila; desconectar sem perder nada.
const { suite, seed } = require('./harness');
const { startMemoryServer, PORT } = require('./lib/memory-server');
const { browserLogin } = require('./lib/fake-browser');

process.env.BO_SYNC_INTERVAL_MS = '600000'; // só as rodadas que o teste pede
const KEYCLOAK = 'http://localhost:8180/realms/bo-memoria';

suite('configurações: servidor do time', {
  seed: (dir) => {
    const [app] = seed.makeFolders(dir, ['app']);
    return seed.state([seed.project('pA', 'Meu App', [app], [seed.group('gA', 'Terminais', [seed.term('a1', 'a1', app)])])]);
  },
}, async (t) => {
  const kc = await fetch(`${KEYCLOAK}/.well-known/openid-configuration`).then((r) => r.ok, () => false);
  const url = `http://localhost:${PORT}`;
  const srv = await startMemoryServer({
    env: kc ? { BO_OIDC_ISSUER: KEYCLOAK, BO_OIDC_CLIENT_ID: 'bo-memory-server', BO_OIDC_CLIENT_SECRET: 'bo-local-teste-segredo', BO_OIDC_PROVIDER_NAME: 'Keycloak', BO_PUBLIC_URL: url } : {},
  });
  if (srv.skip) return t.check(true, `(pulado: ${srv.skip})`);
  const indicator = () => t.js(`return document.querySelector('.sync-indicator')?.innerText.trim()`);
  const card = () => t.js(`return document.querySelector('.set-body')?.innerText || ''`);
  const type = (key, value) => t.js(`const i = document.querySelector('[data-draft=${key}]'); i.value = ${JSON.stringify(value)}; i.dispatchEvent(new Event('input'))`);
  const click = (text) => t.js(`const b = [...document.querySelectorAll('.set-body button')].find((x) => x.innerText.trim() === ${JSON.stringify(text)}); if (!b) throw new Error('sem botão ' + ${JSON.stringify(text)}); b.click()`);
  const until = (fn, timeout) => t.waitFor(fn, { timeout: timeout || 15000 });
  const syncNow = () => t.js(`return (await api.sync.now()).state`);
  const shot = async (name) => process.env.BO_TEST_SHOTS && require('fs').writeFileSync(require('path').join(process.env.BO_TEST_SHOTS, `settings-${name}.png`), (await t.wc.capturePage()).toPNG());
  try {
    // 1. Sem servidor: "Local" e o convite (opcional) para conectar.
    t.equal(await indicator(), 'Local', 'sem servidor, o indicador diz Local');
    await t.js(`document.querySelector('.sync-indicator').click()`);
    t.includes(await until(card), 'O app funciona inteiro nesta máquina', 'clicar no indicador abre Configurações → Servidor do time');
    await shot('1-local');

    // 2. Endereço errado: erro em linguagem humana, sem salvar nada.
    await type('url', 'http://localhost:1');
    await click('Continuar');
    t.includes(await until(async () => ((await card()).includes('Não encontrei') ? card() : null)), 'Confira o endereço', 'endereço sem servidor dá erro claro');

    // 3. Endereço certo: o app pergunta ao servidor como entrar.
    await type('url', url);
    await click('Continuar');
    const method = await until(async () => ((await card()).includes('servidor de memória encontrado') || (await card()).includes('token pessoal') ? card() : null));
    if (kc) t.includes(method, 'Entrar com Keycloak', 'com SSO, o botão principal é Entrar com o provedor');
    await shot('2-metodo');
    if (kc) await click('Usar um token pessoal');
    await type('token', srv.tokenA);
    await click('Entrar');
    t.includes(await until(async () => ((await card()).includes('Ana') ? card() : null)), 'ana@x.com', 'com token pessoal: conectado como Ana');
    t.equal(await syncNow(), 'ok', 'sincroniza');
    t.includes(await until(async () => ((await indicator()).startsWith('Sincronizado') ? indicator() : null)), 'Sincronizado', 'o indicador mostra Sincronizado');

    // 4. Compartilhar o projeto com o time.
    await t.js(`[...document.querySelectorAll('.set-list-row button')].find((b) => b.innerText === 'Compartilhar').click()`);
    await until(t.modal.open);
    await t.modal.submit();
    t.equal(await until(() => t.js(`return S.store.state.projects[0].syncKey`)), 'meu-app', 'Compartilhar dá ao projeto a chave sugerida pelo nome');
    await t.wait(300);
    await shot('3-conectado');

    // 5. Sessão revogada/expirada: o indicador avisa e a seção oferece entrar de novo.
    await srv.as(srv.tokenA)('POST', '/v1/logout');
    t.equal(await syncNow(), 'auth', 'token recusado vira estado "auth"');
    t.equal(await until(async () => ((await indicator()).includes('Sessão') ? indicator() : null)), 'Sessão expirou · Entrar', 'o indicador mostra Sessão expirou');
    t.includes(await card(), 'nada do que você fez aqui se perde', 'a seção explica e oferece Entrar de novo');
    await shot('4-expirou');
    await click('Entrar de novo');
    await click('Continuar');
    await until(async () => ((await card()).includes('servidor de memória encontrado') || (await card()).includes('token pessoal') ? card() : null));
    if (kc) {
      // SSO pelo navegador: o "navegador" faz o login no Keycloak e entrega o código ao app
      require('electron').shell.openExternal = (u) => browserLogin(u, { user: 'dev.teste', password: 'bo-teste-123', stopHost: /port=(\d+)/.exec(u) && `127.0.0.1:${/port=(\d+)/.exec(u)[1]}` });
      await click('Entrar com Keycloak');
      t.includes(await until(async () => ((await card()).includes('dev.teste@exemplo.com') ? card() : null), 30000), 'dev.teste@exemplo.com', 'SSO pelo navegador: conectado como o usuário do Keycloak');
    } else {
      await type('token', srv.tokenB);
      await click('Entrar');
      await until(async () => ((await card()).includes('Bruno') ? card() : null));
      t.check(true, '(SSO pulado: Keycloak de teste fora do ar — docker compose --profile sso up -d keycloak)');
    }
    t.equal(await syncNow(), 'ok', 'depois de entrar de novo, volta a sincronizar');

    // 6. Offline: o servidor cai; o app continua e mostra a fila.
    srv.stop();
    const a = await t.mcp('a1');
    await a.tool('record_decision', { text: 'Usamos filas porque o processamento é assíncrono.' });
    t.equal(await syncNow(), 'offline', 'servidor fora do ar vira estado "offline"');
    t.equal(await until(async () => ((await indicator()).includes('na fila') ? indicator() : null)), 'Offline · 1 na fila', 'o indicador mostra Offline e quantas mudanças esperam');
    await shot('5-offline');

    // 7. Desconectar: volta a Local e nada se perde.
    await click('Desconectar');
    await until(t.modal.open);
    t.includes(await t.modal.text(), 'continuam nesta máquina', 'a confirmação explica que os dados ficam');
    await t.modal.submit();
    t.equal(await until(async () => ((await indicator()) === 'Local' ? indicator() : null)), 'Local', 'desconectado: Local');
    t.equal((await a.tool('list_decisions')).data?.length, 1, 'a decisão continua na memória local');
  } finally {
    srv.stop();
  }
});
