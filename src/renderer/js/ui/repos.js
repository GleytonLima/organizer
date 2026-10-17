// Faixa de repositórios do projeto atual (multi-repo): um chip por repositório com branch e mudanças.
import { el } from '../core/dom.js';
import { currentProject, currentGroup } from '../core/store.js';
import { projectRepos } from '../git/git.js';
import { newTerminal } from '../actions/terminals.js';
import { gitDetail } from './components.js';
import { showMenu } from './menu.js';

function repoMenu(e, project, repo) {
  showMenu(e, [
    { label: `Novo terminal em ${repo.name}`, action: () => newTerminal(currentGroup(project), { cwd: repo.path }) },
    { label: 'Abrir pasta', action: () => api.openPath(repo.path) },
  ]);
}

export function repoStrip() {
  const project = currentProject();
  const repos = projectRepos(project);
  if (!repos.length) return null;
  return el(
    'div',
    { class: 'repo-strip', title: 'Repositórios do projeto' },
    repos.map((r) =>
      el(
        'button',
        { class: 'repo-chip', title: r.path, onclick: (e) => repoMenu(e, project, r), oncontextmenu: (e) => repoMenu(e, project, r) },
        r.git ? gitDetail(r.git, { repo: r.name }) : el('span', { class: 'git-repo', text: r.name }),
      ),
    ),
  );
}
