// Sync do quadro de tarefas com o workspace (docs/API.md → "Quadro de tarefas"). O renderer é dono
// das tarefas; o processo principal só fala com o servidor e guarda o estado (tasks-ipc.js).
// Rodada: envia o que mudou desde a última versão recebida (a "base"), funde os conflitos sem
// perguntar (sync-doc.js) e aplica o que chegou. Roda depois de cada rodada do sync da memória
// e logo após mudanças locais (só o envio).
import { store, commit, subscribe, projects } from '../core/store.js';
import { makeTask } from '../core/model.js';
import { columnsOf } from './columns.js';
import { logTask } from './history.js';
import { toDoc, fromDoc, mergeDocs, sameDoc } from './sync-doc.js';

const AFTER_EDIT_MS = 1500;
let running = null;
let again = false;
let timer = null;
let meName = null; // seu nome no servidor (o dono das tarefas é comparado com ele)

/** Seu nome no servidor, depois da primeira rodada (null antes). */
export const myServerName = () => meName;

const synced = () => projects().filter((p) => p.syncKey);
const projectOfKey = (key) => synced().find((p) => p.syncKey === key);

/** Mantém a sequência de chaves do projeto à frente das que já existem ("BO-27" → taskSeq ≥ 27). */
function bumpSeq(project, key) {
  const n = Number(/-(\d+)$/.exec(key)?.[1]);
  if (n > (project.taskSeq || 0)) project.taskSeq = n;
}

// O dono (`owner`) vem do servidor e não faz parte do documento: só o claim o muda.
function applyDoc(task, item, me) {
  Object.assign(task, fromDoc(item.task, me), { key: item.key }, item.owner !== undefined && { owner: item.owner });
}

function renameKey(task, key) {
  if (task.key === key) return;
  logTask(task, 'você', 'edit', `Chave renumerada de ${task.key} para ${key} (outra máquina já usava ${task.key})`);
  task.key = key;
}

function localChanges(state, me) {
  const changes = [];
  const live = new Set();
  for (const project of synced()) {
    for (const task of store.state.tasks.filter((t) => t.projectId === project.id)) {
      live.add(task.id);
      const base = state.bases[task.id];
      const doc = toDoc(task, me);
      if (!base || base.key !== task.key || !sameDoc(doc, base.doc)) {
        changes.push({ op: 'upsert', workspace: project.syncKey, baseRev: base?.rev || 0, id: task.id, key: task.key, task: doc });
      }
    }
  }
  const keys = new Set(synced().map((p) => p.syncKey));
  for (const [id, base] of Object.entries(state.bases)) {
    if (!live.has(id) && keys.has(base.ws)) changes.push({ op: 'delete', workspace: base.ws, baseRev: base.rev, id });
  }
  return changes;
}

/** Trata ok / conflict / error de cada mudança enviada. Devolve true se alguma tarefa local mudou. */
function applyResults(changes, results, state, me) {
  let changed = false;
  changes.forEach((c, i) => {
    const r = results[i];
    const task = store.state.tasks.find((t) => t.id === c.id);
    if (r.status === 'ok') {
      if (c.op === 'delete') delete state.bases[c.id];
      else {
        state.bases[c.id] = { ws: c.workspace, rev: r.rev, key: r.key, doc: c.task };
        const project = projectOfKey(c.workspace);
        if (project) bumpSeq(project, r.key); // a próxima chave daqui não repete a renumerada
        if (task && task.key !== r.key) {
          renameKey(task, r.key);
          changed = true;
        }
      }
    } else if (r.status === 'conflict') {
      const s = r.server;
      changed = true;
      if (s.deleted) state.bases[c.id] = { ws: c.workspace, rev: s.rev, key: s.key, doc: null }; // você editou o que apagaram: a sua volta
      else if (!task) restore(s, state, me); // você apagou o que editaram: a versão deles volta
      else {
        const merged = mergeDocs(state.bases[c.id]?.doc, c.task, s.task);
        state.bases[c.id] = { ws: c.workspace, rev: s.rev, key: s.key, doc: s.task };
        applyDoc(task, { task: merged, key: s.key, owner: s.owner }, me); // a fusão sobe na próxima rodada
      }
    } else console.warn(`sync de tarefas: ${c.id} recusada — ${r.error}`);
  });
  return changed;
}

function restore(item, state, me) {
  const project = projectOfKey(item.workspace);
  if (!project) return;
  let task = store.state.tasks.find((t) => t.id === item.id);
  if (!task) {
    task = makeTask({ id: item.id, projectId: project.id });
    store.state.tasks.push(task);
  }
  applyDoc(task, item, me);
  if (!columnsOf(project).some((c) => c.id === task.columnId)) task.columnId = columnsOf(project)[0].id;
  bumpSeq(project, item.key);
  state.bases[item.id] = { ws: item.workspace, rev: item.rev, key: item.key, doc: item.task };
}

function applyPulled(item, state, me) {
  const base = state.bases[item.id];
  if (base && base.rev >= item.rev) return false; // a nossa própria escrita voltando
  const task = store.state.tasks.find((t) => t.id === item.id);
  const dirty = task && (!base?.doc || !sameDoc(toDoc(task, me), base.doc));
  if (item.deleted) {
    if (task && dirty) return false; // você mexeu: a sua volta no próximo envio
    if (task) store.state.tasks = store.state.tasks.filter((t) => t !== task);
    for (const t of store.state.tasks) if (t.parentId === item.id) t.parentId = null;
    delete state.bases[item.id];
    return !!task;
  }
  if (task && dirty) {
    applyDoc(task, { task: mergeDocs(base?.doc, toDoc(task, me), item.task), key: item.key, owner: item.owner }, me);
    state.bases[item.id] = { ws: item.workspace, rev: item.rev, key: item.key, doc: item.task };
    return true;
  }
  restore(item, state, me);
  return true;
}

async function pullAll(state, me) {
  const workspaces = [...new Set(synced().map((p) => p.syncKey))].sort();
  const scope = workspaces.join(',');
  let since = state.scope === scope ? state.lastRev || 0 : 0; // workspace novo: puxa tudo
  let changed = false;
  for (;;) {
    const page = await api.sync.tasksPull({ since, workspaces });
    for (const item of page.items) changed = applyPulled(item, state, me) || changed;
    since = page.rev;
    if (!page.more) break;
  }
  Object.assign(state, { scope, lastRev: since });
  return changed;
}

/** Uma rodada (com `pull: false`, só o envio). Chamadas durante uma rodada agendam outra. */
export function syncTasksNow({ pull = true } = {}) {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    if (!synced().length || !(await api.sync.tasksEnabled())) return;
    const [state, me] = [await api.sync.tasksState(), await api.sync.me()];
    meName = me;
    const changes = localChanges(state, me);
    let changed = changes.length ? applyResults(changes, await api.sync.tasksPush(changes), state, me) : false;
    if (pull) changed = (await pullAll(state, me)) || changed;
    await api.sync.saveTasksState(state);
    if (changed) commit();
  })()
    .catch((err) => console.warn(`sync de tarefas: ${err.message}`))
    .finally(() => {
      running = null;
      if (again) {
        again = false;
        schedule(500);
      }
    });
  return running;
}

function schedule(ms, opts) {
  clearTimeout(timer);
  timer = setTimeout(() => syncTasksNow(opts), ms);
}

export function initTasksSync() {
  api.sync.onStatus((s) => s.state === 'ok' && schedule(0));
  let last = '';
  subscribe(() => {
    if (running || !synced().length) return;
    const sig = String(store.state.tasks.length) + store.state.tasks.reduce((m, t) => Math.max(m, t.updatedAt || 0), 0);
    if (sig !== last) {
      last = sig;
      schedule(AFTER_EDIT_MS, { pull: false });
    }
  });
}
