// Sugestões de memória numa tarefa (task.memorySuggestions): a consolidação do curto para o longo
// prazo. O agente propõe (suggest_memory) uma decisão, um "como fazer" ou uma nota a partir do que
// fez; nada é gravado até você aceitar — aceita, vira memória do projeto vinculada à tarefa.
import { commit } from '../core/store.js';
import { taskProject } from '../tasks/queries.js';
import { logTask } from '../tasks/history.js';
import { linkTaskMemories } from './task-memories.js';
import { invalidateMemory } from '../ui/memory/state.js';
import { uid } from '../core/model.js';

export const SUGGESTION_KINDS = { decision: 'Decisão', howto: 'Como fazer', note: 'Nota' };
const MAX_PENDING = 5;
const DECISION_MAX = 280;

const short = (text) => {
  const cut = text.length > 60 ? `${text.slice(0, 60)}…` : text;
  return `“${cut}”`;
};

function validate(kind, text) {
  if (!SUGGESTION_KINDS[kind]) throw new Error(`Tipo de sugestão inválido: use ${Object.keys(SUGGESTION_KINDS).join(', ')}.`);
  if (!text) throw new Error('A sugestão precisa de um texto.');
  if (kind === 'decision' && (text.length > DECISION_MAX || text.includes('\n'))) {
    throw new Error(`Decisão é uma frase só, com o porquê (até ${DECISION_MAX} caracteres, sem quebras de linha).`);
  }
}

/** O agente (ou você) propõe uma memória para a tarefa. */
export function suggestMemory(task, { kind = 'decision', text, tags = [] }, { by = 'agente' } = {}) {
  const clean = String(text || '').trim();
  validate(kind, clean);
  const pending = (task.memorySuggestions ||= []);
  if (pending.length >= MAX_PENDING) throw new Error(`Já há ${MAX_PENDING} sugestões esperando o usuário nesta tarefa.`);
  if (pending.some((s) => s.text === clean)) throw new Error('Essa sugestão já está na tarefa.');
  const item = { id: uid(), kind, text: clean, tags: tags.map(String).filter(Boolean), by, at: Date.now() };
  pending.push(item);
  logTask(task, by, 'edit', `Sugeriu ${SUGGESTION_KINDS[kind].toLowerCase()}: ${short(clean)}`);
  commit();
  return item;
}

function take(task, id) {
  const item = (task.memorySuggestions || []).find((s) => s.id === id);
  if (!item) throw new Error('Sugestão não encontrada (já foi aceita ou descartada?).');
  task.memorySuggestions = task.memorySuggestions.filter((s) => s !== item);
  return item;
}

/** Aceita (com o texto que você editou, se for o caso): vira memória do projeto vinculada à tarefa. */
export async function acceptSuggestion(task, id, { text } = {}) {
  const item = (task.memorySuggestions || []).find((s) => s.id === id);
  if (!item) throw new Error('Sugestão não encontrada (já foi aceita ou descartada?).');
  const final = String(text ?? item.text).trim();
  validate(item.kind, final);
  const project = taskProject(task);
  const memory = await api.memory.add({
    scope: 'project', projectId: project.id, project: project.name, repo: task.repo || null,
    kind: item.kind, text: final, tags: item.tags.join(','), source: item.by, taskKey: task.key,
  });
  take(task, id);
  await linkTaskMemories(task, [memory.gid], { by: 'você' });
  logTask(task, 'você', 'edit', `Aceitou a sugestão: ${short(final)}`);
  commit();
  invalidateMemory();
  return memory;
}

export function discardSuggestion(task, id) {
  const item = take(task, id);
  logTask(task, 'você', 'edit', `Descartou a sugestão: ${short(item.text)}`);
  commit();
  return item;
}
