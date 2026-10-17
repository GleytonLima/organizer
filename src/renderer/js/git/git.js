// Status git por pasta, atualizado periodicamente para os terminais abertos.
import { openTerminals, notify } from '../core/store.js';

const POLL_MS = 3000;
const byCwd = new Map(); // cwd -> info | null

export const gitFor = (cwd) => byCwd.get(cwd) || null;
export const dirtyCount = (g) => (g ? g.changes + g.staged + g.untracked : 0);

export async function refreshGit(cwd) {
  if (cwd) byCwd.set(cwd, await api.gitStatus(cwd));
}

async function poll() {
  const cwds = new Set(openTerminals().map((x) => x.t.cwd).filter(Boolean));
  const before = JSON.stringify([...byCwd]);
  await Promise.all([...cwds].map(refreshGit));
  for (const k of byCwd.keys()) if (!cwds.has(k)) byCwd.delete(k);
  if (JSON.stringify([...byCwd]) !== before) notify();
}

export function startGitPolling() {
  poll();
  setInterval(poll, POLL_MS);
}
