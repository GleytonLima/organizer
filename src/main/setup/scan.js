// "Projeto a partir de uma pasta": acha os repositórios (a própria pasta ou as subpastas com .git) e,
// em cada um, os comandos prováveis (scripts do package.json, docker compose) para virar terminais.
const fs = require('fs');
const path = require('path');

const MAX_REPOS = 20;
const MAX_COMMANDS = 8;
const PREFERRED = ['dev', 'start', 'serve', 'watch', 'test'];
const LOCKS = [['pnpm-lock.yaml', 'pnpm'], ['yarn.lock', 'yarn'], ['bun.lockb', 'bun'], ['bun.lock', 'bun']];
const COMPOSE = ['compose.yaml', 'compose.yml', 'docker-compose.yaml', 'docker-compose.yml'];

const isRepo = (dir) => fs.existsSync(path.join(dir, '.git'));
const has = (dir, name) => fs.existsSync(path.join(dir, name));

function readScripts(dir) {
  try {
    const scripts = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).scripts;
    return scripts && typeof scripts === 'object' ? Object.keys(scripts) : [];
  } catch {
    return [];
  }
}

const rank = (name) => (PREFERRED.includes(name) ? PREFERRED.indexOf(name) : PREFERRED.length);

/** Comandos sugeridos: { name, cmd, checked } — marcado só o de subir o projeto (dev, ou start). */
function commandsOf(dir) {
  const pm = LOCKS.find(([file]) => has(dir, file))?.[1] || 'npm';
  const scripts = readScripts(dir).sort((a, b) => rank(a) - rank(b)).slice(0, MAX_COMMANDS);
  const main = scripts.includes('dev') ? 'dev' : scripts.includes('start') ? 'start' : null;
  const out = scripts.map((name) => ({ name, cmd: `${pm} run ${name}`, checked: name === main }));
  if (COMPOSE.some((f) => has(dir, f))) out.push({ name: 'docker compose', cmd: 'docker compose up', checked: false });
  return out;
}

function subRepos(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules')
    .map((d) => path.join(dir, d.name))
    .filter(isRepo)
    .slice(0, MAX_REPOS);
}

/** { name, root, repos: [{ name, path, commands }] } — sem repositório, a própria pasta. */
function scanFolder(dir) {
  const root = path.resolve(String(dir || ''));
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw new Error('Escolha uma pasta.');
  const found = isRepo(root) ? [root] : subRepos(root);
  const repos = (found.length ? found : [root]).map((p) => ({ name: path.basename(p), path: p, commands: commandsOf(p) }));
  return { name: path.basename(root), root, repos };
}

module.exports = { scanFolder };
