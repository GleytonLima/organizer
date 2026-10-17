// Ferramentas MCP da memória do projeto: notas e decisões, com busca e vínculos.
const { LINK_TOOLS, linksParam } = require('./tools-memory-links');
const scope = {
  project: { type: 'string', description: 'Projeto (nome ou id). Padrão: o do seu terminal (ou da pasta atual).' },
  all: { type: 'boolean', description: 'Buscar em todos os projetos.' },
};

// Onde a memória vale. Leitura sempre traz o que vale para o projeto: globais + projeto + pastas dele.
const writeScope = {
  scope: {
    type: 'string',
    enum: ['project', 'folder', 'global'],
    description:
      'Onde vale: "project" (padrão) = este projeto; "folder" = uma pasta/repositório, em qualquer projeto que a inclua ' +
      '(ex.: convenção do repo backend); "global" = todos os projetos (ex.: preferências do usuário).',
  },
  folder: { type: 'string', description: 'Para scope "folder": nome de uma pasta do projeto (ex.: "backend") ou caminho. Padrão: o repositório do seu terminal.' },
};
const scopeFilter = { type: 'string', enum: ['project', 'folder', 'global'], description: 'Restringir a um escopo (opcional).' };

const MEMORY_TOOLS = [
  {
    name: 'record_decision',
    description:
      'Registra uma DECISÃO do projeto numa única frase que inclui o porquê (ex.: "Usamos Postgres porque o time já domina e ' +
      'precisamos de transações"). Persiste entre sessões. Se ela substitui uma decisão anterior, informe "supersedes" com o id dela. ' +
      'Se ela se apoia em outra memória (ou se relaciona/contradiz), informe "links" — busque antes com search_memory.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Uma frase (máx. 280 caracteres), com o porquê.' },
        repo: { type: 'string', description: 'Repositório a que se refere (padrão: o do seu terminal).' },
        tags: { type: 'string', description: 'Tags separadas por vírgula (ex.: "banco,infra").' },
        supersedes: { type: 'string', description: 'Id da decisão anterior que esta substitui.' },
        links: linksParam,
        ...writeScope,
        project: scope.project,
      },
      required: ['text'],
    },
    run: (request, args) => request('memory_decision', args),
  },
  {
    name: 'remember_note',
    description:
      'Guarda uma memória do projeto. kind "note" (padrão): fato útil, convenção, armadilha; "idea": ideia que surgiu em paralelo ' +
      '(fica aberta até virar tarefa); "howto": como fazer — como resolvemos um problema, o procedimento interno, a quem recorrer.',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string' }, kind: { type: 'string', enum: ['note', 'idea', 'howto'] }, repo: { type: 'string' }, tags: { type: 'string' }, links: linksParam, ...writeScope, project: scope.project },
      required: ['text'],
    },
    run: (request, args) => request('memory_note', args),
  },
  {
    name: 'search_memory',
    description:
      'Busca na memória (notas e decisões globais, do projeto e das pastas dele). Consulte ANTES de propor algo que já pode ter sido decidido. ' +
      'Busca por texto (sem diferenciar acentos) e, se configurado, por similaridade.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        kind: { type: 'string', enum: ['note', 'decision', 'progress', 'idea', 'howto'] },
        needsReview: { type: 'boolean', description: 'Só as marcadas "a revisar" (algo de que dependem mudou).' },
        scope: scopeFilter,
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
    inputSchema: { type: 'object', properties: { repo: { type: 'string' }, scope: scopeFilter, ...scope } },
    run: (request, args) => request('memory_decisions', args),
  },
  {
    name: 'save_progress',
    description:
      'Salva o PROGRESSO de uma tarefa para ela ser retomada depois — por você ou por outro dev, em outra máquina (ex.: antes de ' +
      'encerrar o dia ou sair de férias): onde parou e os próximos passos. Uma por tarefa; salvar de novo atualiza. ' +
      'Repo e branch vêm do seu terminal.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Onde parou (ex.: "Login feito; falta o refresh token").' },
        nextSteps: { type: 'array', items: { type: 'string' }, description: 'Próximos passos, em ordem.' },
        task: { type: 'string', description: 'Tarefa (chave, ex.: "BO-12"). Padrão: a tarefa atual do seu terminal.' },
        project: scope.project,
      },
      required: ['status'],
    },
    run: (request, args) => request('memory_progress', args),
  },
  {
    name: 'forget_memory',
    description: 'Apaga uma memória pelo id (use só quando o usuário pedir ou quando a informação estiver errada).',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    run: (request, args) => request('memory_forget', args),
  },
  ...LINK_TOOLS,
];

module.exports = { MEMORY_TOOLS };
