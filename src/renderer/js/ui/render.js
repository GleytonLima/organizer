// Orquestra o re-render da interface a cada mudança de estado.
import { $ } from '../core/dom.js';
import { store, subscribe, visibleTerminalIds } from '../core/store.js';
import { activeSession } from '../terminals/sessions.js';
import { applyLayout } from '../terminals/layout.js';
import { renderSidebar } from './sidebar.js';
import { renderTopbar } from './topbar.js';
import { renderCmdbar } from './cmdbar.js';
import { renderStatusbar } from './statusbar.js';
import { renderPaneHeads } from './split.js';
import { markRead } from '../notify/center.js';

export function renderAll() {
  $('#app').dataset.layout = store.state.layout;
  const visible = visibleTerminalIds();
  if (document.hasFocus()) markRead(visible); // o que você está vendo não fica marcado como novo
  applyLayout(visible);
  renderPaneHeads(visible);
  $('#empty').classList.toggle('hidden', !!activeSession());
  renderSidebar();
  renderTopbar();
  renderCmdbar();
  renderStatusbar();
}

export const initRender = () => subscribe(renderAll);
