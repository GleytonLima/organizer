// IPC do sync do quadro de tarefas. A lógica (o que mudou, fusão, aplicar) fica no renderer, que é
// dono das tarefas (tasks/sync.js); aqui só o acesso ao servidor e o estado salvo:
// <userData>/sync-tasks.json = { url, scope, lastRev, bases: { id: { ws, rev, key, doc } } }.
const { ipcMain } = require('electron');
const client = require('./client');
const { syncEnabled, syncSettings } = require('./settings');
const { userFile, readJson, writeJsonAtomic } = require('../files');

const FILE = () => userFile('sync-tasks.json');
const BATCH = 200;
let me = null; // { url, name }: o nome que vai no histórico no lugar de "você"

/** Estado salvo; outro servidor = começa do zero (as bases eram de lá). */
function loadState() {
  const url = syncSettings().url;
  const s = readJson(FILE(), {});
  return s.url === url ? s : { url, scope: '', lastRev: 0, bases: {} };
}

async function myName() {
  const url = syncSettings().url;
  if (me?.url !== url) me = { url, name: (await client.me()).name };
  return me.name;
}

async function pushAll(changes) {
  const out = [];
  for (let i = 0; i < changes.length; i += BATCH) out.push(...(await client.pushTasks(changes.slice(i, i + BATCH))));
  return out;
}

function registerTasksSyncIpc() {
  ipcMain.handle('sync:tasksEnabled', () => syncEnabled());
  ipcMain.handle('sync:me', () => myName());
  ipcMain.handle('sync:tasksState', () => loadState());
  ipcMain.handle('sync:saveTasksState', (_e, state) => writeJsonAtomic(FILE(), { ...state, url: syncSettings().url }));
  ipcMain.handle('sync:tasksPull', (_e, body) => client.pullTasks(body));
  ipcMain.handle('sync:tasksPush', (_e, changes) => pushAll(changes));
}

module.exports = { registerTasksSyncIpc };
