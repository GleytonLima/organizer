import { store } from './store.js';

export function basename(p) {
  if (!p) return '';
  const parts = p.replace(/[\\/]+$/, '').split(/[\\/]/);
  return parts[parts.length - 1] || p;
}

/** Nome exibido do terminal: o nome dado ou a pasta atual. */
export const termLabel = (t) => t.name || basename(t.cwd) || 'bash';

/** Abrevia a pasta home como ~. */
export function shortPath(p) {
  const home = store.info.home;
  if (!p) return '';
  if (home && p.toLowerCase().startsWith(home.toLowerCase())) return '~' + p.slice(home.length);
  return p;
}
