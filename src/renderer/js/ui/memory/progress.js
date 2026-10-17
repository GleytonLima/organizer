// Progresso de tarefa na aba Memória (item da lista) e o diálogo "Salvar progresso" da tarefa.
import { el } from '../../core/dom.js';
import { cleanError } from '../../core/errors.js';
import { openModal, field } from '../modal.js';
import { saveProgress } from '../../memory/progress.js';
import { invalidateMemory } from './state.js';

/** Corpo do item: tarefa e status, próximos passos e com quem está. */
export function progressBody(m) {
  const p = m.progress || {};
  const title = p.task?.title ? `${m.taskKey} · ${p.task.title}` : m.taskKey;
  return el(
    'div',
    { class: 'mem-progress' },
    el('div', { class: 'mem-progress-task', text: title }),
    el('div', { class: 'mem-body', text: p.status || m.text }),
    p.nextSteps?.length ? el('ul', { class: 'mem-steps' }, p.nextSteps.map((s) => el('li', { text: s }))) : null,
    p.owner?.name || p.branch ? el('div', { class: 'mem-meta', text: [p.owner?.name && `com ${p.owner.name}`, p.branch].filter(Boolean).join(' · ') }) : null,
  );
}

/** Salva o progresso da tarefa para retomar depois (você ou outro dev, em outra máquina). */
export async function saveProgressDialog(project, task) {
  const [current] = await api.memory.list({ projectId: project.id, kind: 'progress', taskKey: task.key, limit: 1 });
  const p = current?.progress || {};
  const v = await openModal({
    title: `Progresso de ${task.key}`,
    message: 'Para retomar depois — você ou outro dev, em outra máquina (projetos com chave de sincronização).',
    fields: [
      field.textarea('status', 'Onde parou', p.status || '', { rows: 3 }),
      field.textarea('nextSteps', 'Próximos passos (um por linha)', (p.nextSteps || []).join('\n'), { rows: 4 }),
    ],
    submit: 'Salvar progresso',
  });
  if (!v) return;
  try {
    await saveProgress(project, task, { status: v.status, nextSteps: v.nextSteps, cwd: project.cwd });
    invalidateMemory();
  } catch (err) {
    await openModal({ title: 'Não foi possível salvar', message: cleanError(err) });
  }
}
