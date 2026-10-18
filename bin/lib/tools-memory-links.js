// Ferramentas MCP de vínculos entre memórias, cadeia de impacto e "a revisar".
const LINK_TYPES = {
  type: 'string',
  enum: ['depends', 'related', 'contradicts'],
  description: 'depends = "apoia-se em" (se a outra mudar, esta precisa ser revista); related = relacionada; contradicts = contradiz.',
};

/** Esquema do parâmetro `links` de record_decision/remember_note/update_memory. */
const linksParam = {
  type: 'array',
  description:
    'Vínculos com memórias existentes (ids de search_memory). Use "depends" quando esta só vale porque a outra vale ' +
    '(ex.: "usamos filas" depende de "processamento é assíncrono"): assim, se a outra mudar, esta entra na cadeia de impacto.',
  items: { type: 'object', properties: { id: { type: 'string' }, type: LINK_TYPES }, required: ['id'] },
};

const LINK_TOOLS = [
  {
    name: 'memory_links',
    description:
      'Mostra os vínculos de uma memória: de quem ela depende, quem a usa e a CADEIA DE IMPACTO (tudo que depende dela, ' +
      'direta ou indiretamente). Consulte antes de mudar uma decisão.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    run: (request, args) => request('memory_links', args),
  },
  {
    name: 'link_memories',
    description: 'Vincula uma memória existente a outra (id → to). Use quando perceber que uma decisão/nota se apoia em outra, se relaciona ou a contradiz.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, to: { type: 'string' }, type: LINK_TYPES }, required: ['id', 'to'] },
    run: (request, args) => request('memory_link', args),
  },
  {
    name: 'unlink_memories',
    description: 'Remove o vínculo de uma memória (id) para outra (to).',
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, to: { type: 'string' } }, required: ['id', 'to'] },
    run: (request, args) => request('memory_unlink', args),
  },
  {
    name: 'update_memory',
    description:
      'Evolui uma memória: novo texto, tags, vínculos e/ou estado (ex.: ideia que virou uma tarefa já existente: status converted + task). Devolve a cadeia de impacto (quem depende dela). Se o sentido mudou, ' +
      'pergunte ao usuário quais do impacto marcar com mark_for_review. Para trocar uma decisão por outra, prefira record_decision com "supersedes".',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        text: { type: 'string' },
        tags: { type: 'string' },
        links: linksParam,
        status: { type: 'string', description: 'Ideia: open | converted | discarded. Progresso: open | done.' },
        task: { type: 'string', description: 'Com status "converted": a tarefa (chave) em que a ideia virou.' },
      },
      required: ['id'],
    },
    run: (request, args) => request('memory_update', args),
  },
  {
    name: 'mark_for_review',
    description: 'Marca memórias como "a revisar" porque algo de que dependem mudou (ex.: as da cadeia de impacto). A marca vale para o time depois do sync.',
    inputSchema: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string' } },
        reason: { type: 'string', description: 'O que mudou (ex.: "Mudou: agora usamos SQS").' },
        source: { type: 'string', description: 'Id da memória que mudou.' },
      },
      required: ['ids', 'reason'],
    },
    run: (request, args) => request('memory_mark_review', args),
  },
  {
    name: 'idea_to_task',
    description: 'Transforma uma ideia (memória kind "idea") em tarefa no quadro, já vinculada à ideia; a ideia fica "virou tarefa".',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    run: (request, args) => request('memory_idea_to_task', args),
  },
  {
    name: 'mark_reviewed',
    description: 'Confirma que uma memória marcada "a revisar" continua valendo como está (a marca some). Se ela precisa mudar, use update_memory.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    run: (request, args) => request('memory_reviewed', args),
  },
];

module.exports = { LINK_TOOLS, linksParam };
