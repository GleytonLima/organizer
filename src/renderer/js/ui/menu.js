// Menu flutuante (contexto ou dropdown de botão).
// Item: { label, action, danger?, checked?, swatch? } ou { sep: true }.
import { $, el, mount } from '../core/dom.js';
import { icon } from './icons.js';

const menu = () => $('#menu');

function itemNode(it) {
  if (it.sep) return el('div', { class: 'menu-sep' });
  return el(
    'div',
    {
      class: `menu-item${it.danger ? ' danger' : ''}`,
      onclick: () => {
        hideMenu();
        it.action();
      },
    },
    it.swatch ? el('span', { class: 'menu-swatch', style: { background: it.swatch } }) : null,
    el('span', { class: 'menu-label', text: it.label }),
    it.checked ? icon('check', 'menu-check') : null,
  );
}

/** Abre o menu na posição do mouse, ou abaixo do botão que disparou o evento. */
export function showMenu(e, items) {
  e.preventDefault();
  e.stopPropagation();
  const node = mount(menu(), items.map(itemNode));
  node.classList.remove('hidden');
  const anchor = e.type === 'click' ? e.currentTarget?.getBoundingClientRect?.() : null;
  const x = anchor ? anchor.right - node.offsetWidth : e.clientX;
  const y = anchor ? anchor.bottom + 6 : e.clientY;
  node.style.left = Math.max(6, Math.min(x, innerWidth - node.offsetWidth - 6)) + 'px';
  node.style.top = Math.max(6, Math.min(y, innerHeight - node.offsetHeight - 6)) + 'px';
}

export const hideMenu = () => menu().classList.add('hidden');

export function initMenu() {
  document.addEventListener('mousedown', (e) => {
    if (!menu().contains(e.target)) hideMenu();
  });
  window.addEventListener('blur', hideMenu);
  window.addEventListener('keydown', (e) => e.key === 'Escape' && hideMenu());
}
