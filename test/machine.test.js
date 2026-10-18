// Trocar de máquina: a definição do projeto (pastas pelo remote, colunas) sobe para o workspace e o
// layout (grupos, terminais) para o seu usuário; Bruno muda o projeto do time e a mudança chega;
// numa "máquina nova" (o projeto some daqui), "Abrir projeto do servidor" clona as pastas e
// recria colunas e terminais — os comandos iniciais só com confirmação.
// Os "remotes" são repositórios bare locais: o clone funciona sem rede.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { suite, seed } = require('./harness');
const { startMemoryServer } = require('./lib/memory-server');
const { normalizeRemote } = require('../src/main/sync/remote');

process.env.BO_SYNC_INTERVAL_MS = '600000'; // só as rodadas que o teste pede
const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@x', ...args], { cwd, stdio: 'pipe' });

/** Repositório bare em origin/<nome>.git com um commit (pasta src/) e o clone em maquina-a/<nome>. */
function repo(dir, name) {
  const bare = path.join(dir, 'origin', `${name}.git`);
  fs.mkdirSync(bare, { recursive: true });
  git(bare, 'init', '-q', '--bare', '-b', 'main');
  const work = path.join(dir, 'maquina-a', name);
  git(dir, 'clone', '-q', bare, work);
  fs.mkdirSync(path.join(work, 'src'));
  fs.writeFileSync(path.join(work, 'src', 'README.md'), name);
  git(work, 'add', '.');
  git(work, 'commit', '-q', '-m', 'inicio');
  git(work, 'push', '-q', 'origin', 'HEAD:main');
  return work;
}

suite('trocar de máquina', {
  seed: (dir) => {
    const [backend, front] = [repo(dir, 'backend'), repo(dir, 'front')];
    const p = seed.project('pA', 'App', [backend, front], [
      seed.group('gA', 'Serviços', [seed.term('api', 'api', path.join(backend, 'src'), 'echo api-no-ar'), seed.term('web', 'web', front)]),
    ]);
    p.syncKey = 'app';
    p.taskColumns = [{ id: 'k1', name: 'Backlog', description: '' }, { id: 'k2', name: 'Pronto', description: '' }];
    return seed.state([p]);
  },
}, async (t) => {
  const srv = await startMemoryServer();
  if (srv.skip) return t.check(true, `(pulado: ${srv.skip})`);
  process.env.BO_SYNC_URL = srv.url;
  process.env.BO_SYNC_TOKEN = srv.tokenA;
  const ana = srv.as(srv.tokenA);
  const bruno = srv.as(srv.tokenB);
  const sync = () => t.js(`return await api.sync.now()`);
  const remote = (name) => normalizeRemote(path.join(t.dir, 'origin', `${name}.git`));
  try {
    // 1. Ana: o projeto e o layout sobem.
    t.equal((await sync()).state, 'ok', 'sync sem erro');
    const doc = (await ana('GET', '/v1/workspaces/app/project')).data;
    t.equal(doc?.folders?.map((f) => f.remote), [remote('backend'), remote('front')], 'pastas sobem pelo remote');
    t.equal(doc?.columns?.map((c) => c.name), ['Backlog', 'Pronto'], 'colunas do quadro sobem');
    const layout = (await ana('GET', '/v1/workspaces/app/layout')).data;
    const api = layout?.groups?.[0]?.terminals?.[0];
    t.equal([api?.folder, api?.subdir, api?.startup], [remote('backend'), 'src', 'echo api-no-ar'], 'terminal sobe pela pasta + subpasta, com o comando inicial');
    t.equal((await bruno('GET', '/v1/workspaces/app/layout')).status, 404, 'o layout é só da Ana');

    // 2. Bruno muda o projeto do time: coluna nova e uma pasta que a Ana não tem clonada.
    const put = await bruno('PUT', '/v1/workspaces/app/project', {
      ...doc,
      baseVersion: doc.version,
      folders: [...doc.folders, { name: 'docs', remote: 'github.com/time/docs', url: '' }],
      columns: [doc.columns[0], { id: 'k3', name: 'Em revisão', description: '' }, doc.columns[1]],
    });
    t.equal(put.status, 200, 'Bruno grava o projeto');
    await sync();
    const cols = await t.js(`return S.store.state.projects[0].taskColumns.map((c) => c.name)`);
    t.equal(cols, ['Backlog', 'Em revisão', 'Pronto'], 'coluna do Bruno chega (aqui ninguém mexeu nas colunas)');
    await sync();
    const after = (await ana('GET', '/v1/workspaces/app/project')).data;
    t.check(after?.folders?.some((f) => f.remote === 'github.com/time/docs'), 'a pasta que a Ana não tem continua no projeto do time', JSON.stringify(after?.folders));

    // 3. "Máquina nova": o projeto some daqui; abrir do servidor clona e recria.
    await t.js(`for (const t of S.store.state.projects[0].groups.flatMap((g) => g.terminals)) T.removeTerminal(t.id);
      S.store.state.projects = S.store.state.projects.filter((p) => p.id !== 'pA'); S.commit();`);
    const baseB = path.join(t.dir, 'maquina-b');
    fs.mkdirSync(baseB);
    t.js(`window.__imp = (await import('./js/actions/project-remote.js')).importRemoteProject('app', ${JSON.stringify(baseB)})`);
    t.check(await t.waitFor(t.modal.open), 'abrir do servidor mostra a revisão');
    const review = await t.modal.text();
    t.includes(review, `será clonada em ${path.join(baseB, 'backend')}`, 'revisão diz onde cada pasta será clonada');
    t.includes(review, 'comando inicial: echo api-no-ar', 'revisão mostra os comandos iniciais antes de criar');
    t.includes(review, 'não encontrada', 'pasta sem URL de clone aparece como não encontrada');
    t.equal(await t.js(`return document.querySelector('#modal select').value`), 'no', 'por padrão, os terminais vêm sem os comandos iniciais');
    await t.js(`const s = document.querySelector('#modal select'); s.value = 'yes'; s.dispatchEvent(new Event('change'))`);
    await t.modal.submit();
    const made = await t.waitFor(() => t.js(`const p = await window.__imp; return p && { name: p.name, key: p.syncKey, repos: p.repos.map((r) => r.path), cols: p.taskColumns.map((c) => c.name), terms: p.groups.flatMap((g) => g.terminals.map((x) => [g.name, x.name, x.cwd, x.startup])) }`), { timeout: 60000 });
    t.equal([made?.name, made?.key], ['App', 'app'], 'projeto recriado com a chave de sincronização');
    t.equal(made?.repos, [path.join(baseB, 'backend'), path.join(baseB, 'front')], 'pastas clonadas na pasta de clones');
    t.check(fs.existsSync(path.join(baseB, 'backend', 'src', 'README.md')), 'o clone tem o conteúdo do remote');
    t.equal(made?.cols, ['Backlog', 'Em revisão', 'Pronto'], 'colunas do time');
    t.equal(made?.terms?.[0], ['Serviços', 'api', path.join(baseB, 'backend', 'src'), 'echo api-no-ar'], 'terminal na pasta clonada + subpasta, com o comando confirmado');
  } finally {
    srv.stop();
  }
});
