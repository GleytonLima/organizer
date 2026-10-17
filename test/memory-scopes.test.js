// Escopos da memória: global (todos os projetos), projeto (só o próprio) e pasta (todo projeto
// que inclua a pasta). Parte de um memory.db v1 semeado para conferir a migração.
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { suite, seed } = require('./harness');

const OLD = 'Decisão antiga do projeto A porque veio da versão 1 do banco.';

/** memory.db no formato v1 com uma decisão do projeto A. */
function seedV1Db(ud) {
  const db = new DatabaseSync(path.join(ud, 'memory.db'));
  db.exec(fs.readFileSync(path.join(__dirname, 'fixtures', 'memory-v1.sql'), 'utf8'));
  db.prepare(`INSERT INTO memories (id, project_id, project, repo, kind, text, created_at, updated_at)
              VALUES ('old00001', 'pA', 'A', 'backend', 'decision', ?, 1, 1)`).run(OLD);
  db.close();
}

suite('memória: escopos', {
  seed: (dir) => {
    const R = (...names) => names.map((n) => path.join(dir, 'repos', n));
    seed.makeFolders(path.join(dir, 'repos'), ['backend', 'front-a', 'front-b', 'outro']);
    seedV1Db(path.join(dir, 'userdata'));
    const P = (id, name, folders, termId) =>
      seed.project(id, name, folders, [seed.group(`g${id}`, 'Terminais', [seed.term(termId, termId, folders[0])])]);
    return seed.state([
      P('pA', 'A', R('backend', 'front-a'), 'a1'),
      P('pB', 'B', R('front-b', 'backend'), 'b1'),
      P('pC', 'C', R('outro'), 'c1'),
    ]);
  },
}, async (t) => {
  const [a, b, c] = [await t.mcp('a1'), await t.mcp('b1'), await t.mcp('c1')];
  const texts = async (client, args = {}) => ((await client.tool('list_decisions', args)).data || []).map((d) => d.text);
  const noteTexts = async (client, query) => ((await client.tool('search_memory', { query, kind: 'note' })).data?.items || []).map((i) => i.text);

  // Migração v1 → v2: a linha antiga vira "project" e continua só no projeto A.
  const migrated = (await a.tool('list_decisions')).data?.find((d) => d.id === 'old00001');
  t.equal(migrated?.scope, 'project', 'decisão do memory.db v1 vira escopo "project"');
  t.check(!(await texts(b)).includes(OLD), 'decisão migrada não vaza para outro projeto');
  t.check(((await a.tool('search_memory', { query: 'versao banco' })).data?.items || []).some((i) => i.id === 'old00001'), 'busca encontra a decisão migrada');

  // Projeto: só no próprio.
  const proj = 'Usamos filas no projeto A porque o processamento é assíncrono.';
  t.equal((await a.tool('record_decision', { text: proj })).data?.scope, 'project', 'escopo padrão é "project"');
  t.check((await texts(a)).includes(proj) && !(await texts(b)).includes(proj), 'decisão de projeto aparece só no próprio projeto');

  // Global: em todos.
  const glob = 'Commits em português porque o time inteiro fala português.';
  const g = await c.tool('record_decision', { text: glob, scope: 'global' });
  t.equal([g.data?.scope, g.data?.folder ?? null], ['global', null], 'decisão global gravada sem pasta');
  t.check((await Promise.all([a, b, c].map((x) => texts(x)))).every((list) => list.includes(glob)), 'decisão global aparece em todos os projetos');

  // Pasta: em todo projeto que inclua a pasta (A e B dividem o backend), e não em C.
  const note = 'O backend sobe com npm run dev na porta 8080.';
  const n = await a.tool('remember_note', { text: note, scope: 'folder', folder: 'backend' });
  t.check(n.ok && n.data.scope === 'folder' && /backend$/i.test(n.data.folder || ''), 'nota de pasta guarda a pasta', JSON.stringify(n));
  t.check((await noteTexts(a, 'porta 8080')).includes(note), 'nota de pasta aparece no projeto que a gravou');
  t.check((await noteTexts(b, 'porta 8080')).includes(note), 'nota de pasta aparece em outro projeto com a mesma pasta');
  t.check(!(await noteTexts(c, 'porta 8080')).includes(note), 'nota de pasta não aparece em projeto sem a pasta');

  // Sem `folder`: usa a raiz git do terminal de quem pede (pode levar um instante para o git responder).
  const auto = await t.waitFor(async () => {
    const r = await b.tool('remember_note', { text: 'Front B usa Vite.', scope: 'folder' });
    return r.ok ? r : null;
  }, { timeout: 15000, every: 1000 });
  t.check(/front-b$/i.test(auto?.data?.folder || ''), 'pasta padrão = raiz git do terminal', JSON.stringify(auto));

  const loose = await t.mcp('', { cwd: t.dir });
  const err = await loose.tool('remember_note', { text: 'Sem pasta.', scope: 'folder', project: 'C' });
  t.check(!err.ok && /Informe "folder"/.test(err.error), 'memória de pasta sem pasta resolvível dá erro', JSON.stringify(err));

  // Filtro por escopo na leitura.
  const onlyGlobal = await texts(a, { scope: 'global' });
  t.equal(onlyGlobal, [glob], 'list_decisions com scope: "global" filtra');
  const folderItems = (await a.tool('search_memory', { query: '', scope: 'folder', limit: 50 })).data?.items || [];
  t.check(folderItems.length && folderItems.every((i) => i.scope === 'folder'), 'search_memory com scope: "folder" filtra', JSON.stringify(folderItems));

  // CLI: --global.
  const cli = await t.bo(['mem', 'decide', 'Usamos LF nos scripts bash porque o Git Bash quebra com CRLF.', '--global'], { terminal: 'a1' });
  t.check(cli.code === 0, '`bo mem decide --global` funciona', cli.stderr);
  t.check((await texts(c, { scope: 'global' })).some((x) => x.includes('LF nos scripts')), 'decisão global do CLI aparece em outro projeto');
});
