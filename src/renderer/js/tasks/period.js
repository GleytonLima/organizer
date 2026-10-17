// Período da lista/quadro de tarefas (a lista cresce): por padrão, a última semana.
// Conta a última atividade (updatedAt). Tarefas em aberto — fora da coluna final — aparecem
// sempre, para nada pendente sumir; o período recorta as concluídas.
import { store, commit } from '../core/store.js';
import { isDoneColumn } from './columns.js';

const DAY = 86400000;

export const PERIODS = [
  { id: '7d', label: 'Última semana', days: 7 },
  { id: '30d', label: 'Último mês', days: 30 },
  { id: '90d', label: 'Últimos 3 meses', days: 90 },
  { id: 'all', label: 'Todo o período', days: null },
];

export const currentPeriod = () => PERIODS.find((p) => p.id === store.state.taskPeriod) || PERIODS[0];

export function setTaskPeriod(id) {
  store.state.taskPeriod = id;
  commit();
}

/** A tarefa entra na lista do período atual? */
export function inPeriod(project, task, period = currentPeriod()) {
  if (!period.days || !isDoneColumn(project, task.columnId)) return true;
  return task.updatedAt >= Date.now() - period.days * DAY;
}
