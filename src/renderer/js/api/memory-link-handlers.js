// Métodos da API para vínculos entre memórias, cadeia de impacto e a marca "a revisar".
// Vínculos: depends ("apoia-se em", propaga impacto) | related | contradicts. Ids = id curto.
import { invalidateMemory } from '../ui/memory/state.js';

const iso = (ms) => new Date(ms).toISOString();
const brief = (m) => m && { id: m.id, kind: m.kind, text: m.text, review: m.review, updatedAt: iso(m.updatedAt) };
const linked = (l) => ({ type: l.type, depth: l.depth, memory: brief(l.memory) || { gid: l.id, missing: true } });

async function changed(result) {
  invalidateMemory();
  return result;
}

/** Vínculos atuais como [{ id: gid, type }] (para regravar com acréscimos/remoções). */
const currentRefs = async (id) => {
  const m = await api.memory.get(id);
  if (!m) throw new Error(`Memória não encontrada: ${id}`);
  return m.refs;
};

export const memoryLinkHandlers = {
  /** Vínculos de saída, de entrada e a cadeia de impacto de uma memória. */
  async memory_links(p) {
    const l = await api.memory.links(p.id);
    return { outgoing: l.outgoing.map(linked), incoming: l.incoming.map(linked), impact: l.impact.map(linked) };
  },

  /** Acrescenta (ou muda o tipo de) um vínculo: `id` → `to`. */
  async memory_link(p) {
    const refs = await currentRefs(p.id);
    const item = await api.memory.update(p.id, { refs: [...refs, { id: p.to, type: p.type || 'depends' }] });
    return changed(brief(item));
  },

  async memory_unlink(p) {
    const target = await api.memory.get(p.to);
    const refs = (await currentRefs(p.id)).filter((r) => r.id !== (target?.gid || p.to));
    return changed(brief(await api.memory.update(p.id, { refs })));
  },

  /**
   * Edita texto/tags/vínculos ("evoluir" a memória). Devolve também a cadeia de impacto: quem
   * depende dela — candidatas a memory_mark_review.
   */
  async memory_update(p) {
    const data = {};
    if (p.text != null) data.text = p.text;
    if (p.tags != null) data.tags = p.tags;
    if (p.links) data.refs = p.links;
    const item = await api.memory.update(p.id, data);
    const { impact } = await api.memory.links(p.id);
    return changed({ ...brief(item), impact: impact.map(linked) });
  },

  /** Marca memórias como "a revisar" porque `source` mudou (vale para o time, após o sync). */
  async memory_mark_review(p) {
    const ids = Array.isArray(p.ids) ? p.ids : String(p.ids || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!ids.length) throw new Error('Informe as memórias a marcar ("ids").');
    return changed(await api.memory.markReview(ids, { reason: p.reason || 'Algo de que ela depende mudou.', source: p.source || null }));
  },

  /** Revisada: continua valendo sem mudanças (a marca some). */
  memory_reviewed: async (p) => changed(brief(await api.memory.confirmReview(p.id))),
};
