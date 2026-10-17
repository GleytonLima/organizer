// Vínculos entre memórias (mesmo modelo do servidor — docs/API.md → "Vínculos e impacto"):
//   depends     "apoia-se em": se a outra mudar, esta precisa ser revista (propaga impacto)
//   related     "relacionada a"
//   contradicts "contradiz"
// Guardados pelo gid (o id no servidor), para sincronizar sem tradução.
const { openDb } = require('./db');

const REF_TYPES = ['depends', 'related', 'contradicts'];
const MAX_REFS = 30;

/** gid de uma memória local, a partir do id curto ou do próprio gid. */
const gidOf = (ref) => openDb().prepare('SELECT gid FROM memories WHERE id = ? OR gid = ?').get(ref, ref)?.gid;

/**
 * Valida e normaliza `refs` ([{ id, type }], id = id curto ou gid): resolve para gid, descarta
 * auto-referência e repetidos (o último tipo vale).
 */
function resolveRefs(refs, selfGid) {
  const out = [];
  for (const r of refs || []) {
    const type = r.type || 'depends';
    if (!REF_TYPES.includes(type)) throw new Error(`Tipo de vínculo inválido: "${type}". Use: ${REF_TYPES.join(', ')}.`);
    const id = gidOf(String(r.id || '').trim());
    if (!id) throw new Error(`Memória a vincular não encontrada: ${r.id}`);
    if (id === selfGid) continue;
    const i = out.findIndex((x) => x.id === id);
    if (i >= 0) out.splice(i, 1);
    out.push({ id, type });
  }
  if (out.length > MAX_REFS) throw new Error(`Vínculos demais (máx. ${MAX_REFS}).`);
  return out;
}

module.exports = { REF_TYPES, resolveRefs, gidOf };
