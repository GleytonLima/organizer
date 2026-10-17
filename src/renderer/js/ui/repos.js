// Faixa de repositórios do projeto atual: um chip por pasta associada ao projeto
// (repo, branch e mudanças), + para adicionar pastas.
import { el } from '../core/dom.js';
import { currentProject, currentGroup } from '../core/store.js';
import { projectRepos } from '../git/git.js';
import { newTerminal } from '../actions/terminals.js';
import { addProjectFolders, removeProjectFolder } from '../actions/projects.js';
import { gitDetail, iconButton } from './components.js';
import { showMenu } from './menu.js';
import { openInEditor } from './editor.js';
import { playwrightOf, runPlaywright } from '../playwright/runner.js';

/** Pasta com playwright.config.*: rodar os testes num terminal próprio e abrir o último relatório. */
function playwrightItems(project, repo) {
  const pw = playwrightOf(repo.path);
  if (!pw) return [];
  return [
    { sep: true },
    { label: 'Rodar testes Playwright', hint: pw.config, action: () => runPlaywright(project, repo) },
    pw.report ? { label: 'Abrir relatório Playwright', action: () => api.openPath(pw.report) } : null,
  ].filter(Boolean);
}

function repoMenu(e, project, repo) {
  showMenu(e, [
    { label: `Novo terminal em ${repo.name}`, action: () => newTerminal(currentGroup(project), { cwd: repo.path }) },
    { label: 'Abrir no VS Code', action: () => openInEditor(repo.path) },
    { label: 'Abrir pasta', action: () => api.openPath(repo.path) },
    ...playwrightItems(project, repo),
    { sep: true },
    { label: 'Remover do projeto', danger: true, action: () => removeProjectFolder(project, repo) },
  ]);
}

function chip(project, r) {
  playwrightOf(r.path); // detecta já, para o menu ter "Rodar testes Playwright" no 1º clique
  return el(
    'button',
    { class: 'repo-chip', title: r.path, onclick: (e) => repoMenu(e, project, r), oncontextmenu: (e) => repoMenu(e, project, r) },
    r.git ? gitDetail(r.git, { repo: r.name }) : el('span', { class: 'git-repo', text: r.name }),
  );
}

export function repoStrip() {
  const project = currentProject();
  if (!project) return null;
  const repos = projectRepos(project);
  return el(
    'div',
    { class: 'repo-strip', title: 'Pastas/repositórios do projeto' },
    repos.length ? repos.map((r) => chip(project, r)) : el('span', { class: 'repo-hint', text: 'Adicione as pastas dos repositórios deste projeto →' }),
    iconButton('plus', 'Adicionar pastas ao projeto', () => addProjectFolders(project), 'repo-add'),
  );
}
