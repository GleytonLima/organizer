import { store } from './store.js';

export function basename(p) {
  if (!p) return '';
  const parts = p.replace(/[\\/]+$/, '').split(/[\\/]/);
  return parts[parts.length - 1] || p;
}

/** Nome exibido do terminal: o nome dado ou a pasta atual. */
export const termLabel = (t) => t.name || basename(t.cwd) || 'bash';

/** "agora", "5 min", "3 h", "2 d". */
export function timeAgo(at) {
  const s = Math.round((Date.now() - at) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} d`;
}

/** Abrevia a pasta home como ~. */
export function shortPath(p) {
  const home = store.info.home;
  if (!p) return '';
  if (home && p.toLowerCase().startsWith(home.toLowerCase())) return '~' + p.slice(home.length);
  return p;
}
