// Menus de contexto do quadro de tarefas.
import { columnsOf } from '../../tasks/columns.js';
import { taskProject } from '../../tasks/queries.js';
import { moveTask, deleteTask } from '../../actions/tasks.js';
import { showMenu } from '../menu.js';
import { openTask } from './selection.js';
import { saveProgressDialog } from '../memory/progress.js';
import { parentDialog } from './detail-subtasks.js';

export function taskMenu(e, task) {
  const moves = columnsOf(taskProject(task))
    .filter((c) => c.id !== task.columnId)
    .map((c) => ({ label: `Mover para “${c.name}”`, action: () => moveTask(task, c.id) }));
  showMenu(e, [
    { label: 'Abrir', action: () => openTask(task.id) },
    { label: 'Salvar progresso…', action: () => saveProgressDialog(taskProject(task), task) },
    { label: 'Tornar subtarefa de…', action: () => parentDialog(task) },
    ...(moves.length ? [{ sep: true }, ...moves] : []),
    { sep: true },
    { label: 'Excluir', danger: true, action: () => deleteTask(task) },
  ]);
}
