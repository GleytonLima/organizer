// Testes Playwright dos projetos: detecta playwright.config.* nas pastas (chip do repositório) e roda
// `npx playwright test` num terminal próprio, "Playwright · <pasta>" (reaproveitado nas próximas vezes).
// O resultado (aviso ou tarefa) vem de ./result.js — vale também para quem roda o comando à mão.
import { notify, findTerm, currentGroup } from '../core/store.js';
import { addTerminal, activate } from '../actions/terminals.js';
import { getSession, writeWhenReady } from '../terminals/sessions.js';

// sem abrir o relatório HTML sozinho: no fim de uma falha o Playwright esperaria Ctrl+C no terminal
export const RUN_CMD = 'PW_TEST_HTML_REPORT_OPEN=never npx playwright test';

const cache = new Map(); // pasta → { config, report } | null

/** Playwright da pasta (do cache; a 1ª consulta busca em segundo plano e re-renderiza). */
export function playwrightOf(folder) {
  if (!cache.has(folder)) {
    cache.set(folder, null);
    api.playwrightDetect(folder).then((info) => {
      cache.set(folder, info);
      if (info) notify();
    });
  }
  return cache.get(folder);
}

/** Atualiza o que se sabe da pasta (ex.: o relatório passou a existir depois de rodar). */
export const refreshPlaywright = (folder) => api.playwrightDetect(folder).then((info) => (cache.set(folder, info), notify(), info));

const runnerName = (repo) => `Playwright · ${repo.name}`;

export function runPlaywright(project, repo) {
  const existing = project.groups.flatMap((g) => g.terminals).find((t) => t.name === runnerName(repo) && t.cwd === repo.path);
  if (existing && findTerm(existing.id)) {
    activate(existing.id);
    if (getSession(existing.id)?.running) return; // ainda rodando: só mostra
    return writeWhenReady(existing.id, `${RUN_CMD}\r`);
  }
  addTerminal(currentGroup(project), { cwd: repo.path, name: runnerName(repo), startup: RUN_CMD });
}
