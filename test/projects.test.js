// Projetos: pastas explícitas (numa pasta de clones compartilhada), open_terminal por repo,
// create_project idempotente pelo nome e projeto deduzido pela pasta do cliente (fromCwd).
const fs = require('fs');
const path = require('path');
const { suite, seed } = require('./harness');

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
});
