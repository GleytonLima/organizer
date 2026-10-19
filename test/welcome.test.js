// Primeiros passos: o que falta nesta máquina, instalar com a saída na tela e, para cada agente de IA
// (Claude Code e Devin), entrar na conta e conectá-lo ao app — MCP + hooks sem estragar o settings.json no
// Claude, MCP + perfil ACP no Devin — e o projeto a partir de uma pasta (repositórios e comandos detectados
// viram grupos e terminais). CLIs dos agentes e instaladores são falsos.
const fs = require('fs');
const path = require('path');
const { suite, seed } = require('./harness');

const dir = process.env.BO_TEST_DIR;
const claudeDir = path.join(dir, 'claude');
const devinDir = path.join(dir, 'devin');
for (const d of [claudeDir, devinDir]) fs.mkdirSync(d, { recursive: true });
const FAKE = path.join(__dirname, 'fixtures', 'fake-agent-cli.js');
process.env.CLAUDE_CONFIG_DIR = claudeDir;
process.env.BO_CLAUDE_BIN = JSON.stringify(['node', FAKE, path.join(claudeDir, '.claude.json'), '9.9.9 (Claude Code)']);
process.env.BO_DEVIN_HOME = devinDir;
process.env.BO_DEVIN_BIN = JSON.stringify(['node', FAKE, path.join(devinDir, 'mcp_config.json'), 'devin 7.7.7']);
process.env.BO_SETUP_INSTALL = JSON.stringify({ git: ['node', '-e', "console.log('Baixando Git.Git'); console.log('Instalado com êxito')"] });
process.env.BO_ACP_AGENT = JSON.stringify([process.execPath, path.join(__dirname, 'fixtures', 'fake-acp-agent.js')]);
delete process.env.ANTHROPIC_API_KEY; // "entrou na conta" vem só dos arquivos de credenciais falsos

const SETTINGS = path.join(claudeDir, 'settings.json');
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const PROFILE = (id, label, command, args, builtin = false) => ({ id, label, builtin, command, args, env: '', mode: '', mcp: '' });

suite('welcome', {
  seed: (d) => {
    fs.writeFileSync(SETTINGS, JSON.stringify({ model: 'opus', hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo meu-hook' }] }] } }));
    const [home] = seed.makeFolders(d, ['geral'], { git: false });
    // um perfil do Devin criado à mão: conectar atualiza este, sem duplicar
    const agentProfiles = [PROFILE('claude', 'Claude Code', '', '', true), PROFILE('x1', 'Meu Devin', 'C:\\ferramentas\\devin.exe', 'acp')];
    return seed.state([seed.project('p1', 'Geral', [], [seed.group('g1', 'Terminais', [seed.term('t1', 'bash', home)])])], { agentProfiles });
  },
}, async (t) => {
  const W = { W: './js/actions/setup.js' };
  const text = () => t.js(`return document.querySelector('.welcome')?.innerText || ''`);
  const row = (id) => () => t.js(`return document.querySelector('.wl-agent[data-agent="${id}"]')?.innerText || ''`);
  const shows = (part, of = text) => t.waitFor(async () => (await of()).includes(part), { timeout: 12000 });
  const view = () => t.js(`return S.store.state.taskView`);
  const shot = async (name) => {
    if (!process.env.BO_TEST_SHOTS) return;
    await t.wait(400);
    fs.writeFileSync(path.join(process.env.BO_TEST_SHOTS, `${name}.png`), (await t.wc.capturePage()).toPNG());
  };
  const clickIn = (id, label) => t.js(`[...document.querySelectorAll('.wl-agent[data-agent="${id}"] .btn')].find((b) => b.textContent === ${JSON.stringify(label)}).click()`);

  await t.js(`W.openWelcome()`, W);
  t.equal(await view(), 'welcome', 'Primeiros passos abre na área principal');
  t.check(await shows('Encontrado em'), 'Git Bash encontrado', await text());
  t.check(await shows('falta entrar na sua conta', row('claude')), 'Claude Code instalado, mas sem login', await row('claude')());
  t.check(await shows('devin 7.7.7 · falta entrar', row('devin')), 'Devin instalado, mas sem login', await row('devin')());
  t.includes(await text(), 'Pular por agora', 'com algo faltando, o botão final é "Pular por agora"');

  // Claude: você entrou (no terminal) → Conectar = MCP + hooks
  fs.writeFileSync(path.join(claudeDir, '.credentials.json'), '{}');
  t.check(await shows('falta ligá-lo ao app', row('claude')), 'depois do login, a tela percebe sozinha', await row('claude')());
  await shot('welcome');
  await clickIn('claude', 'Conectar');
  t.check(await t.waitFor(() => t.modal.open()), 'Conectar mostra antes o que será gravado');
  const preview = await t.modal.text();
  t.check(preview.includes('bash-organizer') && preview.includes('settings.json') && preview.includes('.brain-organizer.bak'), 'a prévia diz o MCP, o arquivo dos hooks e a cópia', preview);
  await t.modal.submit();
  t.check(await shows('pronto', row('claude')), 'Claude conectado: a linha fica pronta', await row('claude')());
  const mcp = readJson(path.join(claudeDir, '.claude.json')).mcpServers?.['bash-organizer'];
  t.check(mcp && /bo\.js$/.test(mcp.args[0]) && mcp.args[1] === 'mcp' && mcp.env.ELECTRON_RUN_AS_NODE === '1', 'servidor MCP registrado pelo `claude mcp add` (escopo do usuário)', JSON.stringify(mcp));
  const settings = readJson(SETTINGS);
  t.equal(settings.model, 'opus', 'o resto do settings.json fica como estava');
  t.equal(settings.hooks.Stop.length, 2, 'o seu hook Stop continua, ao lado do nosso');
  t.includes(settings.hooks.Notification[0].hooks[0].command, 'notify --title Claude', 'hook Notification avisa no app');
  t.check(fs.existsSync(SETTINGS + '.brain-organizer.bak'), 'cópia do settings.json antes de gravar');
  await t.js(`await api.setup.connect('claude')`);
  t.equal(readJson(SETTINGS).hooks.Stop.length, 2, 'conectar de novo não duplica os hooks');
  t.includes(await text(), 'Começar', 'um agente pronto basta: o botão final é "Começar"');

  // Devin: "Entrar" abre o login num terminal; quando você entra, os Primeiros passos voltam sozinhos
  await clickIn('devin', 'Entrar');
  t.check(await t.waitFor(async () => (await view()) === 'off'), 'Entrar leva a um terminal');
  t.includes(await t.js(`return S.activeEntry()?.t.startup || ''`), 'auth login', 'com o login do Devin');
  fs.writeFileSync(path.join(devinDir, 'credentials.toml'), 'token = "x"');
  t.check(await t.waitFor(async () => (await view()) === 'welcome', { timeout: 12000 }), 'logado, os Primeiros passos voltam sozinhos');
  t.check(await shows('falta ligá-lo ao app', row('devin')), 'Devin logado, falta conectar', await row('devin')());
  await clickIn('devin', 'Conectar');
  t.check(await t.waitFor(() => t.modal.open()), 'Conectar o Devin mostra o que será feito');
  t.includes((await t.modal.text()).toLowerCase(), 'perfil de agente', 'a prévia inclui o perfil ACP');
  await t.modal.submit();
  t.check(await shows('pronto', row('devin')), 'Devin conectado: a linha fica pronta', await text());
  t.check(!!readJson(path.join(devinDir, 'mcp_config.json')).mcpServers?.['bash-organizer'], 'servidor MCP registrado pelo `devin mcp add`');
  const profiles = await t.js(`return S.store.state.agentProfiles.map((p) => [p.id, p.command, p.args])`);
  t.equal(profiles.length, 2, 'o perfil do Devin que você criou foi atualizado, sem duplicar');
  t.check(profiles[1][0] === 'x1' && profiles[1][1] === 'node' && profiles[1][2].endsWith('acp'), 'perfil aponta para o executável encontrado, com `acp`', JSON.stringify(profiles));

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
  t.check(['api', 'web', 'npm run start', 'pnpm run dev', 'pnpm run test', 'docker compose up', 'Terminal de agente (Claude Code)'].every((s) => review.includes(s)), 'mostra os repositórios, os comandos e o agente pronto', review);
  await t.modal.submit();
  const project = await t.waitFor(() => t.js(`return S.store.state.projects.find((p) => p.name === 'loja') || null`));
  t.equal(project?.repos.map((r) => r.name), ['api', 'web'], 'projeto com as duas pastas');
  t.equal(project?.groups.map((g) => [g.name, g.terminals.map((x) => x.startup || x.agent || '')]), [['api', ['npm run start']], ['web', ['pnpm run dev']], ['Agente', ['claude']]], 'um grupo por repositório com o comando marcado, e o do agente');
  t.equal(await view(), 'off', 'criado o projeto, volta aos terminais');
  t.equal(await t.js(`return S.activeEntry()?.project.name`), 'loja', 'e o primeiro terminal dele fica ativo');

  await t.js(`F.projectFromFolder(${JSON.stringify(root)}); return true`, { F: './js/actions/project-folder.js' });
  t.check(await t.waitFor(async () => (await t.modal.open()) && (await t.modal.text()).includes('já está no projeto')), 'a mesma pasta de novo: oferece abrir o projeto que já existe');
  await t.modal.cancel();
});
