// Disposição dos terminais na área principal: um só (o ativo) ou vários em grade (lado a lado).
import { store } from '../core/store.js';
import { allSessions, fitVisible } from './sessions.js';

let container = null;

/** Colunas × linhas para n terminais: até 3 lado a lado; acima disso, uma grade quase quadrada. */
function gridFor(n) {
  const cols = n <= 3 ? n : Math.ceil(Math.sqrt(n));
  return { cols, rows: Math.ceil(n / cols) };
}

export function initLayout(node) {
  container = node;
  new ResizeObserver(fitVisible).observe(container);
}

/** Mostra só os terminais em `ids` (na ordem dada); com 2+, ativa a grade. */
export function applyLayout(ids) {
  const split = ids.length > 1;
  container.classList.toggle('split', split);
  if (split) {
    const { cols, rows } = gridFor(ids.length);
    container.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    container.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
  }
  for (const [id, s] of allSessions()) {
    const index = ids.indexOf(id);
    s.host.classList.toggle('visible', index >= 0);
    s.host.classList.toggle('active', id === store.state.activeId);
    s.host.style.order = index >= 0 ? index : '';
  }
  requestAnimationFrame(fitVisible);
}
