// Sync da memória (lado do renderer): envia ao processo principal os projetos com chave de
// sincronização e suas pastas, e reflete o estado do sync e as memórias que chegaram do servidor.
import { store, subscribe, notify, projects } from '../core/store.js';
import { invalidateMemory } from '../ui/memory/state.js';

export const syncView = { status: { state: 'off', at: null, error: null } };

let lastSent = '';

function sendContext() {
  const ctx = {
    projects: projects().map((p) => ({ id: p.id, name: p.name, syncKey: p.syncKey || '', folders: (p.repos || []).map((r) => r.path) })),
  };
  const json = JSON.stringify(ctx);
  if (json === lastSent) return;
  lastSent = json;
  api.sync.setContext(ctx);
}

export async function initMemorySync() {
  api.memory.onChanged(invalidateMemory);
  api.sync.onStatus((s) => {
    syncView.status = s;
    notify();
  });
  syncView.status = await api.sync.status();
  subscribe(sendContext);
  if (store.state) sendContext();
}

/** Linha de estado para o rodapé da aba Memória (null quando o sync está desligado). */
export function syncLine() {
  const { state, at, error } = syncView.status;
  if (state === 'off') return null;
  if (state === 'error') return { error: true, text: `sync com erro: ${error}` };
  if (state === 'syncing') return { text: 'sincronizando…' };
  return { text: at ? `sincronizado às ${new Date(at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'sincronizado' };
}
