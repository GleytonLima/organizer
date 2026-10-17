// Cartão de uma memória na aba Memória: corpo, marcas (conflito, a revisar, não sincronizada),
// estado da ideia, vínculos e menu de ações.
import { el } from '../../core/dom.js';
import { timeAgo } from '../../core/format.js';
import { scopeLabel } from '../../memory/context.js';
import { kindOf, IDEA_STATUS } from '../../memory/kinds.js';
import { ideaToTask, setIdeaStatus } from '../../actions/idea-task.js';
import { iconButton } from '../components.js';
import { icon } from '../icons.js';
import { showMenu } from '../menu.js';
import { newMemoryDialog, editMemoryDialog, deleteMemory } from './dialogs.js';
import { resolveConflictDialog, resumeTask } from './sync-dialogs.js';
import { linksDialog, reviewDialog } from './impact.js';
import { progressBody } from './progress.js';

function ideaActions(project, m) {
  if (m.kind !== 'idea') return [];
  if ((m.status || 'open') !== 'open') return [{ label: 'Reabrir ideia', action: () => setIdeaStatus(m, 'open') }];
  return [
    { label: 'Virar tarefa', action: () => ideaToTask(project, m) },
    { label: 'Descartar ideia', action: () => setIdeaStatus(m, 'discarded') },
  ];
}

function itemMenu(e, project, m) {
  const edit = () => editMemoryDialog(project, m);
  showMenu(e, [
    m.conflict ? { label: 'Resolver conflito…', action: () => resolveConflictDialog(m) } : null,
    m.review ? { label: 'Revisar…', action: () => reviewDialog(m, edit) } : null,
    m.kind === 'progress' ? { label: 'Retomar tarefa…', action: () => resumeTask(project, m) } : { label: 'Editar…', action: edit },
    ...ideaActions(project, m),
    m.kind === 'decision' ? { label: 'Substituir por nova decisão…', action: () => newMemoryDialog(project, 'decision', { supersedes: m }) } : null,
    { label: 'Vínculos e impacto…', action: () => linksDialog(m) },
    { label: 'Copiar texto', action: () => api.clipboardWrite(m.text) },
    { sep: true },
    { label: 'Excluir', danger: true, action: () => deleteMemory(m) },
  ]);
}

/** Marcas: conflito e "a revisar" (clique resolve) ou recusa do servidor. */
function marks(project, m) {
  if (m.conflict) return el('button', { class: 'mem-flag', onclick: () => resolveConflictDialog(m), text: 'em conflito — resolver' });
  if (m.review) return el('button', { class: 'mem-flag', title: m.review.reason, onclick: () => reviewDialog(m, () => editMemoryDialog(project, m)), text: 'a revisar' });
  if (m.syncError) return el('span', { class: 'mem-flag', title: m.syncError, text: 'não sincronizada' });
  return null;
}

function openItem(project, m) {
  if (m.conflict) return resolveConflictDialog(m);
  if (m.review) return reviewDialog(m, () => editMemoryDialog(project, m));
  return m.kind === 'progress' ? resumeTask(project, m) : editMemoryDialog(project, m);
}

export function memoryItem(project, m) {
  const where = scopeLabel(project, m); // "global" / "pasta backend"; projeto = sem rótulo
  const status = m.kind === 'idea' && m.status && m.status !== 'open' ? IDEA_STATUS[m.status] : null;
  const meta = [m.scope === 'project' ? m.repo : null, m.kind === 'progress' ? null : m.taskKey, status, m.source, timeAgo(m.updatedAt)].filter(Boolean).join(' · ');
  return el(
    'article',
    { class: `mem-item ${m.kind}`, ondblclick: () => openItem(project, m), oncontextmenu: (e) => itemMenu(e, project, m) },
    icon(kindOf(m.kind).icon, 'mem-icon'),
    el(
      'div',
      { class: 'mem-text' },
      m.kind === 'progress' ? progressBody(m) : el('div', { class: 'mem-body', text: m.text }),
      marks(project, m),
      el(
        'div',
        { class: 'mem-meta' },
        where ? el('span', { class: `mem-scope ${m.scope}`, text: where }) : null,
        m.refs?.length ? el('span', { class: 'mem-linked', title: 'Tem vínculos — veja em “Vínculos e impacto”' }, icon('link')) : null,
        meta,
      ),
      m.tags.length ? el('div', { class: 'mem-tags' }, m.tags.map((t) => el('span', { class: 'mem-tag', text: t }))) : null,
    ),
    iconButton('more', 'Opções', (e) => itemMenu(e, project, m), 'reveal'),
  );
}
