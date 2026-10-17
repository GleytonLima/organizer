// Ponto de entrada do renderer.
import { $ } from './core/dom.js';
import { store, loadState, persistNow, activeEntry, openTerminals } from './core/store.js';
import { applyTheme } from './themes/apply.js';
import { initSessions, createSession } from './terminals/sessions.js';
import { initKeys } from './terminals/keys.js';
import { initLayout } from './terminals/layout.js';
import { activate, newTerminal } from './actions/terminals.js';
import { startGitPolling } from './git/git.js';
import { initMenu } from './ui/menu.js';
import { openModal } from './ui/modal.js';
import { initRender, renderAll } from './ui/render.js';
import { initApi } from './api/index.js';

/** Recria os terminais dos projetos abertos e volta ao último ativo. */
function restoreSession() {
  openTerminals().forEach(({ t }) => createSession(t));
  const target = activeEntry()?.project.open ? activeEntry() : openTerminals()[0];
  if (target) activate(target.t.id);
  else newTerminal(store.state.projects[0].groups[0]);
}

async function init() {
  store.info = await api.ptyInfo();
  loadState(await api.loadState());
  applyTheme(store.state.theme);

  initSessions($('#terminals'), { onFocus: (id) => id !== store.state.activeId && activate(id) });
  initLayout($('#terminals'));
  initKeys();
  initMenu();
  initRender();
  $('#btn-empty-new').addEventListener('click', () => newTerminal());
  window.addEventListener('beforeunload', persistNow);

  restoreSession();
  renderAll();
  initApi(); // depois de restaurar: pedidos já encontram os terminais
  startGitPolling();

  if (!store.info.bash) {
    openModal({
      title: 'Git Bash não encontrado',
      message: 'Instale o Git for Windows ou defina GIT_BASH_PATH apontando para o bash.exe.',
    });
  }
}

init();
