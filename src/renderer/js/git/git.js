// Status git por pasta, atualizado periodicamente: pastas dos terminais abertos e as
// pastas/repositórios que você associou a cada projeto (project.repos, lista explícita).
import { store, openTerminals, notify } from '../core/store.js';

const POLL_MS = 3000;
const byCwd = new Map(); // pasta -> info | null  (info.root/info.repo identificam o repositório)

export const gitFor = (cwd) => byCwd.get(cwd) || null;
export const dirtyCount = (g) => (g ? g.changes + g.staged + g.untracked : 0);

/** Pastas do projeto, cada uma com seu status git (null se não for repositório): [{ name, path, git }]. */
export const projectRepos = (project) => (project?.repos || []).map((r) => ({ ...r, git: gitFor(r.path) }));

export async function refreshGit(cwd) {
  if (cwd) byCwd.set(cwd, await api.gitStatus(cwd));
}

async function poll() {
  const dirs = new Set(openTerminals().map((x) => x.t.cwd).filter(Boolean));
  for (const p of store.state.projects) if (p.open) (p.repos || []).forEach((r) => dirs.add(r.path));
  const before = JSON.stringify([...byCwd]);
  await Promise.all([...dirs].map(refreshGit));
  for (const k of byCwd.keys()) if (!dirs.has(k)) byCwd.delete(k);
  if (JSON.stringify([...byCwd]) !== before) notify();
}

/** Atualiza já (ex.: depois de mudar as pastas de um projeto). */
export const refreshAllGit = () => poll();

export function startGitPolling() {
  poll();
  setInterval(poll, POLL_MS);
}
