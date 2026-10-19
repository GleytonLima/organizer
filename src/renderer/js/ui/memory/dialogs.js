// Diálogos da memória: nova/editar (decisão, nota, ideia, como fazer), substituir decisão e excluir.
// Ao mudar uma memória de que outras dependem, oferece marcar a cadeia de impacto "a revisar".
import { projectRepos } from '../../git/git.js';
import { folderLabel } from '../../memory/context.js';
import { kindOf } from '../../memory/kinds.js';
import { cleanError } from '../../core/errors.js';
import { openModal, field } from '../modal.js';
import { confirmDanger } from '../confirm.js';
import { invalidateMemory } from './state.js';
import { linksField, linksOf, toRefs } from './links-field.js';
import { offerImpact } from './impact.js';

// "Onde vale": projeto (padrão), uma das pastas do projeto (vale em qualquer projeto que a inclua) ou global.
const whereOptions = (project, item) => {
  const folders = projectRepos(project).map((r) => ({ value: `folder:${r.path}`, label: `Pasta ${r.name} (em qualquer projeto que a use)` }));
  // uma memória de pasta que não está mais neste projeto continua selecionável
  if (item?.scope === 'folder' && !folders.some((f) => f.value === `folder:${item.folder}`)) {
    folders.push({ value: `folder:${item.folder}`, label: `Pasta ${folderLabel(project, item.folder)}` });
  }
  return [{ value: 'project', label: `Projeto ${project.name}` }, ...folders, { value: 'global', label: 'Global — vale em todos os projetos' }];
};
const whereOf = (item, fallback = 'project') => (!item ? fallback : item.scope === 'folder' ? `folder:${item.folder}` : item.scope || 'project');
const parseWhere = (where) => (where.startsWith('folder:') ? { scope: 'folder', folder: where.slice(7) } : { scope: where });

/** Executa a gravação; em erro, mostra a mensagem. Devolve o item gravado (ou null). */
async function save(run) {
  try {
    const item = await run();
    invalidateMemory();
    return item;
  } catch (err) {
    await openModal({ title: 'Não foi possível salvar', message: cleanError(err) });
    return null;
  }
}

function memoryFields(project, kind, item, links, where = 'project') {
  const k = kindOf(kind);
  return [
    k.single
      ? field.text('text', k.label, item?.text || '', { hint: k.hint, max: k.max })
      : field.textarea('text', k.label, item?.text || '', { rows: 5, hint: k.hint, max: k.max }),
    field.select('where', 'Onde vale', whereOf(item, where), { options: whereOptions(project, item) }),
    field.text('tags', 'Tags', item?.tags?.join(', ') || '', { placeholder: 'banco, infra' }),
    linksField(project, links, { selfGid: item?.gid }),
  ];
}

/**
 * Nova memória do tipo `kind`; com `supersedes`, a nova decisão substitui a anterior (e herda os vínculos).
 * `where`: escopo já escolhido no diálogo ('project' por padrão; 'global' na visão Global da aba).
 */
export async function newMemoryDialog(project, kind, { supersedes = null, where = 'project' } = {}) {
  const links = supersedes ? await linksOf(supersedes) : [];
  const v = await openModal({
    title: supersedes ? 'Substituir decisão' : kindOf(kind).newTitle,
    message: supersedes ? `Substitui: “${supersedes.text}”` : null,
    fields: memoryFields(project, kind, supersedes && { ...supersedes, text: '', gid: null }, links, where),
    submit: 'Salvar',
    wide: true,
  });
  if (!v?.text?.trim()) return;
  const item = await save(() =>
    api.memory.add({
      ...parseWhere(v.where), projectId: project.id, project: project.name, kind, text: v.text, tags: v.tags, source: 'você',
      supersedes: supersedes?.id, refs: toRefs(v.links),
    }),
  );
  if (item && supersedes) await offerImpact(supersedes, `Substituída por: ${item.text}`);
}

export async function editMemoryDialog(project, item) {
  const v = await openModal({
    title: kindOf(item.kind).editTitle,
    fields: memoryFields(project, item.kind, item, await linksOf(item)),
    submit: 'Salvar',
    extra: { label: 'Excluir', value: 'delete', danger: true },
    wide: true,
  });
  if (v === 'delete') return deleteMemory(item);
  if (!v) return;
  const saved = await save(() =>
    api.memory.update(item.id, { ...parseWhere(v.where), projectId: item.projectId || project.id, text: v.text, tags: v.tags, refs: toRefs(v.links) }),
  );
  if (saved && saved.text !== item.text) await offerImpact(saved, `Mudou: ${saved.text}`);
}

/** Muda só onde a memória vale: global (todos os projetos) ou este projeto. */
export const moveMemory = (project, item, scope) => save(() => api.memory.update(item.id, scope === 'global' ? { scope: 'global' } : { scope: 'project', projectId: project.id }));

export async function deleteMemory(item) {
  const ok = await confirmDanger({ title: `Excluir ${kindOf(item.kind).label.toLowerCase()}?`, message: item.text });
  if (ok) await save(() => api.memory.remove(item.id));
}
