// Cliente HTTP do bo-memory-server (contrato em bo-memory-server/docs/API.md).
const { syncSettings } = require('./settings');

const TIMEOUT_MS = 15000;

async function call(method, path, body) {
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
  if (!res.ok && res.status !== 409) throw new Error(data.error || `Servidor respondeu ${res.status}.`);
  return { status: res.status, data };
}

const me = async () => (await call('GET', '/v1/me')).data;
const pull = async (body) => (await call('POST', '/v1/sync/pull', body)).data;
const push = async (changes) => (await call('POST', '/v1/sync/push', { changes })).data.results;
const claim = async (workspace, taskKey) =>
  (await call('POST', `/v1/progress/${encodeURIComponent(workspace)}/${encodeURIComponent(taskKey)}/claim`)).data;

module.exports = { me, pull, push, claim };
