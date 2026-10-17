// "Abrir no VS Code" (menus do chip de repositório, do terminal e do projeto): o processo principal
// roda `code <pasta>` (src/main/editor.js); se falhar, explica como deixar o `code` no PATH.
import { openModal } from './modal.js';

export async function openInEditor(folder) {
  const r = await api.openInEditor(folder);
  if (r.ok) return true;
  openModal({
    title: 'Não foi possível abrir no VS Code',
    message: `${r.error}\n\nO comando “code” precisa estar no PATH: no VS Code, Ctrl+Shift+P → “Shell Command: Install 'code' command in PATH”.`,
  });
  return false;
}
