// Sync da memória (lado do renderer): envia ao processo principal os projetos com chave de
// sincronização e suas pastas, e reflete o estado do sync e as memórias que chegaram do servidor.
import { store, subscribe, notify, projects } from '../core/store.js';
import { invalidateMemory } from '../ui/memory/state.js';
import { applyServerProject } from '../actions/project-server.js';

export const syncView = { status: { state: 'off', at: null, error: null } };

let lastSent = '';

// Projetos com o que o sync precisa: pastas (memória de pasta) e, com syncKey, a definição do
// projeto e o seu layout (trocar de máquina). Terminais de agente ficam de fora do layout.
const projectContext = (p) => ({
  id: p.id,
  name: p.name,
  syncKey: p.syncKey || '',
  folders: (p.repos || []).map((r) => r.path),
  ...(p.syncKey && {
    repos: (p.repos || []).map(({ name, path }) => ({ name, path })),
    columns: p.taskColumns || [],
    groups: p.groups.map((g) => ({
      name: g.name,
      terminals: g.terminals.filter((t) => t.kind !== 'agent').map(({ name, cwd, startup, color }) => ({ name, cwd, startup, color })),
    })),
  }),
});

function sendContext() {
  const ctx = { projects: projects().map(projectContext) };
  const json = JSON.stringify(ctx);
  if (json === lastSent) return;
  lastSent = json;
  api.sync.setContext(ctx);
}

export async function initMemorySync() {
  api.memory.onChanged(invalidateMemory);
  api.sync.onProject(applyServerProject);
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
