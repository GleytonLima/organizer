import { store, commit } from '../core/store.js';
import { themeById } from './themes.js';
import { setTerminalTheme } from '../terminals/sessions.js';

const toVar = (key) => '--' + key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());

export const currentTheme = () => themeById(store.state?.theme);

/** Aplica as variáveis CSS do tema e atualiza os terminais abertos. */
export function applyTheme(id) {
  const theme = themeById(id);
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme.ui)) root.style.setProperty(toVar(key), value);
  root.dataset.kind = theme.kind;
  setTerminalTheme(theme.term);
  return theme;
}

export function setTheme(id) {
  store.state.theme = applyTheme(id).id;
  commit();
}
