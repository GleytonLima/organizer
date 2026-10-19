// AWS do projeto: perfis da máquina (só nomes), a conta do perfil na barra de status, AWS_PROFILE e região
// nos terminais do projeto, sessão SSO vencida → "Entrar" (aws sso login num terminal), produção marcada
// (e os pedidos de permissão do agente também). A AWS CLI é falsa (test/fixtures/fake-aws.js).
const fs = require('fs');
const path = require('path');
const { suite, seed } = require('./harness');

const dir = process.env.BO_TEST_DIR;
const awsDir = path.join(dir, 'aws');
fs.mkdirSync(awsDir, { recursive: true });
fs.writeFileSync(path.join(awsDir, 'config'), '[default]\nregion = us-east-1\n\n[profile dev]\nregion = sa-east-1\n\n[profile prod-sso]\nsso_start_url = https://exemplo.awsapps.com/start\nsso_region = us-east-1\n');
fs.writeFileSync(path.join(awsDir, 'credentials'), '[default]\naws_access_key_id = FAKE\naws_secret_access_key = FAKE\n');
process.env.AWS_CONFIG_FILE = path.join(awsDir, 'config');
process.env.AWS_SHARED_CREDENTIALS_FILE = path.join(awsDir, 'credentials');
process.env.BO_AWS_BIN = JSON.stringify(['node', path.join(__dirname, 'fixtures', 'fake-aws.js')]);

suite('cloud', {
  seed: (d) => {
    const [app] = seed.makeFolders(d, ['loja'], { git: false });
    return seed.state([seed.project('p1', 'Loja', [app], [seed.group('g1', 'Terminais', [seed.term('t1', 'shell', app)])])]);
  },
}, async (t) => {
  const C = { C: './js/actions/project-cloud.js', A: './js/actions/agent-tasks.js' };
  const pill = () => t.js(`return document.querySelector('.aws-indicator')?.innerText || ''`);
  const shows = (part) => t.waitFor(async () => ((await pill()).includes(part) ? pill() : null), { timeout: 10000 });
  const shot = async (name) => process.env.BO_TEST_SHOTS && (await t.wait(400), fs.writeFileSync(path.join(process.env.BO_TEST_SHOTS, `${name}.png`), (await t.wc.capturePage()).toPNG()));
  const setAws = (aws) => t.js(`C.setProjectAws(S.store.state.projects[0], ${JSON.stringify(aws)})`, C);

  const { cli, profiles } = await t.js(`return api.cloud.awsProfiles()`);
  t.equal([cli, profiles], [true, ['default', 'dev', 'prod-sso']], 'lista os perfis da máquina (config + credentials, só os nomes)');
  t.equal(await pill(), '', 'projeto sem AWS: nada na barra de status');

  await setAws({ profile: 'dev', region: 'sa-east-1' });
  t.check(await shows('AWS dev · 111122223333'), 'a barra mostra o perfil e a conta', await pill());

  // Terminal novo do projeto nasce com o perfil e a região.
  await t.js(`T.newTerminal(S.store.state.projects[0].groups[0], { name: 'aws' })`);
  const id = await t.js(`return S.store.state.activeId`);
  t.check(await t.shellReady(id), 'terminal novo pronto');
  await t.type(id, 'echo "P=$AWS_PROFILE R=$AWS_REGION"');
  t.check(await t.waitFor(async () => (await t.lines(id, 30)).includes('P=dev R=sa-east-1')), 'terminal novo recebe AWS_PROFILE e AWS_REGION do projeto', await t.lines(id, 10));

  // Sessão SSO vencida: "Entrar" abre o aws sso login num terminal.
  await setAws({ profile: 'prod-sso' });
  t.check(await shows('sessão expirou · Entrar'), 'sessão SSO vencida aparece na barra', await pill());
  await t.js(`document.querySelector('.aws-indicator').click()`);
  t.check(await t.waitFor(async () => (await t.js(`return S.activeEntry()?.t.startup || ''`)) === 'aws sso login --profile prod-sso'), 'Entrar abre um terminal com aws sso login do perfil');

  // Produção: em destaque discreto, e o pedido de permissão do agente vem marcado.
  await setAws({ profile: 'dev', prod: true });
  t.check(await shows('produção · AWS dev'), 'produção aparece na barra', await pill());
  await shot('aws-prod');
  if (process.env.BO_TEST_SHOTS) {
    await t.js(`const U = await import('./js/ui/cloud/aws.js'); U.awsDialog(S.store.state.projects[0]); return true`);
    await t.waitFor(() => t.modal.open());
    await shot('aws-dialog');
    await t.modal.cancel();
  }
  const agent = await t.mcp('t1');
  await agent.tool('create_task', { title: 'Limpar buckets antigos' });
  const question = await t.js(`A.onPermission('t1', { title: 'Bash: aws s3 rb s3://antigo --force', requestId: 'r1', options: [{ optionId: 'ok', name: 'Permitir', kind: 'allow_once' }] });
    return S.store.state.tasks.find((x) => x.terminalId === 't1')?.needsInput?.question`, C);
  t.includes(question || '', '[produção · AWS dev]', 'pedido de permissão do agente em projeto de produção vem marcado');

  // O que vem do renderer vira ambiente de processo: perfil inválido é recusado.
  const bad = await t.js(`try { await api.cloud.awsIdentity('dev; rm -rf /'); return 'aceitou'; } catch (e) { return e.message; }`);
  t.includes(bad, 'Perfil AWS inválido', 'perfil com caracteres estranhos é recusado');
});
