// Seção "Memórias" da gaveta da tarefa: as decisões, como fazer e ideias que dão contexto à tarefa
// (vão para o agente no get_task). Vincular abre o seletor (busca, filtro por tipo, várias).
import { el } from '../../core/dom.js';
import { taskProject } from '../../tasks/queries.js';
import { kindOf } from '../../memory/kinds.js';
import { setTaskMemories, unlinkTaskMemory, cachedTaskMemories } from '../../actions/task-memories.js';
import { pickMemories } from '../memory/picker.js';
import { iconButton } from '../components.js';
import { icon } from '../icons.js';

const memoryRow = (task, m) =>
  el(
    'div',
    { class: 'td-mem' },
    icon(kindOf(m.kind).icon, 'td-mem-icon'),
    el('span', { class: 'td-mem-text', title: m.text, text: m.text }),
    m.review ? el('span', { class: 'mem-flag static', title: m.review.reason, text: 'a revisar' }) : null,
    iconButton('close', 'Desvincular', () => unlinkTaskMemory(task, m.gid), 'reveal'),
  );

async function pick(task) {
  const gids = await pickMemories({ project: taskProject(task), title: `Memórias de ${task.key}`, selected: task.memoryRefs || [], suggest: task.title });
  if (gids) await setTaskMemories(task, gids);
}

export function memoriesBox(task) {
  const linked = cachedTaskMemories(task);
  return el(
    'div',
    { class: 'td-memories' },
    linked.length ? linked.map((m) => memoryRow(task, m)) : el('div', { class: 'td-mem-empty', text: 'Nenhuma. Vincule decisões, “como fazer” e ideias que o agente precisa saber.' }),
    el('div', { class: 'td-mem-actions' }, el('button', { type: 'button', class: 'btn small', onclick: () => pick(task) }, icon('link'), 'Vincular memórias…')),
  );
}
