// Arrastar-e-soltar de terminais entre grupos (HTML5 DnD).
let dragId = null;

/** Atributos para um elemento arrastável que carrega o id de um terminal. */
export const draggable = (id) => ({
  draggable: 'true',
  ondragstart: (e) => {
    dragId = id;
    e.dataTransfer.effectAllowed = 'move';
  },
  ondragend: () => (dragId = null),
});

/** Atributos para um alvo de soltura; `onDrop(id)` recebe o terminal arrastado. */
export const dropTarget = (onDrop) => ({
  ondragover: (e) => {
    if (!dragId) return;
    e.preventDefault();
    e.currentTarget.classList.add('drop-over');
  },
  ondragleave: (e) => e.currentTarget.classList.remove('drop-over'),
  ondrop: (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drop-over');
    if (dragId) onDrop(dragId);
  },
});
