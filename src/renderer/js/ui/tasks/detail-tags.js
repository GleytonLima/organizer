// Seção "Tags" da gaveta da tarefa: chips com × e uma caixa para acrescentar (Enter ou vírgula;
// várias de uma vez separadas por espaço). Sugere as tags já usadas no projeto.
import { el } from '../../core/dom.js';
import { projectTasks, taskProject } from '../../tasks/queries.js';
import { tagsOf, tagsInUse, parseTags, hasTag } from '../../tasks/tags.js';
import { addTaskTags, removeTaskTags } from '../../actions/task-tags.js';
import { icon } from '../icons.js';

export function tagsBox(task, draft) {
  const known = tagsInUse(projectTasks(taskProject(task))).filter((t) => !hasTag(task, t));
  const listId = `td-tags-known-${task.id}`;
  const add = (input) => {
    const tags = parseTags(input.value);
    draft.tag = input.value = '';
    if (tags.length) addTaskTags(task, tags);
  };
  const input = el('input', {
    class: 'td-tag-input',
    type: 'text',
    'data-draft': 'tag',
    list: listId,
    placeholder: tagsOf(task).length ? 'Mais uma…' : 'Adicionar tag (ex.: jira:PROJ-123)…',
    spellcheck: 'false',
    oninput: (e) => {
      draft.tag = e.target.value;
      if (/[,]$/.test(e.target.value)) add(e.target);
    },
    onkeydown: (e) => e.key === 'Enter' && (e.preventDefault(), add(e.target)),
    onblur: (e) => e.target.value.trim() && add(e.target),
  });
  input.value = draft.tag || '';
  return el(
    'div',
    { class: 'td-tags' },
    tagsOf(task).map((t) =>
      el('span', { class: 'td-tag' }, el('span', { text: `#${t}` }), el('button', { class: 'td-tag-x', title: `Tirar #${t}`, onclick: () => removeTaskTags(task, [t]) }, icon('close'))),
    ),
    input,
    el('datalist', { id: listId }, known.map((t) => el('option', { value: t }))),
  );
}
