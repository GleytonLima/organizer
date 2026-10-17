// Controle de lista de pastas (campo `field.folders` do modal): nome editável + caminho,
// adicionar várias de uma vez pelo seletor do sistema e remover.
import { el, mount } from '../core/dom.js';
import { store } from '../core/store.js';
import { basename, shortPath } from '../core/format.js';
import { iconButton } from './components.js';

const parentOf = (p) => (p ? p.replace(/[\\/][^\\/]+[\\/]?$/, '') : store.info.home);

/** `values[f.key]` vira uma cópia editável: [{ name, path }]. */
export function folderListControl(f, values) {
  const items = (values[f.key] = (values[f.key] || []).map((r) => ({ ...r })));
  const list = el('div', { class: 'folder-list' });

  async function add() {
    const picked = await api.pickFolders(parentOf(items.at(-1)?.path));
    for (const path of picked) {
      if (!items.some((r) => r.path.toLowerCase() === path.toLowerCase())) items.push({ name: basename(path), path });
    }
    render();
  }

  const row = (r, i) =>
    el(
      'div',
      { class: 'folder-item' },
      el('input', { type: 'text', class: 'input folder-name', value: r.name, title: 'Nome exibido', oninput: (e) => (r.name = e.target.value) }),
      // <bdi>: o corte à esquerda usa direction:rtl; sem isolar, o "~\" iria para o fim
      el('span', { class: 'folder-path', title: r.path }, el('bdi', { text: shortPath(r.path) })),
      iconButton('close', 'Remover da lista', () => {
        items.splice(i, 1);
        render();
      }),
    );

  function render() {
    mount(
      list,
      items.length ? items.map(row) : el('div', { class: 'folder-empty', text: 'Nenhuma pasta ainda.' }),
      el('button', { type: 'button', class: 'btn ghost folder-add', onclick: add, text: '+ Adicionar pastas…' }),
    );
  }
  render();
  return list;
}
