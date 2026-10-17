export function copySelection(term) {
  if (term.hasSelection()) api.clipboardWrite(term.getSelection());
  term.clearSelection();
}

export function paste(term) {
  api.clipboardRead().then((text) => text && term.paste(text));
}

/** Comportamento do botão direito (estilo Windows Terminal): copia a seleção ou cola. */
export function copyOrPaste(term) {
  if (term.hasSelection()) copySelection(term);
  else paste(term);
}
