// Autocompletar de comandos "/" na caixa de mensagem da conversa de agente: ao digitar "/", abre a
// lista dos comandos que o agente anunciou (available_commands_update), filtrando pelo que você
// digita; ↑/↓ e Enter/Tab completam "/comando " — e a dica do argumento aparece na caixa.
import { createListPopup } from '../list-popup.js';

const MAX = 12;

/** Comandos que casam com o texto depois da barra (nome que começa com ele primeiro). */
function matches(commands, query) {
  const q = query.toLowerCase();
  const starts = commands.filter((c) => c.name.toLowerCase().startsWith(q));
  const contains = commands.filter((c) => !starts.includes(c) && c.name.toLowerCase().includes(q));
  return [...starts, ...contains].slice(0, MAX);
}

/** Liga o autocompletar a uma caixa de texto (a lista captura as teclas enquanto aberta). */
export function attachSlash(s, textarea) {
  const placeholder = textarea.placeholder;
  const popup = createListPopup({
    onPick: (item) => {
      textarea.value = `/${item.value} `;
      textarea.placeholder = placeholder;
      if (item.inputHint) textarea.dataset.hint = item.inputHint;
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      update();
    },
  });

  function update() {
    const m = /^\/(\S*)$/.exec(textarea.value);
    const hint = textarea.dataset.hint;
    textarea.title = hint && textarea.value.startsWith('/') ? `Argumento: ${hint}` : '';
    if (!m || !s.commands?.length) return popup.close();
    const list = matches(s.commands, m[1]).map((c) => ({ value: c.name, label: `/${c.name}`, detail: c.description || '', hint: c.input?.hint || '', inputHint: c.input?.hint || '' }));
    popup.show(textarea.getBoundingClientRect(), list, { above: true, width: Math.min(640, textarea.offsetWidth) });
  }

  textarea.addEventListener('input', () => {
    if (!textarea.value.startsWith('/')) delete textarea.dataset.hint;
    update();
  });
  textarea.addEventListener('blur', () => setTimeout(() => popup.close(), 120));
  return { close: () => popup.close() };
}
