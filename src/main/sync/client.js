// Cliente HTTP do bo-memory-server (contrato em bo-memory-server/docs/API.md).
const { syncSettings } = require('./settings');

const TIMEOUT_MS = 15000;

// `allow404`: devolve { status: 404 } em vez de lançar (documento que ainda não existe).
async function call(method, path, body, { allow404 = false } = {}) {
  const { url, token } = syncSettings();
  if (!url || !token) throw new Error('Sincronização não configurada (servidor e token).');
  let res;
  try {
    res = await fetch(`${url}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body && { 'Content-Type': 'application/json' }) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new Error(`Servidor de memória inacessível (${url}): ${err.cause?.code || err.message}`);
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error('Token recusado pelo servidor (inválido ou revogado).');
  if (allow404 && res.status === 404) return { status: 404, data: null };
  if (!res.ok && res.status !== 409) throw new Error(data.error || `Servidor respondeu ${res.status}.`);
  return { status: res.status, data };
}

const me = async () => (await call('GET', '/v1/me')).data;
const pull = async (body) => (await call('POST', '/v1/sync/pull', body)).data;
const push = async (changes) => (await call('POST', '/v1/sync/push', { changes })).data.results;
const claim = async (workspace, taskKey) =>
  (await call('POST', `/v1/progress/${encodeURIComponent(workspace)}/${encodeURIComponent(taskKey)}/claim`)).data;

// Projeto (do workspace) e layout (seu) para trocar de máquina — docs/API.md → "Projeto e layout".
const docPath = (workspace, which) => `/v1/workspaces/${encodeURIComponent(workspace)}/${which}`;
const getDoc = async (workspace, which) => (await call('GET', docPath(workspace, which), null, { allow404: true })).data;
/** { status: 200 | 409, data } — 409 traz { server }. */
const putDoc = (workspace, which, doc, baseVersion) => call('PUT', docPath(workspace, which), { ...doc, baseVersion });
const workspaces = async () => (await call('GET', '/v1/workspaces')).data.items || [];

// Quadro de tarefas do workspace — docs/API.md → "Quadro de tarefas".
const pullTasks = async (body) => (await call('POST', '/v1/tasks/pull', body)).data;
const pushTasks = async (changes) => (await call('POST', '/v1/tasks/push', { changes })).data.results;

/** "Retomar" uma tarefa do quadro: você vira o dono. null se ela ainda não está no servidor. */
const claimTask = async (workspace, id) =>
  (await call('POST', `/v1/tasks/${encodeURIComponent(workspace)}/${encodeURIComponent(id)}/claim`, null, { allow404: true })).data;

module.exports = { me, pull, push, claim, getDoc, putDoc, workspaces, pullTasks, pushTasks, claimTask };
