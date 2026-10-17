// Orquestra o re-render da interface a cada mudança de estado.
import { $ } from '../core/dom.js';
import { store, subscribe } from '../core/store.js';
import { activeSession, syncVisibility } from '../terminals/sessions.js';
import { renderSidebar } from './sidebar.js';
import { renderTopbar } from './topbar.js';
import { renderCmdbar } from './cmdbar.js';
import { renderStatusbar } from './statusbar.js';

export function renderAll() {
  $('#app').dataset.layout = store.state.layout;
  syncVisibility();
  $('#empty').classList.toggle('hidden', !!activeSession());
  renderSidebar();
  renderTopbar();
  renderCmdbar();
  renderStatusbar();
}

export const initRender = () => subscribe(renderAll);
