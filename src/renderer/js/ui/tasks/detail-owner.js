// Dono da tarefa do quadro do time ("com Ana") e o "Retomar": você passa a ser o dono.
import { el, stop } from '../../core/dom.js';
import { cleanError } from '../../core/errors.js';
import { openModal } from '../modal.js';
import { claimTask, ownedByOther } from '../../tasks/claim.js';
import { myServerName } from '../../tasks/sync.js';

async function resume(task) {
  const ok = await openModal({
    title: `Retomar ${task.key}?`,
    message: `Hoje com ${task.owner.name}. Você passa a ser o dono; a troca fica no histórico da tarefa.`,
    submit: 'Retomar',
  });
  if (!ok) return;
  try {
    await claimTask(task);
  } catch (err) {
    await openModal({ title: 'Não foi possível retomar', message: cleanError(err) });
  }
}

/** Valor do item "Com" da gaveta: o dono (ou "você") e, se for outra pessoa, o botão Retomar. */
export function ownerValue(task) {
  if (!task.owner?.name) return el('span', { text: '—' });
  const mine = task.owner.name === myServerName();
  return el(
    'span',
    { class: 'td-owner' },
    el('span', { text: mine ? 'você' : task.owner.name }),
    ownedByOther(task) ? el('button', { class: 'link', title: 'Você passa a ser o dono', onclick: stop(() => resume(task)), text: 'Retomar' }) : null,
  );
}

/** Chip do cartão quando a tarefa está com outra pessoa. */
export const ownerChip = (task) =>
  ownedByOther(task) ? el('span', { class: 'task-chip', title: 'Quem está com a tarefa' }, el('span', { text: `com ${task.owner.name}` })) : null;
