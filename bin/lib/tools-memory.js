// Ferramentas MCP da memória do projeto: notas e decisões, com busca.
const scope = {
  project: { type: 'string', description: 'Projeto (nome ou id). Padrão: o do seu terminal.' },
  all: { type: 'boolean', description: 'Buscar em todos os projetos.' },
};

const MEMORY_TOOLS = [
  {
    name: 'record_decision',
    description:
      'Registra uma DECISÃO do projeto numa única frase que inclui o porquê (ex.: "Usamos Postgres porque o time já domina e ' +
      'precisamos de transações"). Persiste entre sessões. Se ela substitui uma decisão anterior, informe "supersedes" com o id dela.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Uma frase (máx. 280 caracteres), com o porquê.' },
        repo: { type: 'string', description: 'Repositório a que se refere (padrão: o do seu terminal).' },
        tags: { type: 'string', description: 'Tags separadas por vírgula (ex.: "banco,infra").' },
        supersedes: { type: 'string', description: 'Id da decisão anterior que esta substitui.' },
        project: scope.project,
      },
      required: ['text'],
    },
    run: (request, args) => request('memory_decision', args),
  },
  {
    name: 'remember_note',
    description: 'Guarda uma nota na memória do projeto (fato útil, convenção, comando, armadilha encontrada). Persiste entre sessões.',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string' }, repo: { type: 'string' }, tags: { type: 'string' }, project: scope.project },
      required: ['text'],
    },
    run: (request, args) => request('memory_note', args),
  },
  {
    name: 'search_memory',
    description:
      'Busca na memória do projeto (notas e decisões). Consulte ANTES de propor algo que já pode ter sido decidido. ' +
      'Busca por texto (sem diferenciar acentos) e, se configurado, por similaridade.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        kind: { type: 'string', enum: ['note', 'decision'] },
        repo: { type: 'string' },
        limit: { type: 'number' },
        ...scope,
      },
      required: ['query'],
    },
    run: (request, args) => request('memory_search', args),
  },
  {
    name: 'list_decisions',
    description: 'Lista as decisões vigentes do projeto (as substituídas ficam de fora). Bom para se contextualizar no início de uma sessão.',
    inputSchema: { type: 'object', properties: { repo: { type: 'string' }, ...scope } },
    run: (request, args) => request('memory_decisions', args),
  },
  {
    name: 'forget_memory',
    description: 'Apaga uma memória pelo id (use só quando o usuário pedir ou quando a informação estiver errada).',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    run: (request, args) => request('memory_forget', args),
  },
];

module.exports = { MEMORY_TOOLS };
