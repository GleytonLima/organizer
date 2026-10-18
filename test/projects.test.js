// Projetos: pastas explícitas (numa pasta de clones compartilhada), open_terminal por repo,
// create_project idempotente pelo nome e projeto deduzido pela pasta do cliente (fromCwd).
const fs = require('fs');
const path = require('path');
const { suite, seed } = require('./harness');

/** Pasta com playwright.config.js e um `playwright` falso em node_modules/.bin (o npx usa o local). */
function playwrightFolder(dir) {
  const [folder] = seed.makeFolders(dir, ['e2e-app'], { git: false });
  const fake = path.join(__dirname, 'fixtures', 'fake-playwright.js').replace(/\\/g, '/');
  fs.writeFileSync(path.join(folder, 'playwright.config.js'), 'module.exports = {};\n');
  fs.writeFileSync(path.join(folder, 'package.json'), '{"name":"e2e-app","version":"1.0.0"}\n');
  const bin = path.join(folder, 'node_modules', '.bin');
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, 'playwright'), `#!/bin/sh\nexec node "${fake}" "$@"\n`, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'playwright.cmd'), `@node "${fake}" %*\r\n`);
  return folder;
}

// "Abrir no VS Code" usa um editor falso que registra a pasta (BO_EDITOR, como BO_ACP_AGENT)
const EDITOR_LOG = path.join(process.env.BO_TEST_DIR || require('os').tmpdir(), 'editor.log');
process.env.BO_EDITOR = JSON.stringify([process.execPath, path.join(__dirname, 'fixtures', 'fake-editor.js')]);
process.env.FAKE_EDITOR_LOG = EDITOR_LOG;

const norm = (p) => String(p || '').replace(/\//g, '\\').toLowerCase();

suite('projetos', {
  seed: (dir) => {
    const shared = path.join(dir, 'repos');
    seed.makeFolders(shared, ['devtools'], { git: false });
    seed.makeFolders(shared, ['contrato-api', 'backend', 'infra', 'outro-backend', 'lib-legada'], { branches: { backend: 'feat/login' } });
    fs.mkdirSync(path.join(shared, 'backend', 'src'));
    const R = (...names) => names.map((n) => path.join(shared, n));
    return seed.state([
      seed.project('p1', 'minha-app', R('devtools', 'contrato-api', 'backend', 'infra'), [
        seed.group('g1', 'Agente', [seed.term('dev1', 'devtools', path.join(shared, 'devtools'))]),
      ]),
      seed.project('p2', 'outro-app', R('outro-backend'), [seed.group('g2', 'Terminais', [seed.term('o1', 'outro', path.join(shared, 'outro-backend'))])]),
      seed.project('p3', 'e2e', [playwrightFolder(dir)], [seed.group('g3', 'Terminais', [])]),
    ]);
  },
}, async (t) => {
  const shared = path.join(t.dir, 'repos');
  t.check(await t.shellReady('dev1'), 'terminal do agente pronto');
  const agent = await t.mcp('dev1');

  const list = (await agent.tool('list_terminals')).data;
  const mine = list?.projects.find((p) => p.name === 'minha-app');
  t.equal(mine?.repos.map((r) => r.name), ['devtools', 'contrato-api', 'backend', 'infra'], 'projeto lista só as pastas escolhidas');
  t.equal(list?.caller, 'dev1', 'list_terminals identifica o terminal que pediu');

  // open_terminal pelo nome do repo: pasta certa, grupo criado se não existir.
  const infra = await agent.tool('open_terminal', { name: 'infra', repo: 'infra', group: 'Serviços' });
  t.equal(norm(infra.data?.cwd), norm(path.join(shared, 'infra')), 'open_terminal repo=infra abre na pasta do repo');
  t.equal([infra.data?.project, infra.data?.group], ['minha-app', 'Serviços'], 'terminal novo entra no projeto do agente, no grupo pedido');
  const missing = await agent.tool('open_terminal', { repo: 'lib-legada' });
  t.check(!missing.ok, 'repo fora do projeto é recusado (mesmo existindo na pasta compartilhada)', JSON.stringify(missing));
  const sub = await agent.tool('open_terminal', { name: 'sub', repo: 'backend', cwd: 'src' });
  t.equal(norm(sub.data?.cwd), norm(path.join(shared, 'backend', 'src')), 'cwd relativo é resolvido a partir do repo');

  // create_project: cria e, repetido pelo nome (qualquer caixa), reaproveita e só soma pastas.
  const lib = path.join(shared, 'lib-legada');
  const c1 = await agent.tool('create_project', { name: 'Legado', repos: [lib] });
  t.equal(c1.data?.repos.map((r) => r.name), ['lib-legada'], 'create_project cria com as pastas');
  const c2 = await agent.tool('create_project', { name: 'legado', repos: [lib, path.join(shared, 'infra')] });
  t.equal(c2.data?.id, c1.data?.id, 'create_project repetido devolve o mesmo projeto');
  t.equal(c2.data?.repos.map((r) => r.name), ['lib-legada', 'infra'], 'pastas que faltavam são acrescentadas, sem duplicar');
  const count = await t.js(`return S.store.state.projects.filter((p) => p.name.toLowerCase() === 'legado').length`);
  t.equal(count, 1, 'não há projeto duplicado no estado');
  const empty = await agent.tool('create_project', { name: '  ' });
  t.check(!empty.ok, 'nome vazio é recusado', JSON.stringify(empty));

  // fromCwd: cliente fora de um terminal do app, rodando dentro da pasta de outro projeto.
  const outro = path.join(shared, 'outro-backend');
  const loose = await t.mcp('', { cwd: path.join(outro) });
  const task = await loose.tool('create_task', { title: 'Tarefa deduzida pela pasta' });
  t.equal(task.data?.project, 'outro-app', 'MCP sem terminal deduz o projeto pela pasta');
  const cli = await t.bo(['task', 'add', 'Outra pelo bo'], { cwd: outro });
  t.check(cli.code === 0, '`bo task add` fora do app funciona', cli.stderr);
  const projectsOf = await t.js(`return S.store.state.tasks.map((x) => S.store.state.projects.find((p) => p.id === x.projectId).name)`);
  t.equal(projectsOf, ['outro-app', 'outro-app'], 'as duas tarefas caem no projeto da pasta');
  const viaTerminal = await agent.tool('create_task', { title: 'Do agente' });
  t.equal(viaTerminal.data?.project, 'minha-app', 'com terminal, o projeto do terminal vence a pasta');

  // Projeto em foco: clicar no cabeçalho foca; a seta só recolhe/expande.
  const heads = () => t.js(`return [...document.querySelectorAll('#sidebar .project-head')].map((h) => h.innerText.trim())`);
  const idx = (await heads()).findIndex((x) => x.includes('outro-app'));
  await t.js(`document.querySelectorAll('#sidebar .project-head')[${idx}].click()`);
  t.equal(await t.js(`return S.store.state.focusProjectId`), 'p2', 'clicar no cabeçalho do projeto o coloca em foco');
  await t.js(`document.querySelectorAll('#sidebar .project-head')[${idx}].querySelector('.chevron-btn').click()`);
  const after = await t.js(`const p = S.store.state.projects.find((x) => x.id === 'p2'); return [p.collapsed, S.store.state.focusProjectId]`);
  t.equal(after, [true, 'p2'], 'a seta recolhe o projeto sem mudar o foco');

  // "Abrir no VS Code" pelo menu do chip de repositório
  await t.js(`S.store.state.focusProjectId = 'p1'; S.commit()`);
  const chip = await t.waitFor(async () => {
    const i = await t.js(`return [...document.querySelectorAll('.repo-chip')].findIndex((c) => /[\\\\/]backend$/.test(c.title))`);
    return i >= 0 ? i + 1 : null; // +1: índice 0 também conta como achado
  });
  await t.js(`document.querySelectorAll('.repo-chip')[${chip - 1}].click()`);
  await t.js(`[...document.querySelectorAll('.menu-item')].find((b) => b.textContent.includes('Abrir no VS Code')).click()`);
  const lastOpen = () => fs.existsSync(EDITOR_LOG) && JSON.parse(fs.readFileSync(EDITOR_LOG, 'utf8').trim().split('\n').at(-1));
  const opened = await t.waitFor(lastOpen);
  t.equal(norm(opened?.args?.[0]), norm(path.join(shared, 'backend')), '"Abrir no VS Code" passa a pasta do repositório ao editor');
  await t.js(`(await import('./js/ui/editor.js')).openInEditor(${JSON.stringify(path.join(shared, 'nao-existe'))})`);
  t.check(await t.waitFor(async () => (await t.modal.open()) && (await t.modal.text()).includes('Não foi possível abrir no VS Code')), 'pasta inexistente (ou editor fora do PATH) explica o problema');
  await t.modal.submit();

  // testes Playwright da pasta: o chip oferece rodar; falha vira tarefa (uma só), sucesso vira aviso
  await t.js(`S.store.state.focusProjectId = 'p3'; S.commit()`);
  await t.js(`document.querySelector('.repo-chip').click()`);
  const pwItem = await t.waitFor(async () => {
    await t.js(`document.querySelector('.repo-chip').click()`); // a detecção chega depois do 1º render
    return t.js(`return [...document.querySelectorAll('.menu-item')].find((b) => b.textContent.includes('Rodar testes Playwright'))?.textContent || null`);
  });
  t.includes(pwItem || '', 'playwright.config.js', 'pasta com playwright.config.* oferece "Rodar testes Playwright" no chip');
  await t.js(`[...document.querySelectorAll('.menu-item')].find((b) => b.textContent.includes('Rodar testes Playwright')).click()`);
  const runner = await t.waitFor(() => t.js(`return S.store.state.projects.find((p) => p.id === 'p3').groups[0].terminals.find((x) => x.name === 'Playwright · e2e-app')?.id || null`));
  t.check(runner, 'roda num terminal próprio "Playwright · e2e-app"');
  const pwTasks = () => t.js(`return S.store.state.tasks.filter((k) => k.title === 'Testes Playwright falhando em e2e-app').map((k) => ({ tags: k.tags, desc: k.description, reports: k.history.filter((h) => h.type === 'report').length }))`);
  const failed = await t.waitFor(async () => ((await pwTasks()).length ? pwTasks() : null), { timeout: 60000 });
  t.equal(failed?.[0]?.tags, ['playwright'], 'falha cria a tarefa com a tag #playwright');
  t.check(/1 failed/.test(failed?.[0]?.desc) && /login\.spec\.ts/.test(failed?.[0]?.desc), 'a tarefa traz as contagens e o teste que falhou', failed?.[0]?.desc);
  await t.type(runner, 'npx playwright test');
  const again = await t.waitFor(async () => { const k = await pwTasks(); return k.length === 1 && k[0].reports >= 1 && k; }, { timeout: 60000 });
  t.check(again, 'falha de novo acrescenta um relato à mesma tarefa (não cria outra)', JSON.stringify(await pwTasks()));
  // olhando outro terminal (vendo o do Playwright, o app não avisa: você já está vendo o resultado)
  await t.js(`(await import('./js/notify/center.js')).clearNotifications(); (await import('./js/actions/terminals.js')).activate('dev1')`);
  await t.type(runner, 'FAKE_PW_EXIT=0 npx playwright test');
  const passed = await t.waitFor(() => t.js(`return (await import('./js/notify/center.js')).recentNotifications().find((n) => n.body.includes('passou'))?.body || null`), { timeout: 60000 });
  t.includes(passed || '', '3 passed', 'sucesso vira aviso com as contagens');

  // segurança: o que persiste execução ou muda para onde vão as memórias passa pelo usuário
  const asked = await agent.tool('open_terminal', { name: 'svc', repo: 'infra', startup: 'echo SUBIU' });
  t.check(asked.ok && asked.data?.startupPending, 'open_terminal com startup fica pendente do OK do usuário', JSON.stringify(asked));
  t.includes(await t.waitFor(async () => (await t.modal.open()) && t.modal.text()), 'echo SUBIU', 'o app mostra o comando e pede permissão');
  t.equal(await t.js(`return S.store.state.projects[0].groups.flatMap((g) => g.terminals).find((x) => x.name === 'svc').startup`), '', 'antes do OK nada fica salvo');
  await t.modal.submit();
  t.equal(await t.waitFor(() => t.js(`return S.store.state.projects[0].groups.flatMap((g) => g.terminals).find((x) => x.name === 'svc').startup || null`)), 'echo SUBIU', 'com o OK o comando inicial é salvo');
  await agent.tool('create_project', { name: 'minha-app', syncKey: 'app-a' });
  const moved = await agent.tool('create_project', { name: 'minha-app', syncKey: 'outro-time' });
  t.check(!moved.ok && /só muda pela interface/.test(moved.error || ''), 'a API não troca a chave de sincronização de um projeto que já tem', moved.error);

  // token por terminal: identidade vem do token; agir em outro terminal ou apagar memória pede o seu OK
  const { terminalToken } = require('../src/main/api/server');
  const call = (token, method, body) =>
    fetch(`${t.api.url}/v1/${method}`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.status);
  t.equal(await call(terminalToken('dev1').replace(/.$/, (c) => (c === '0' ? '1' : '0')), 'list', {}), 401, 'token de terminal forjado (assinatura errada) é recusado');
  t.equal(await call(terminalToken('dev1'), 'list', {}), 200, 'token do terminal vale na API');
  const asDev = await t.mcp('o1', { token: terminalToken('dev1') }); // diz ser o "o1", mas o token é do dev1
  const status = (await asDev.tool('terminal_status', {})).data;
  t.equal(status?.id, 'dev1', 'quem chama é o terminal do token (o "from" do pedido é ignorado)');
  const typed = asDev.tool('send_input', { terminal: 'o1', text: 'echo DE-OUTRO' });
  t.includes(await t.waitFor(async () => (await t.modal.open()) && t.modal.text()), 'echo DE-OUTRO', 'digitar em outro terminal pede o seu OK (e mostra o texto)');
  await t.modal.cancel();
  const refused = await typed;
  t.check(!refused.ok && /não permitiu/.test(refused.error || ''), 'recusado, o agente recebe o erro', JSON.stringify(refused));
  const allowed = asDev.tool('send_input', { terminal: 'o1', text: 'echo PERMITIDO' });
  await t.waitFor(() => t.modal.open());
  await t.js(`[...document.querySelectorAll('#modal button')].find((b) => b.textContent === 'Sempre deste terminal').click()`);
  t.check((await allowed).ok, '"Sempre deste terminal" libera o pedido');
  t.check((await asDev.tool('send_input', { terminal: 'o1', text: 'echo DE-NOVO' })).ok && !(await t.modal.open()), 'e não pergunta de novo para o mesmo par');
  const ownTerm = (await asDev.tool('open_terminal', { name: 'meu', repo: 'infra' })).data;
  t.check((await asDev.tool('send_input', { terminal: ownTerm?.id || 'meu', text: 'echo MEU' })).ok && !(await t.modal.open()), 'no terminal que ele mesmo abriu, digita sem pedir');
  const note = await agent.tool('remember_note', { text: 'Nota que um agente quer apagar' });
  const forgetting = asDev.tool('forget_memory', { id: note.data?.id });
  t.includes(await t.waitFor(async () => (await t.modal.open()) && t.modal.text()), 'Nota que um agente quer apagar', 'apagar memória pedido por um terminal pede o seu OK');
  await t.modal.cancel();
  t.check(!(await forgetting).ok, 'recusado, a memória continua');
});
