// Primeiros passos: o que falta nesta máquina, instalar com a saída na tela, entrar no Claude Code,
// conectá-lo ao app (MCP + hooks, sem estragar o settings.json) e o projeto a partir de uma pasta
// (repositórios e comandos detectados viram grupos e terminais). Claude Code e instaladores são falsos.
const fs = require('fs');
const path = require('path');
const { suite, seed } = require('./harness');

const dir = process.env.BO_TEST_DIR;
const claudeDir = path.join(dir, 'claude');
fs.mkdirSync(claudeDir, { recursive: true });
process.env.CLAUDE_CONFIG_DIR = claudeDir;
process.env.BO_CLAUDE_BIN = JSON.stringify(['node', path.join(__dirname, 'fixtures', 'fake-claude.js')]);
process.env.BO_SETUP_INSTALL = JSON.stringify({ git: ['node', '-e', "console.log('Baixando Git.Git'); console.log('Instalado com êxito')"] });
process.env.BO_ACP_AGENT = JSON.stringify([process.execPath, path.join(__dirname, 'fixtures', 'fake-acp-agent.js')]);
delete process.env.ANTHROPIC_API_KEY; // "entrou na conta" vem só do arquivo de credenciais falso

const SETTINGS = path.join(claudeDir, 'settings.json');
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

suite('welcome', {
  seed: (d) => {
    fs.writeFileSync(SETTINGS, JSON.stringify({ model: 'opus', hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo meu-hook' }] }] } }));
    const [home] = seed.makeFolders(d, ['geral'], { git: false });
    return seed.state([seed.project('p1', 'Geral', [], [seed.group('g1', 'Terminais', [seed.term('t1', 'bash', home)])])]);
  },
}, async (t) => {
  const W = { W: './js/actions/setup.js' };
  const text = () => t.js(`return document.querySelector('.welcome')?.innerText || ''`);
  const shows = (part) => t.waitFor(async () => (await text()).includes(part), { timeout: 12000 });
  const shot = async (name) => {
    if (!process.env.BO_TEST_SHOTS) return;
    await t.wait(400);
    fs.writeFileSync(path.join(process.env.BO_TEST_SHOTS, `${name}.png`), (await t.wc.capturePage()).toPNG());
  };
  const clickBtn = (label) => t.js(`[...document.querySelectorAll('.welcome .btn')].find((b) => b.textContent === ${JSON.stringify(label)}).click()`);

  await t.js(`W.openWelcome()`, W);
  t.equal(await t.js(`return S.store.state.taskView`), 'welcome', 'Primeiros passos abre na área principal');
  t.check(await shows('Encontrado em'), 'Git Bash encontrado', await text());
  t.check(await shows('falta entrar na sua conta'), 'Claude Code instalado, mas sem login', await text());
  t.includes(await text(), 'Pular por agora', 'com algo faltando, o botão final é "Pular por agora"');

  fs.writeFileSync(path.join(claudeDir, '.credentials.json'), '{}'); // você entrou (no terminal)
  t.check(await shows('9.9.9 (Claude Code) · conectado'), 'depois do login, a tela percebe sozinha', await text());
  await shot('welcome');

  await clickBtn('Conectar');
  t.check(await t.waitFor(() => t.modal.open()), 'Conectar mostra antes o que será gravado');
  const preview = await t.modal.text();
  t.check(preview.includes('bash-organizer') && preview.includes('settings.json') && preview.includes('.brain-organizer.bak'), 'a prévia diz o MCP, o arquivo dos hooks e a cópia', preview);
  await t.modal.submit();
  t.check(await shows('avisa aqui quando precisa de você'), 'conectado: o passo fica pronto', await text());

  const mcp = readJson(path.join(claudeDir, '.claude.json')).mcpServers?.['bash-organizer'];
  t.check(mcp && /bo\.js$/.test(mcp.args[0]) && mcp.args[1] === 'mcp' && mcp.env.ELECTRON_RUN_AS_NODE === '1', 'servidor MCP registrado pelo `claude mcp add` (escopo do usuário)', JSON.stringify(mcp));
  const settings = readJson(SETTINGS);
  t.equal(settings.model, 'opus', 'o resto do settings.json fica como estava');
  t.equal(settings.hooks.Stop.length, 2, 'o seu hook Stop continua, ao lado do nosso');
  t.includes(settings.hooks.Notification[0].hooks[0].command, 'notify --title Claude', 'hook Notification avisa no app');
  t.check(fs.existsSync(SETTINGS + '.brain-organizer.bak'), 'cópia do settings.json antes de gravar');
  await t.js(`await api.setup.integrate()`);
  t.equal(readJson(SETTINGS).hooks.Stop.length, 2, 'conectar de novo não duplica os hooks');
  t.includes(await text(), 'Começar', 'tudo pronto: o botão final é "Começar"');

  await t.js(`await W.installStep('git')`, W);
  t.check(await shows('Instalado com êxito'), 'instalar mostra a saída ao vivo na tela', await text());

  // Projeto a partir de uma pasta: dois repositórios, comandos detectados pelo package.json e pelo compose.
  const root = path.join(dir, 'loja');
  for (const [name, pkg, extra] of [['api', { scripts: { start: 'x' } }, 'compose.yaml'], ['web', { scripts: { test: 'x', dev: 'x' } }, 'pnpm-lock.yaml']]) {
    fs.mkdirSync(path.join(root, name, '.git'), { recursive: true });
    fs.writeFileSync(path.join(root, name, 'package.json'), JSON.stringify(pkg));
    fs.writeFileSync(path.join(root, name, extra), '');
  }
  await t.js(`F.projectFromFolder(${JSON.stringify(root)}); return true`, { F: './js/actions/project-folder.js' });
  t.check(await t.waitFor(() => t.modal.open()), 'abre a revisão do que vai virar terminal');
  const review = await t.modal.text();
  await shot('welcome-folder');
  t.check(['api', 'web', 'npm run start', 'pnpm run dev', 'pnpm run test', 'docker compose up', 'Terminal de agente'].every((s) => review.includes(s)), 'mostra os repositórios, os comandos e o agente', review);
  await t.modal.submit();
  const project = await t.waitFor(() => t.js(`return S.store.state.projects.find((p) => p.name === 'loja') || null`));
  t.equal(project?.repos.map((r) => r.name), ['api', 'web'], 'projeto com as duas pastas');
  t.equal(project?.groups.map((g) => [g.name, g.terminals.map((x) => x.startup || x.kind || '')]), [['api', ['npm run start']], ['web', ['pnpm run dev']], ['Agente', ['agent']]], 'um grupo por repositório com o comando marcado, e o do agente');
  t.equal(await t.js(`return S.store.state.taskView`), 'off', 'criado o projeto, volta aos terminais');
  t.equal(await t.js(`return S.activeEntry()?.project.name`), 'loja', 'e o primeiro terminal dele fica ativo');

  await t.js(`F.projectFromFolder(${JSON.stringify(root)}); return true`, { F: './js/actions/project-folder.js' });
  t.check(await t.waitFor(async () => (await t.modal.open()) && (await t.modal.text()).includes('já está no projeto')), 'a mesma pasta de novo: oferece abrir o projeto que já existe');
  await t.modal.cancel();
});
