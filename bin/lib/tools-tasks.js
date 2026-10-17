// Ferramentas MCP do quadro de tarefas (mini kanban do projeto).
const taskRef = {
  type: 'string',
  description: 'Chave (ex.: "MA-3"), id ou título exato. Omitido = sua tarefa aberta mais recente.',
};
const projectRef = { type: 'string', description: 'Projeto (nome ou id). Padrão: o projeto do seu terminal.' };

const TASK_TOOLS = [
  {
    name: 'list_columns',
    description:
      'Lista as colunas do quadro do projeto, com nome e descrição. Consulte antes de mover tarefas: ' +
      'as descrições dizem o que cada coluna significa no fluxo do usuário.',
    inputSchema: { type: 'object', properties: { project: projectRef } },
    run: (request, args) => request('task_columns', args),
  },
  {
    name: 'create_task',
    description: 'Cria uma tarefa no quadro (na primeira coluna, ou em "column"). Retorna a chave (ex.: "MA-3") para usar depois.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título curto e objetivo.' },
        description: { type: 'string', description: 'Detalhes, critérios de pronto, contexto.' },
        column: { type: 'string', description: 'Nome ou id da coluna inicial (opcional).' },
        memories: { type: 'array', items: { type: 'string' }, description: 'Ids de memórias que dão contexto à tarefa (decisões, como fazer, a ideia de origem…).' },
        parent: { type: 'string', description: 'Tarefa-mãe (chave, ex.: "BO-35"): cria como SUBTAREFA. Ao dividir uma tarefa em partes, registre cada parte assim antes de começá-la.' },
        project: projectRef,
      },
      required: ['title'],
    },
    run: (request, args) => request('task_create', args),
  },
  {
    name: 'move_task',
    description: 'Move uma tarefa para outra coluna (use list_columns para escolher). Ex.: ao começar, mova para a coluna de "em execução".',
    inputSchema: {
      type: 'object',
      properties: { task: taskRef, column: { type: 'string', description: 'Nome ou id da coluna.' }, note: { type: 'string', description: 'Motivo/observação (opcional).' } },
      required: ['column'],
    },
    run: (request, args) => request('task_move', args),
  },
  {
    name: 'report_progress',
    description: 'Registra um relato de andamento na tarefa (aparece no histórico e no cartão). Opcionalmente informa o progresso (0–100).',
    inputSchema: {
      type: 'object',
      properties: { task: taskRef, message: { type: 'string' }, progress: { type: 'number', description: '0 a 100 (opcional).' } },
      required: ['message'],
    },
    run: (request, args) => request('task_report', args),
  },
  {
    name: 'request_input',
    description:
      'Coloca a tarefa "em espera" com uma pergunta para o usuário (vale em qualquer coluna) e o notifica. ' +
      'A resposta dele chega digitada no seu terminal, como uma nova mensagem. Faça a pergunta clara e autossuficiente.',
    inputSchema: { type: 'object', properties: { task: taskRef, question: { type: 'string' } }, required: ['question'] },
    run: (request, args) => request('task_input', args),
  },
  {
    name: 'list_waiting_tasks',
    description:
      'Para um agente SUPERVISOR: lista as tarefas em espera (pergunta, histórico, terminal de origem) de todos os projetos ' +
      'ou de "project". Use para preparar sugestões de resposta com suggest_reply.',
    inputSchema: { type: 'object', properties: { project: { type: 'string' } } },
    run: (request, args) => request('task_waiting', args),
  },
  {
    name: 'suggest_reply',
    description:
      'Para um agente SUPERVISOR: deixa uma sugestão de resposta (ou um resumo/recap com a recomendação) numa tarefa em espera. ' +
      'O usuário vê a sugestão pré-preenchida, edita se quiser e envia ao agente que perguntou.',
    inputSchema: { type: 'object', properties: { task: taskRef, suggestion: { type: 'string' } }, required: ['task', 'suggestion'] },
    run: (request, args) => request('task_suggest', args),
  },
  {
    name: 'complete_task',
    description: 'Conclui a tarefa: move para a última coluna do quadro e avisa o usuário.',
    inputSchema: { type: 'object', properties: { task: taskRef, summary: { type: 'string', description: 'Resumo do que foi feito.' } } },
    run: (request, args) => request('task_complete', args),
  },
  {
    name: 'list_tasks',
    description: 'Lista as tarefas do projeto (opcionalmente de uma coluna), com coluna, progresso e último relato.',
    inputSchema: { type: 'object', properties: { column: { type: 'string' }, project: projectRef } },
    run: (request, args) => request('task_list', args),
  },
  {
    name: 'get_task',
    description: 'Detalhes de uma tarefa, incluindo o histórico completo, as SUBTAREFAS e as MEMÓRIAS vinculadas (decisões, como fazer, ideias): leia-as antes de começar.',
    inputSchema: { type: 'object', properties: { task: taskRef } },
    run: (request, args) => request('task_get', args),
  },
  {
    name: 'link_task_memory',
    description: 'Vincula memórias à tarefa (ou desvincula, com remove) — ex.: a decisão ou o "como fazer" que quem pegar a tarefa precisa saber.',
    inputSchema: {
      type: 'object',
      properties: { task: taskRef, memory: { type: 'array', items: { type: 'string' }, description: 'Ids de memória.' }, remove: { type: 'boolean' } },
      required: ['memory'],
    },
    run: (request, args) => request('task_link_memory', args),
  },
];

module.exports = { TASK_TOOLS };
