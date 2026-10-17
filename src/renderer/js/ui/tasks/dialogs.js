// Diálogos do quadro: nova tarefa e configuração das colunas do projeto.
import { el, mount } from '../../core/dom.js';
import { uid } from '../../core/model.js';
import { columnsOf } from '../../tasks/columns.js';
import { projectTasks } from '../../tasks/queries.js';
import { createTask, saveColumns } from '../../actions/tasks.js';
import { openModal, field } from '../modal.js';
import { iconButton } from '../components.js';
import { openTask } from './selection.js';

export async function newTaskDialog(project, columnId) {
  const cols = columnsOf(project);
  const v = await openModal({
    title: `Nova tarefa · ${project.name}`,
    fields: [
      field.text('title', 'Título', '', { placeholder: 'O que precisa ser feito' }),
      field.textarea('description', 'Descrição', '', { placeholder: 'Contexto, critérios de pronto…' }),
      field.select('columnId', 'Coluna', columnId || cols[0].id, { options: cols.map((c) => ({ value: c.id, label: c.name })) }),
    ],
    submit: 'Criar',
  });
  if (!v?.title?.trim()) return;
  const task = createTask(project, { title: v.title, description: v.description, columnId: v.columnId });
  openTask(task.id);
}

/** Editor de colunas: nome + descrição (a descrição orienta o agente), reordenar, adicionar e remover. */
export async function columnsDialog(project) {
  const draft = columnsOf(project).map((c) => ({ ...c }));
  const used = new Set(projectTasks(project).map((t) => t.columnId));
  const list = el('div', { class: 'col-editor' });

  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= draft.length) return;
    [draft[i], draft[j]] = [draft[j], draft[i]];
    render();
  };
  const remove = (i) => {
    draft.splice(i, 1);
    render();
  };
  const add = () => {
    draft.push({ id: uid(), name: '', description: '' });
    render();
  };
  const input = (c, key, placeholder) =>
    el('input', { type: 'text', class: 'input', value: c[key], placeholder, oninput: (e) => (c[key] = e.target.value) });

  function row(c, i) {
    return el(
      'div',
      { class: 'col-row' },
      el('span', { class: 'col-index', text: i + 1 }),
      el('div', { class: 'col-fields' }, input(c, 'name', 'Nome da coluna'), input(c, 'description', 'Descrição: o que significa estar aqui')),
      el(
        'div',
        { class: 'col-actions' },
        iconButton('chevron', 'Subir', () => move(i, -1), 'up'),
        iconButton('chevron', 'Descer', () => move(i, 1)),
        iconButton('close', used.has(c.id) ? 'Remover (as tarefas vão para a 1ª coluna)' : 'Remover', () => remove(i)),
      ),
    );
  }

  function render() {
    mount(
      list,
      draft.map(row),
      el('button', { type: 'button', class: 'btn ghost col-add', onclick: add, text: '+ Adicionar coluna' }),
    );
  }
  render();

  const v = await openModal({
    title: `Colunas · ${project.name}`,
    message: 'A primeira coluna recebe as tarefas novas; a última é a de concluído. As descrições orientam o agente.',
    content: list,
    collect: () => ({ columns: draft.filter((c) => c.name.trim()).map((c) => ({ ...c, name: c.name.trim(), description: c.description.trim() })) }),
    submit: 'Salvar',
    wide: true,
  });
  if (v?.columns?.length) saveColumns(project, v.columns);
}
