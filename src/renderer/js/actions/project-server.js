// O que chega do servidor para um projeto que você já tem (sync da definição do projeto):
// nome e colunas do quadro, que são do time. Pastas novas do time não entram sozinhas — elas
// precisam de um clone nesta máquina (ver project-remote.js, "Abrir projeto do servidor").
import { store, commit, projectById } from '../core/store.js';
import { saveColumns } from './tasks.js';

const same = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();

/** Troca as colunas pelas do servidor; tarefas seguem a coluna de mesmo id ou de mesmo nome. */
export function applyServerColumns(project, columns) {
  if (!columns?.length) return;
  const before = project.taskColumns || [];
  const next = columns.map(({ id, name, description }) => ({ id, name, description: description || '' }));
  for (const t of store.state.tasks) {
    if (t.projectId !== project.id || next.some((c) => c.id === t.columnId)) continue;
    const old = before.find((c) => c.id === t.columnId);
    const match = old && next.find((c) => same(c.name, old.name));
    if (match) t.columnId = match.id;
  }
  saveColumns(project, next); // as que sobrarem vão para a primeira coluna
}

/** Recebe { name?, columns? } vindo do sync para o projeto `id`. */
export function applyServerProject(id, changed) {
  const project = projectById(id);
  if (!project) return;
  if (changed.name) project.name = changed.name;
  if (changed.columns?.length) applyServerColumns(project, changed.columns);
  else commit();
}
