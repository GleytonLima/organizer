export const $ = (sel, root = document) => root.querySelector(sel);

const isEmpty = (c) => c == null || c === false;

/** Cria um elemento: atributos, `on*` viram listeners, `text` vira textContent. */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (isEmpty(v)) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  append(node, children);
  return node;
}

function append(node, children) {
  for (const c of children.flat(Infinity)) {
    if (isEmpty(c)) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** Substitui os filhos de `node`, ignorando null/false. */
export function mount(node, ...children) {
  node.replaceChildren();
  append(node, children);
  return node;
}

/**
 * Como `mount`, mas preserva foco e cursor do campo em edição (marcado com data-draft="chave").
 * Use em áreas que re-renderizam enquanto o usuário digita.
 */
export function remount(node, ...children) {
  const active = document.activeElement;
  const key = node.contains(active) ? active.dataset.draft : null;
  const sel = key ? [active.selectionStart, active.selectionEnd] : null;
  mount(node, ...children);
  const again = key && node.querySelector(`[data-draft="${key}"]`);
  if (again) {
    again.focus();
    again.setSelectionRange?.(...sel);
  }
  return node;
}

/** Envolve um handler para não propagar o clique (botões dentro de itens clicáveis). */
export const stop = (fn) => (e) => {
  e.stopPropagation();
  fn(e);
};
