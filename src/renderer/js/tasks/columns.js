// Colunas do quadro: configuráveis por projeto (nome + descrição). A descrição orienta o agente
// a escolher para onde mover uma tarefa. Convenções: a 1ª coluna recebe tarefas novas;
// a última é a de concluído (complete_task move para ela).
import { uid } from '../core/model.js';

export const DEFAULT_COLUMNS = () => [
  { id: uid(), name: 'A fazer', description: 'Tarefas registradas que ainda não começaram.' },
  { id: uid(), name: 'Fazendo', description: 'Em execução agora.' },
  { id: uid(), name: 'Feito', description: 'Concluídas.' },
];

/** Colunas do projeto (cria as iniciais na primeira vez). */
export function columnsOf(project) {
  if (!project.taskColumns?.length) project.taskColumns = DEFAULT_COLUMNS();
  return project.taskColumns;
}

export const firstColumn = (project) => columnsOf(project)[0];
export const lastColumn = (project) => columnsOf(project).at(-1);
export const columnById = (project, id) => columnsOf(project).find((c) => c.id === id) || null;
export const isDoneColumn = (project, id) => lastColumn(project).id === id;

const plain = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Coluna por id ou nome (sem diferenciar acentos/maiúsculas). */
export function resolveColumn(project, ref) {
  const key = plain(ref);
  const col = columnsOf(project).find((c) => c.id === ref || plain(c.name) === key);
  if (!col) {
    const names = columnsOf(project).map((c) => `"${c.name}"`).join(', ');
    throw new Error(`Coluna não encontrada: "${ref}". Colunas de ${project.name}: ${names}`);
  }
  return col;
}
