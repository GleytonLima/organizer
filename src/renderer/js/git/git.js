// Status git por pasta, atualizado periodicamente. Um projeto pode ter vários repositórios
// (ex.: contrato, backend, infra, frontend): são descobertos nas subpastas da pasta do projeto.
import { store, openTerminals, notify } from '../core/store.js';

const POLL_MS = 3000;
const REPO_SCAN_EVERY = 10; // redescobre repositórios a cada 10 ciclos (~30 s)
const byCwd = new Map(); // pasta -> info | null  (info.root/info.repo identificam o repositório)
const reposByProject = new Map(); // projectId -> [{ name, path }]
let cycle = 0;

export const gitFor = (cwd) => byCwd.get(cwd) || null;
export const dirtyCount = (g) => (g ? g.changes + g.staged + g.untracked : 0);

/** Repositórios do projeto, cada um com seu status git: [{ name, path, git }]. */
export const projectRepos = (project) =>
  (reposByProject.get(project?.id) || []).map((r) => ({ ...r, git: gitFor(r.path) }));

export async function refreshGit(cwd) {
  if (cwd) byCwd.set(cwd, await api.gitStatus(cwd));
}

async function scanRepos() {
  const open = store.state.projects.filter((p) => p.open && p.cwd);
  await Promise.all(open.map(async (p) => reposByProject.set(p.id, await api.gitRepos(p.cwd))));
}

async function poll() {
  if (cycle++ % REPO_SCAN_EVERY === 0) await scanRepos();
  const dirs = new Set(openTerminals().map((x) => x.t.cwd).filter(Boolean));
  for (const repos of reposByProject.values()) repos.forEach((r) => dirs.add(r.path));
  const before = JSON.stringify([...byCwd]);
  await Promise.all([...dirs].map(refreshGit));
  for (const k of byCwd.keys()) if (!dirs.has(k)) byCwd.delete(k);
  if (JSON.stringify([...byCwd]) !== before) notify();
}

/** Força uma nova descoberta (ex.: projeto criado ou pasta alterada). */
export function rescanRepos() {
  cycle = 0;
  poll();
}

export function startGitPolling() {
  poll();
  setInterval(poll, POLL_MS);
}
