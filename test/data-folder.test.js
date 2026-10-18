// Troca de nome (Bash Organizer → Brain Organizer): a pasta de dados antiga migra sozinha, com tudo
// dentro; presa por outro processo (a versão antiga aberta), fica onde está e tenta na próxima vez.
const fs = require('fs');
const path = require('path');
const { suite, seed } = require('./harness');
const { dataFolder, CURRENT, LEGACY } = require('../src/main/data-folder');

suite('pasta de dados (troca de nome)', {
  seed: (dir) => {
    const [work] = seed.makeFolders(dir, ['work'], { git: false });
    return seed.state([seed.project('p1', 'P', [work], [seed.group('g1', 'T', [seed.term('t1', 't1', work)])])]);
  },
}, async (t) => {
  const appData = (name) => {
    const d = path.join(t.dir, name);
    fs.mkdirSync(d, { recursive: true });
    return d;
  };
  const write = (dir, file, text) => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, file), text);
  };

  // pasta antiga com dados, nova inexistente → renomeia, com tudo dentro
  const a = appData('a');
  write(path.join(a, LEGACY), 'state.json', '{"projects":["meu"]}');
  write(path.join(a, LEGACY), 'memory.db', 'SQLite');
  const r1 = dataFolder(a, '');
  t.equal([r1.dir, r1.migrated], [path.join(a, CURRENT), true], 'pasta antiga vira a nova');
  t.equal(fs.readFileSync(path.join(a, CURRENT, 'state.json'), 'utf8'), '{"projects":["meu"]}', 'o state.json chega intacto');
  t.check(fs.existsSync(path.join(a, CURRENT, 'memory.db')) && !fs.existsSync(path.join(a, LEGACY)), 'memória junto; a pasta antiga some');
  t.equal(dataFolder(a, '').migrated, false, 'na abertura seguinte não há nada a migrar');

  // instalação nova: nenhuma pasta → usa a nova
  const b = appData('b');
  t.equal(dataFolder(b, '').dir, path.join(b, CURRENT), 'instalação nova usa a pasta nova');

  // as duas existem (ex.: alguém já abriu a versão nova) → não mexe em nenhuma
  const c = appData('c');
  write(path.join(c, LEGACY), 'state.json', 'antigo');
  write(path.join(c, CURRENT), 'state.json', 'novo');
  t.equal(dataFolder(c, '').dir, path.join(c, CURRENT), 'com as duas, vale a nova');
  t.equal(fs.readFileSync(path.join(c, LEGACY, 'state.json'), 'utf8'), 'antigo', 'a antiga fica intocada');

  // pasta antiga presa (versão antiga aberta): usa a antiga nesta vez, sem perder nada
  const d = appData('d');
  write(path.join(d, LEGACY), 'state.json', 'em uso');
  const locked = { ...fs, renameSync: () => { throw Object.assign(new Error('EBUSY'), { code: 'EBUSY' }); } };
  const r2 = dataFolder(d, '', locked);
  t.equal([r2.dir, r2.migrated], [path.join(d, LEGACY), false], 'presa: usa a pasta antiga nesta abertura');
  t.equal(dataFolder(d, '').migrated, true, 'liberada: migra na abertura seguinte');

  // BO_USER_DATA passa por cima de tudo
  t.equal(dataFolder(d, 'X:\perfil').dir, 'X:\perfil', 'BO_USER_DATA tem precedência');
  t.equal(await t.js(`return document.title`), 'Brain Organizer', 'a janela já se chama Brain Organizer');
});
