// Ações do catálogo de contas AWS: anotar apelido, sistema e ambiente de um perfil.
import { store, commit } from '../core/store.js';

const FIELDS = { alias: 80, system: 60 };
const ENVS = new Set(['', 'dev', 'hom', 'prod']);

/** `patch`: { alias?, system?, env? } — o resto do que já foi anotado fica. */
export function setAwsMeta(profile, patch) {
  if (!/^[\w.@+-]{1,64}$/.test(String(profile || ''))) throw new Error('Perfil AWS inválido.');
  const cur = { ...(store.state.awsCatalog[profile] || {}) };
  for (const [k, max] of Object.entries(FIELDS)) if (patch[k] !== undefined) cur[k] = String(patch[k]).trim().slice(0, max);
  if (patch.env !== undefined) {
    if (!ENVS.has(patch.env)) throw new Error('Ambiente inválido: use dev, hom ou prod.');
    cur.env = patch.env;
  }
  store.state.awsCatalog[profile] = cur;
  commit();
  return cur;
}
