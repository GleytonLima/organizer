// Fábricas do state.json semeado e de pastas de repositório para os testes.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const term = (id, name, cwd, startup = '') => ({ id, name, color: null, cwd, startup });
const group = (id, name, terminals) => ({ id, name, collapsed: false, terminals });

/** Projeto com pastas explícitas; `cwd` = primeira pasta. `folders`: [caminho]. */
function project(id, name, folders, groups) {
  return {
    id,
    name,
    color: '#8cc79f',
    cwd: folders[0],
    repos: folders.map((p) => ({ name: path.basename(p), path: p })),
    open: true,
    collapsed: false,
    groups,
  };
}

function state(projects, extra = {}) {
  const first = projects[0]?.groups[0]?.terminals[0];
  return { version: 2, layout: 'left', theme: 'grafite', activeId: first?.id ?? null, commands: [], projects, ...extra };
}

/** Cria `names` dentro de `base`; com `git`, cada uma vira um repositório (branch opcional por nome). */
function makeFolders(base, names, { git = true, branches = {} } = {}) {
  return names.map((name) => {
    const dir = path.join(base, name);
    fs.mkdirSync(dir, { recursive: true });
    if (git) execFileSync('git', ['init', '-q', '-b', branches[name] || 'main'], { cwd: dir });
    return dir;
  });
}

module.exports = { term, group, project, state, makeFolders };
