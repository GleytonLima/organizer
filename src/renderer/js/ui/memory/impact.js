// Cadeia de impacto e "a revisar": depois de mudar uma memória, escolher quais dependentes marcar;
// ver os vínculos de uma memória; revisar uma memória marcada.
import { el } from '../../core/dom.js';
import { cleanError } from '../../core/errors.js';
import { openModal } from '../modal.js';
import { invalidateMemory } from './state.js';
import { LINK_TYPES } from './links-field.js';

const typeLabel = (t) => LINK_TYPES.find((x) => x.value === t)?.label || t;
const textOf = (l) => l.memory?.text || '(memória fora deste app)';

/** Item da cadeia (recuado pela distância); com `checks`, ganha uma caixa de seleção. */
function chainItem(l, checks) {
  const box = checks ? el('input', { type: 'checkbox', checked: l.depth === 1 }) : null;
  if (box) checks.set(l.memory.id, box);
  return el(
    'label',
    { class: 'impact-item', style: { paddingLeft: `${(l.depth - 1) * 18}px` } },
    box,
    el('span', { class: 'impact-text', text: textOf(l) }),
    l.memory?.review ? el('span', { class: 'mem-flag static', text: 'já a revisar' }) : null,
  );
}

/**
 * Depois de editar/substituir `source`: mostra quem depende dela e marca as escolhidas "a revisar".
 * `reason`: o que mudou (vai na marca). Não faz nada se ninguém depende dela.
 */
export async function offerImpact(source, reason) {
  const { impact } = await api.memory.links(source.id);
  const reachable = impact.filter((l) => l.memory);
  if (!reachable.length) return;
  const checks = new Map();
  const ok = await openModal({
    title: 'Cadeia de impacto',
    message: `${reachable.length === 1 ? 'Uma memória depende' : 'Estas memórias dependem'} desta, direta ou indiretamente. Marque as que precisam ser revistas.`,
    content: el('div', { class: 'impact-list' }, reachable.map((l) => chainItem(l, checks))),
    submit: 'Marcar a revisar',
    wide: true,
  });
  const ids = [...checks].filter(([, box]) => box.checked).map(([id]) => id);
  if (!ok || !ids.length) return;
  await api.memory.markReview(ids, { reason, source: source.id });
  invalidateMemory();
}

const section = (title, items) =>
  el('div', { class: 'links-section' }, el('div', { class: 'links-title', text: title }), items.length ? items : el('div', { class: 'link-empty', text: 'Nenhuma.' }));

/** Vínculos de saída e de entrada e a cadeia de impacto de uma memória. */
export async function linksDialog(m) {
  const l = await api.memory.links(m.id);
  const typed = (x) => el('div', { class: 'impact-item' }, el('span', { class: 'link-kind', text: typeLabel(x.type) }), el('span', { class: 'impact-text', text: textOf(x) }));
  await openModal({
    title: 'Vínculos e impacto',
    message: m.text,
    content: el(
      'div',
      { class: 'links-dialog' },
      section('Esta memória', l.outgoing.map(typed)),
      section('Outras que apontam para ela', l.incoming.map(typed)),
      section('Cadeia de impacto (dependem dela)', l.impact.map((x) => chainItem(x))),
    ),
    submit: 'Fechar',
    wide: true,
  });
}

/** Memória marcada "a revisar": continua valendo (tira a marca) ou editar. */
export async function reviewDialog(m, onEdit) {
  const v = await openModal({
    title: 'Revisar memória',
    message: m.review.reason,
    content: el('div', { class: 'mem-version' }, el('div', { class: 'mem-version-label', text: 'Esta memória' }), el('div', { class: 'mem-version-text', text: m.text })),
    submit: 'Continua valendo',
    extra: { label: 'Editar…', value: 'edit' },
    wide: true,
  });
  if (v === 'edit') return onEdit(m);
  if (!v) return;
  try {
    await api.memory.confirmReview(m.id);
    invalidateMemory();
  } catch (err) {
    await openModal({ title: 'Não foi possível revisar', message: cleanError(err) });
  }
}
