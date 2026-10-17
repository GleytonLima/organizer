// Memória do projeto: decisões em uma frase (validação), notas, busca sem acento, substituição
// e persistência. Roda duas vezes na mesma pasta de dados: a 2ª execução reabre o app e confere.
const path = require('path');
const { suite, seed } = require('./harness');

const POSTGRES = 'Usamos Postgres porque o time já domina e precisamos de transações.';
const AURORA = 'Usamos Aurora Postgres porque precisamos de failover gerenciado na AWS.';
const OPENAPI = 'Contrato da API fica em OpenAPI no repo contrato-api porque o gateway importa direto.';
const NOTE = 'Para subir o backend local:\nnpm ci && npm run dev (porta 8080)';

suite('memória', {
  seed: (dir) => {
    const folders = seed.makeFolders(path.join(dir, 'repos'), ['backend', 'contrato-api']);
    return seed.state([seed.project('p1', 'minha-app', folders, [seed.group('g1', 'Serviços', [seed.term('be', 'backend', folders[0])])])]);
  },
}, async (t) => {
  const agent = await t.mcp('be');
  if (t.run === 1) await firstRun(t, agent);
  else await reopened(t, agent);
});

async function firstRun(t, agent) {
  const d1 = await agent.tool('record_decision', { text: POSTGRES, tags: 'banco' });
  t.check(d1.ok && d1.data.id, 'decisão válida é registrada', d1.error);
  t.equal(d1.data?.repo, 'backend', 'repo padrão vem da pasta do terminal');

  const max = await agent.tool('record_decision', { text: 'x'.repeat(279) + '.' });
  t.check(max.ok, 'decisão com exatamente 280 caracteres é aceita', max.error);
  if (max.ok) await agent.tool('forget_memory', { id: max.data.id });
  const long = await agent.tool('record_decision', { text: 'x'.repeat(281) });
  t.check(!long.ok && /280/.test(long.error), 'decisão com 281 caracteres é recusada', long.error);
  const multi = await agent.tool('record_decision', { text: 'linha 1\nlinha 2' });
  t.check(!multi.ok && /quebras de linha/.test(multi.error), 'decisão com quebra de linha é recusada', multi.error);

  const note = await agent.tool('remember_note', { text: NOTE, tags: 'setup' });
  t.check(note.ok, 'nota com várias linhas é aceita', note.error);
  await agent.tool('record_decision', { text: OPENAPI, repo: 'contrato-api' });

  const plain = await agent.tool('search_memory', { query: 'transacoes' });
  t.check(plain.data?.items?.some((i) => i.text === POSTGRES), 'busca sem acento encontra "transações"', JSON.stringify(plain.data));
  const accent = await agent.tool('search_memory', { query: 'GATEWAY' });
  t.equal(accent.data?.items?.map((i) => i.repo), ['contrato-api'], 'busca ignora maiúsculas e traz o repo');
  const notes = await agent.tool('search_memory', { query: 'backend', kind: 'note' });
  t.check(notes.data?.items?.length === 1 && notes.data.items[0].kind === 'note', 'filtro por tipo (nota)', JSON.stringify(notes.data));

  const d2 = await agent.tool('record_decision', { text: AURORA, supersedes: d1.data?.id, tags: 'banco' });
  t.check(d2.ok, 'decisão substituta é registrada', d2.error);
  const current = (await agent.tool('list_decisions')).data?.map((d) => d.text) || [];
  t.check(current.includes(AURORA) && !current.includes(POSTGRES), 'list_decisions mostra só as vigentes', JSON.stringify(current));
  const bad = await agent.tool('record_decision', { text: 'Outra decisão porque sim.', supersedes: 'nao-existe' });
  t.check(!bad.ok && /não encontrada/.test(bad.error), 'substituir id inexistente dá erro', bad.error);
  const after = (await agent.tool('list_decisions')).data?.map((d) => d.text) || [];
  t.check(!after.includes('Outra decisão porque sim.'), 'decisão recusada não fica gravada', JSON.stringify(after));

  const cli = await t.bo(['mem', 'decisions'], { terminal: 'be' });
  t.check(cli.code === 0 && cli.stdout.includes('Aurora') && !cli.stdout.includes('time já domina'), '`bo mem decisions` lista as vigentes', cli.stderr || cli.stdout);
}

async function reopened(t, agent) {
  const current = (await agent.tool('list_decisions')).data?.map((d) => d.text) || [];
  t.equal(current.sort(), [AURORA, OPENAPI].sort(), 'decisões vigentes sobrevivem ao reabrir o app');
  const notes = await agent.tool('search_memory', { query: 'porta 8080', kind: 'note' });
  t.equal(notes.data?.items?.map((i) => i.text), [NOTE], 'nota sobrevive ao reabrir, com as quebras de linha');
  const plain = await agent.tool('search_memory', { query: 'failover gerenciado' });
  t.check(plain.data?.items?.some((i) => i.text === AURORA), 'índice de busca continua funcionando após reabrir', JSON.stringify(plain.data));
}
