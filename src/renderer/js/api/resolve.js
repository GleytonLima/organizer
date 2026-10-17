// Resolve referências vindas da API (nomes, ids, caminhos relativos) para entidades do estado.
import { store, findTerm, projects, projectById, currentProject, allTerminals } from '../core/store.js';
import { makeGroup } from '../core/model.js';
import { termLabel } from '../core/format.js';

const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();

/** Terminal que fez o pedido (BO_TERMINAL_ID enviado pelo cliente como `from`). */
export const callerOf = (params) => findTerm(params.from);

export function resolveProject(ref, caller) {
  if (!ref) return caller?.project || currentProject();
  const p = projectById(ref) || projects().find((x) => same(x.name, ref));
  if (!p) throw new Error(`Projeto não encontrado: ${ref}`);
  return p;
}

/** Grupo por id ou nome dentro do projeto; um nome novo cria o grupo. Sem ref: o grupo de quem pediu. */
export function resolveGroup(project, ref, caller) {
  if (!ref) return caller?.project === project ? caller.group : project.groups[0];
  let g = project.groups.find((x) => x.id === ref || same(x.name, ref));
  if (!g) project.groups.push((g = makeGroup({ name: ref })));
  return g;
}

/** Terminal por id ou nome (procurando primeiro no projeto de quem pediu). Sem ref: o próprio chamador. */
export function resolveTerminal(ref, caller) {
  if (!ref) {
    if (caller) return caller;
    throw new Error('Informe o terminal (id ou nome).');
  }
  const byId = findTerm(ref);
  if (byId) return byId;
  const byName = (list) => list.filter((x) => same(termLabel(x.t), ref));
  const local = caller ? byName(allTerminals().filter((x) => x.project === caller.project)) : [];
  const matches = local.length ? local : byName(allTerminals());
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) throw new Error(`Nome ambíguo "${ref}"; use o id: ${matches.map((m) => m.t.id).join(', ')}`);
  throw new Error(`Terminal não encontrado: ${ref}`);
}

function normalize(p) {
  const [drive, ...rest] = p.replace(/\//g, '\\').split('\\');
  const parts = [];
  for (const seg of rest) {
    if (!seg || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return parts.length ? [drive, ...parts].join('\\') : drive + '\\';
}

/** Aceita caminho Windows, MSYS (/c/...), ~ ou relativo a `base`. */
export async function resolveCwd(cwd, base) {
  if (!cwd) return base;
  let p = cwd.startsWith('~') ? store.info.home + cwd.slice(1) : cwd;
  if (p.startsWith('/')) p = await api.fromMsys(p);
  return normalize(/^[a-zA-Z]:[\\/]/.test(p) ? p : `${base}\\${p}`);
}
