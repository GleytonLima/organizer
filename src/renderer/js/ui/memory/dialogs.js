// Diálogos da memória: nova/editar nota ou decisão, substituir decisão e configurar embeddings.
import { projectRepos } from '../../git/git.js';
import { folderLabel } from '../../memory/context.js';
import { cleanError } from '../../core/errors.js';
import { openModal, field } from '../modal.js';
import { confirmDanger } from '../confirm.js';
import { invalidateMemory } from './state.js';

const DECISION_HINT = 'Uma frase com o porquê (máx. 280). Ex.: "Usamos Postgres porque o time já domina."';

// "Onde vale": projeto (padrão), uma das pastas do projeto (vale em qualquer projeto que a inclua) ou global.
const whereOptions = (project, item) => {
  const folders = projectRepos(project).map((r) => ({ value: `folder:${r.path}`, label: `Pasta ${r.name} (em qualquer projeto que a use)` }));
  // uma memória de pasta que não está mais neste projeto continua selecionável
  if (item?.scope === 'folder' && !folders.some((f) => f.value === `folder:${item.folder}`)) {
    folders.push({ value: `folder:${item.folder}`, label: `Pasta ${folderLabel(project, item.folder)}` });
  }
  return [{ value: 'project', label: `Projeto ${project.name}` }, ...folders, { value: 'global', label: 'Global (todos os projetos)' }];
};
const whereOf = (item) => (!item ? 'project' : item.scope === 'folder' ? `folder:${item.folder}` : item.scope || 'project');
const parseWhere = (where) => (where.startsWith('folder:') ? { scope: 'folder', folder: where.slice(7) } : { scope: where });

async function save(run) {
  try {
    await run();
    invalidateMemory();
  } catch (err) {
    await openModal({ title: 'Não foi possível salvar', message: cleanError(err) });
  }
}

/** Nova memória (`kind`: 'decision' | 'note'); com `supersedes`, a nova decisão substitui a anterior. */
export async function newMemoryDialog(project, kind, { supersedes = null } = {}) {
  const decision = kind === 'decision';
  const v = await openModal({
    title: supersedes ? 'Substituir decisão' : decision ? 'Nova decisão' : 'Nova nota',
    message: supersedes ? `Substitui: “${supersedes.text}”` : null,
    fields: [
      decision ? field.text('text', 'Decisão', '', { hint: DECISION_HINT }) : field.textarea('text', 'Nota', '', { rows: 5 }),
      field.select('where', 'Onde vale', whereOf(supersedes), { options: whereOptions(project, supersedes) }),
      field.text('tags', 'Tags', supersedes?.tags?.join(', ') || '', { placeholder: 'banco, infra' }),
    ],
    submit: 'Salvar',
  });
  if (!v?.text?.trim()) return;
  await save(() =>
    api.memory.add({ ...parseWhere(v.where), projectId: project.id, project: project.name, kind, text: v.text, tags: v.tags, source: 'você', supersedes: supersedes?.id }),
  );
}

export async function editMemoryDialog(project, item) {
  const decision = item.kind === 'decision';
  const v = await openModal({
    title: decision ? 'Editar decisão' : 'Editar nota',
    fields: [
      decision ? field.text('text', 'Decisão', item.text, { hint: DECISION_HINT }) : field.textarea('text', 'Nota', item.text, { rows: 6 }),
      field.select('where', 'Onde vale', whereOf(item), { options: whereOptions(project, item) }),
      field.text('tags', 'Tags', item.tags.join(', ')),
    ],
    submit: 'Salvar',
    extra: { label: 'Excluir', value: 'delete', danger: true },
  });
  if (v === 'delete') return deleteMemory(item);
  if (!v) return;
  await save(() => api.memory.update(item.id, { ...parseWhere(v.where), projectId: item.projectId || project.id, text: v.text, tags: v.tags }));
}

export async function deleteMemory(item) {
  const ok = await confirmDanger({ title: item.kind === 'decision' ? 'Excluir decisão?' : 'Excluir nota?', message: item.text });
  if (ok) await save(() => api.memory.remove(item.id));
}

/** Embeddings opcionais: provedor, URL, modelo e chave (guardada criptografada). */
export async function embeddingsDialog() {
  const s = await api.memory.settings();
  const v = await openModal({
    title: 'Busca por similaridade (embeddings)',
    message: 'Opcional. A busca por texto funciona sempre; com embeddings, ela também encontra memórias por significado.',
    fields: [
      field.select('provider', 'Provedor', s.provider, {
        options: [
          { value: 'off', label: 'Desligado (só texto)' },
          { value: 'ollama', label: 'Ollama (local, gratuito)' },
          { value: 'openai', label: 'API compatível com OpenAI' },
        ],
      }),
      field.text('url', 'URL', s.provider === 'off' ? '' : s.url, { placeholder: 'padrão do provedor', mono: true }),
      field.text('model', 'Modelo', s.provider === 'off' ? '' : s.model, { placeholder: 'nomic-embed-text / text-embedding-3-small', mono: true }),
      field.text('apiKey', 'Chave de API (só OpenAI)', '', { placeholder: s.hasKey ? '•••••• (guardada; deixe vazio para manter)' : '', mono: true }),
    ],
    submit: 'Salvar e testar',
  });
  if (!v) return;
  await save(() => api.memory.saveSettings(v));
  if (v.provider === 'off') return;
  try {
    const r = await api.memory.testEmbeddings();
    await openModal({ title: 'Embeddings funcionando', message: `${r.model}: vetores de ${r.dimensions} dimensões. As memórias existentes estão sendo indexadas em segundo plano.` });
  } catch (err) {
    await openModal({ title: 'Embeddings indisponíveis', message: `${cleanError(err)} — a busca por texto continua funcionando.` });
  }
}
