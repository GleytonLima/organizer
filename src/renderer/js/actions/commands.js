// Comandos salvos: atalhos que rodam no terminal ativo.
import { store, commit } from '../core/store.js';
import { uid } from '../core/model.js';
import { openModal, field } from '../ui/modal.js';

export async function editCommand(c = null) {
  const v = await openModal({
    title: c ? 'Editar comando' : 'Novo comando',
    fields: [
      field.text('label', 'Rótulo', c?.label, { placeholder: 'dev' }),
      field.text('cmd', 'Comando', c?.cmd, { mono: true, placeholder: 'npm run dev' }),
    ],
    submit: c ? 'Salvar' : 'Adicionar',
  });
  if (!v || !v.cmd.trim()) return;
  const data = { label: v.label.trim() || v.cmd.trim(), cmd: v.cmd.trim() };
  if (c) Object.assign(c, data);
  else store.state.commands.push({ id: uid(), ...data });
  commit();
}

export function moveCommand(c, dir) {
  const list = store.state.commands;
  const i = list.indexOf(c);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  commit();
}

export function removeCommand(c) {
  store.state.commands = store.state.commands.filter((x) => x !== c);
  commit();
}
