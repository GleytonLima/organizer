// Lista flutuante navegável pelo teclado: ↑/↓ movem, Enter/Tab escolhe, Esc fecha. Itens com
// rótulo e descrição (como os menus do Claude Code no terminal). Usada pelos seletores da conversa
// de agente e pelo autocompletar de comandos "/".
//   const popup = createListPopup({ onPick });
//   popup.show(rect, items, { above, selected })
// Enquanto aberta, a lista captura ↑/↓/Enter/Tab/Esc na janela (antes da caixa de texto ou do botão).
// Item: { value, label, detail?, hint?, current? }
import { el, mount } from '../core/dom.js';
import { icon } from './icons.js';

export function createListPopup({ onPick, onClose = () => {} }) {
  const node = el('div', { class: 'list-popup hidden', role: 'listbox' });
  document.body.append(node);
  let items = [];
  let index = 0;
  let open = false;

  function draw() {
    mount(
      node,
      items.map((it, i) =>
        el(
          'div',
          {
            class: `list-row${i === index ? ' on' : ''}${it.current ? ' current' : ''}`,
            role: 'option',
            onmousedown: (e) => (e.preventDefault(), pick(i)), // mousedown: não tira o foco da caixa de texto
            onmousemove: () => i !== index && ((index = i), draw()),
          },
          el('span', { class: 'list-label', text: it.label }),
          it.detail ? el('span', { class: 'list-detail', text: it.detail }) : null,
          it.hint ? el('span', { class: 'list-hint', text: it.hint }) : null,
          it.current ? icon('check', 'list-check') : null,
        ),
      ),
    );
    node.children[index]?.scrollIntoView({ block: 'nearest' });
  }

  function place(rect, above) {
    node.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - node.offsetWidth - 8))}px`;
    if (above) {
      node.style.top = '';
      node.style.bottom = `${innerHeight - rect.top + 6}px`;
    } else {
      node.style.bottom = '';
      node.style.top = `${rect.bottom + 6}px`;
    }
  }

  function pick(i = index) {
    const it = items[i];
    close();
    if (it) onPick(it);
  }

  function close() {
    if (!open) return;
    open = false;
    node.classList.add('hidden');
    window.removeEventListener('mousedown', outside, true);
    window.removeEventListener('keydown', handleKey, true);
    onClose();
  }

  const outside = (e) => !node.contains(e.target) && close();

  function handleKey(e) {
    if (!open) return false;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      index = (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      draw();
    } else if (e.key === 'Enter' || e.key === 'Tab') pick();
    else if (e.key === 'Escape') close();
    else return false;
    e.preventDefault();
    e.stopPropagation();
    return true;
  }

  return {
    get isOpen() {
      return open;
    },
    show(rect, list, { above = false, selected = 0, width = null } = {}) {
      items = list;
      index = Math.max(0, Math.min(selected, items.length - 1));
      if (!items.length) return close();
      node.style.minWidth = width ? `${width}px` : '';
      node.classList.remove('hidden');
      draw();
      place(rect, above);
      if (!open) {
        window.addEventListener('mousedown', outside, true);
        window.addEventListener('keydown', handleKey, true);
      }
      open = true;
    },
    close,
    destroy: () => (close(), node.remove()),
  };
}
