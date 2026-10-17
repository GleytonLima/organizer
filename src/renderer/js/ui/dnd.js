// Arrastar-e-soltar (HTML5 DnD) com tipo: um alvo só aceita itens do seu tipo
// ('terminal' na sidebar, 'task' no quadro).
let dragging = null; // { kind, id }

/** Atributos para um elemento arrastável. */
export const draggable = (kind, id) => ({
  draggable: 'true',
  ondragstart: (e) => {
    dragging = { kind, id };
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('dragging');
  },
  ondragend: (e) => {
    dragging = null;
    e.currentTarget.classList.remove('dragging');
  },
});

/** Atributos para um alvo de soltura; `onDrop(id)` recebe o id do item arrastado. */
export const dropTarget = (kind, onDrop) => ({
  ondragover: (e) => {
    if (dragging?.kind !== kind) return;
    e.preventDefault();
    e.currentTarget.classList.add('drop-over');
  },
  ondragleave: (e) => e.currentTarget.classList.remove('drop-over'),
  ondrop: (e) => {
    e.currentTarget.classList.remove('drop-over');
    if (dragging?.kind !== kind) return;
    e.preventDefault();
    e.stopPropagation();
    onDrop(dragging.id);
  },
});
