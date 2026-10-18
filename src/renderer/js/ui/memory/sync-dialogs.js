// Diálogos do sync da memória: resolver conflito e retomar tarefa (progresso). A conexão com o
// servidor fica em Configurações → Servidor do time (ui/settings/server.js).
import { el } from '../../core/dom.js';
import { cleanError } from '../../core/errors.js';
import { openModal, field } from '../modal.js';
import { invalidateMemory } from './state.js';
import { resumeFromProgress } from '../../tasks/claim.js';

const alert = (title, message) => openModal({ title, message });

const versionBox = (label, text) => el('div', { class: 'mem-version' }, el('div', { class: 'mem-version-label', text: label }), el('div', { class: 'mem-version-text', text }));

/** Conflito: a sua versão × a do servidor. Editar o texto e salvar grava uma mescla. */
export async function resolveConflictDialog(m) {
  const server = m.conflict;
  const who = server.author?.name ? ` (${server.author.name})` : '';
  const v = await openModal({
    title: 'Memória em conflito',
    message: 'Ela mudou no servidor enquanto você a editava. Fique com a sua, aceite a do servidor ou edite uma mescla.',
    content: versionBox(`Servidor${who}`, server.deleted ? '(apagada no servidor)' : server.text),
    fields: [field.textarea('text', 'A sua versão (edite para mesclar)', m.text, { rows: 4 })],
    submit: 'Ficar com esta',
    extra: { label: 'Aceitar a do servidor', value: 'server' },
    wide: true,
  });
  if (!v) return;
  try {
    if (v === 'server') await api.sync.resolve(m.id, 'server');
    else await api.sync.resolve(m.id, v.text.trim() === m.text ? 'mine' : 'merge', v.text.trim());
    invalidateMemory();
  } catch (err) {
    await alert('Não foi possível resolver', cleanError(err));
  }
}

/** "Retomar": você vira o dono da tarefa no servidor e ela entra no seu quadro. */
export async function resumeTask(project, m) {
  const owner = m.progress?.owner?.name;
  const ok = await openModal({
    title: `Retomar ${m.taskKey}?`,
    message: `${owner ? `Hoje com ${owner}. ` : ''}Você passa a ser o dono e a tarefa entra no seu quadro com o status e os próximos passos.`,
    submit: 'Retomar',
  });
  if (!ok) return;
  try {
    const claimed = await api.sync.claim(m.id);
    const task = await resumeFromProgress(project, claimed); // com o quadro do time: adota a tarefa que já existe
    invalidateMemory();
    await alert('Tarefa retomada', `${task.key} está no seu quadro.`);
  } catch (err) {
    await alert('Não foi possível retomar', cleanError(err));
  }
}
