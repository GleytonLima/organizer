// Motor do sync (docs/API.md → "Ordem recomendada no cliente"): envia as mudanças locais, depois
// puxa o que mudou no servidor. Roda a cada 30 s e logo após cada gravação local.
const { EventEmitter } = require('events');
const client = require('./client');
const rows = require('./rows');
const { syncEnabled, syncSettings } = require('./settings');
const { buildWorld, toServer, fromServer, sameContent } = require('./mapping');
const { syncProjects } = require('./project-sync');

const INTERVAL_MS = Number(process.env.BO_SYNC_INTERVAL_MS) || 30000;
const AFTER_WRITE_MS = 1500;
const BATCH = 200;

// 'status' (estado do sync) | 'changed' (memórias locais mudaram) | 'project' (id, { name?, columns? } do servidor)
const events = new EventEmitter();
let context = { projects: [] };
let status = { state: 'off', at: null, error: null };
let running = null;
let again = false;
let timer = null;

const setStatus = (next) => {
  status = { ...status, ...next };
  events.emit('status', status);
};

async function pushChanges(world) {
  const changes = [];
  const sources = []; // item local (upsert) ou tombstone (delete), na mesma ordem
  for (const item of rows.dirtyItems()) {
    const memory = toServer(item, world, rows.gidOf);
    if (!memory) continue; // só local (projeto sem syncKey, pasta sem remote)
    changes.push({ op: 'upsert', baseRev: item.rev, memory });
    sources.push(item);
  }
  for (const t of rows.tombstones()) {
    changes.push({ op: 'delete', baseRev: t.base_rev, id: t.gid });
    sources.push({ tombstone: true, gid: t.gid });
  }
  let changed = false;
  for (let i = 0; i < changes.length; i += BATCH) {
    const results = await client.push(changes.slice(i, i + BATCH));
    results.forEach((r, j) => (changed = applyResult(sources[i + j], r, world) || changed));
  }
  return changed;
}

/** Trata ok / conflict / error de uma mudança enviada. Retorna true se a memória local mudou. */
function applyResult(src, r, world) {
  if (src.tombstone) {
    rows.forgetTombstone(src.gid);
    // alguém editou o que você apagou: a versão dele volta (o servidor vence numa exclusão)
    if (r.status === 'conflict' && r.server && !r.server.deleted) return restore(r.server, world);
    return false;
  }
  if (r.status === 'ok') rows.markSent(src.gid, r.rev, src.updatedAt);
  else if (r.status === 'conflict') rows.markConflict(src.gid, r.server);
  else rows.markError(src.gid, r.error || 'Recusada pelo servidor.');
  return r.status !== 'ok';
}

function restore(server, world) {
  const row = fromServer(server, world, rows.byGid(server.id), rows.idOf);
  if (row) rows.writeServer(server.id, server.rev, row);
  return !!row;
}

/** Aplica uma memória recebida. O servidor vence onde não há mudança local pendente. */
function applyPulled(s, world) {
  const local = rows.byGid(s.id);
  if (s.deleted) {
    if (!local) return false;
    if (local.dirty) rows.markConflict(s.id, s);
    else rows.dropLocal(s.id);
    return true;
  }
  if (local?.dirty && local.rev !== s.rev) {
    if (!sameContent(toServer(local, world, rows.gidOf), s)) {
      rows.markConflict(s.id, s);
      return true;
    }
  } else if (local?.dirty) return false; // edição local sobre esta mesma versão: vai no próximo envio
  return restore(s, world);
}

async function pullChanges(world) {
  // workspaces/pastas novos (ou outro servidor) → puxa tudo de novo; aplicar é idempotente
  const scope = JSON.stringify([syncSettings().url, world.workspaces, world.folders]);
  let since = rows.getMeta('scope') === scope ? Number(rows.getMeta('lastRev') || 0) : 0;
  let changed = false;
  for (;;) {
    const page = await client.pull({ since, workspaces: world.workspaces, folders: world.folders });
    for (const s of page.items) changed = applyPulled(s, world) || changed;
    since = page.rev;
    if (!page.more) break;
  }
  rows.setMeta('scope', scope);
  rows.setMeta('lastRev', since);
  return changed;
}

/** Uma rodada completa. Chamadas durante uma rodada agendam outra logo em seguida. */
function syncNow() {
  if (!syncEnabled()) {
    setStatus({ state: 'off', error: null });
    return Promise.resolve(status);
  }
  if (running) {
    again = true;
    return running;
  }
  setStatus({ state: 'syncing' });
  running = (async () => {
    const world = await buildWorld(context);
    const pushed = await pushChanges(world);
    const pulled = await pullChanges(world);
    await syncProjects(context, (id, changed) => events.emit('project', id, changed));
    setStatus({ state: 'ok', at: Date.now(), error: null });
    if (pushed || pulled) events.emit('changed');
    return status;
  })()
    .catch((err) => {
      setStatus({ state: 'error', at: Date.now(), error: err.message });
      return status;
    })
    .finally(() => {
      running = null;
      if (again) {
        again = false;
        schedule(500);
      }
    });
  return running;
}

/** Próxima rodada daqui a `ms` (substitui a agendada). */
function schedule(ms = INTERVAL_MS) {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    await syncNow();
    schedule();
  }, ms);
}

const afterWrite = () => syncEnabled() && schedule(AFTER_WRITE_MS);
const stop = () => clearTimeout(timer);

/** Projetos (com syncKey e pastas) vindos do renderer. Mudou? Sincroniza logo. */
function setContext(next) {
  const changed = JSON.stringify(next) !== JSON.stringify(context);
  context = next || { projects: [] };
  if (changed && syncEnabled()) schedule(AFTER_WRITE_MS);
}

module.exports = { events, syncNow, schedule, afterWrite, stop, setContext, getContext: () => context, getStatus: () => status, restore };
