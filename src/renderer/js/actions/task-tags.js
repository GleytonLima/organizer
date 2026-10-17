// Tags de tarefa (ver tasks/tags.js): acrescentar e tirar, com registro no histórico.
import { commit } from '../core/store.js';
import { logTask } from '../tasks/history.js';
import { normalizeTag, foldTag, tagsOf, hasTag } from '../tasks/tags.js';

/** Acrescenta tags (as já presentes são ignoradas). */
export function addTaskTags(task, tags, { by = 'você' } = {}) {
  const fresh = [];
  for (const raw of tags) {
    const tag = normalizeTag(raw);
    if (tag && !hasTag(task, tag) && !fresh.some((t) => foldTag(t) === foldTag(tag))) fresh.push(tag);
  }
  if (!fresh.length) return task;
  task.tags = [...tagsOf(task), ...fresh];
  logTask(task, by, 'edit', `Tags: ${fresh.map((t) => `+${t}`).join(' ')}`);
  commit();
  return task;
}

export function removeTaskTags(task, tags, { by = 'você' } = {}) {
  const out = new Set(tags.map(foldTag));
  const gone = tagsOf(task).filter((t) => out.has(foldTag(t)));
  if (!gone.length) return task;
  task.tags = tagsOf(task).filter((t) => !out.has(foldTag(t)));
  logTask(task, by, 'edit', `Tags: ${gone.map((t) => `−${t}`).join(' ')}`);
  commit();
  return task;
}
