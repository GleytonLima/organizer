// `bo mem link|links|review`: vínculos entre memórias, cadeia de impacto e "a revisar".
const { request } = require('./client');

const TYPE_LABEL = { depends: 'apoia-se em', related: 'relacionada a', contradicts: 'contradiz' };

/** --depends a,b --related c --contradicts d → [{ id, type }]. */
const linksOf = (o) =>
  Object.keys(TYPE_LABEL).flatMap((type) => (o[type] && o[type] !== true ? String(o[type]).split(',').map((id) => ({ id: id.trim(), type })) : []));

const LINK_FLAGS = '[--depends ID,ID] [--related ID] [--contradicts ID]';

const linkLine = (l) =>
  `${'  '.repeat(l.depth || 1)}${l.type ? `${TYPE_LABEL[l.type]}: ` : ''}${l.memory.missing ? '(fora deste app)' : `[${l.memory.id}] ${l.memory.text}`}${l.memory.review ? '  [a revisar]' : ''}`;

const section = (title, items) => `${title}:\n${items.map(linkLine).join('\n') || '  (nenhuma)'}`;

/** Ações extras de `bo mem` (recebem `line`/`lines` do comando principal para formatar). */
const linkActions = ({ line, lines }) => ({
  link: {
    usage: 'link <id> <outro-id> [--type depends|related|contradicts]',
    run: async ([id, to], o) => line(await request('memory_link', { id, to, type: o.type })),
  },
  links: {
    usage: 'links <id>   (vínculos e cadeia de impacto)',
    run: async ([id]) => {
      const l = await request('memory_links', { id });
      return [section('Usa', l.outgoing), section('Usada por', l.incoming), section('Cadeia de impacto', l.impact.map(({ type, ...x }) => x))].join('\n');
    },
  },
  review: {
    usage: 'review [--done ID]   (lista as marcadas "a revisar"; --done: continua valendo)',
    run: async (_p, o) =>
      o.done
        ? line(await request('memory_reviewed', { id: o.done }))
        : lines((await request('memory_search', { query: '', needsReview: true })).items, '(nada a revisar)'),
  },
});

module.exports = { linkActions, linksOf, LINK_FLAGS };
