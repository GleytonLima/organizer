// Ferramentas MCP: cada uma mapeia para um método da API local.
const { waitForOutput } = require('./wait');
const { TASK_TOOLS } = require('./tools-tasks');
const { MEMORY_TOOLS } = require('./tools-memory');

const terminalRef = {
  type: 'string',
  description: 'Id ou nome do terminal. Omitido = o terminal onde o agente está rodando.',
};

const TOOLS = [
  {
    name: 'list_terminals',
    description: 'Lista projetos, grupos e terminais do Bash Organizer, com pasta, estado (running/idle/error/exited) e comando em execução.',
    inputSchema: { type: 'object', properties: {} },
    run: (request) => request('list'),
  },
  {
    name: 'open_terminal',
    description:
      'Abre um novo terminal Git Bash no Bash Organizer. Sem "group", ele entra no mesmo grupo do terminal onde você está; ' +
      'use "group" (ex.: "Serviços") para separar serviços de longa duração. O usuário vê o terminal no app.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nome do terminal (ex.: "backend").' },
        repo: { type: 'string', description: 'Nome de uma pasta/repositório do projeto (ex.: "backend"); veja list_terminals → repos. Preferível a caminhos.' },
        cwd: { type: 'string', description: 'Pasta inicial: absoluta, ~/..., /c/... ou relativa (ao repo, se informado, senão ao terminal de origem).' },
        command: { type: 'string', description: 'Comando a executar uma vez ao abrir (ex.: "npm run dev").' },
        startup: { type: 'string', description: 'Comando salvo no terminal e repetido sempre que o app restaurar a sessão.' },
        group: { type: 'string', description: 'Grupo de destino (nome ou id); criado se não existir.' },
        project: { type: 'string', description: 'Projeto (nome ou id). Padrão: o projeto do terminal de origem.' },
        focus: { type: 'boolean', description: 'Trazer o terminal para a frente (padrão: false, para não interromper o usuário).' },
      },
    },
    run: (request, args) => request('open', args),
  },
  {
    name: 'send_input',
    description: 'Envia texto a um terminal (por padrão seguido de Enter). Use para rodar comandos ou responder prompts.',
    inputSchema: {
      type: 'object',
      properties: { terminal: terminalRef, text: { type: 'string' }, enter: { type: 'boolean', description: 'Pressionar Enter no fim (padrão: true).' } },
      required: ['text'],
    },
    run: (request, args) => request('send', args),
  },
  {
    name: 'read_output',
    description: 'Lê as últimas linhas da saída de um terminal.',
    inputSchema: {
      type: 'object',
      properties: { terminal: terminalRef, lines: { type: 'number', description: 'Quantidade de linhas (padrão 50, máx. 2000).' } },
    },
    run: (request, args) => request('read', args),
  },
  {
    name: 'wait_for_output',
    description: 'Espera até a saída de um terminal conter um padrão (regex), ex.: esperar o backend logar "listening on". Retorna a saída.',
    inputSchema: {
      type: 'object',
      properties: {
        terminal: terminalRef,
        pattern: { type: 'string', description: 'Expressão regular (sem diferenciar maiúsculas).' },
        timeout_seconds: { type: 'number', description: 'Tempo máximo (padrão 60).' },
      },
      required: ['terminal', 'pattern'],
    },
    run: (request, args) => waitForOutput(request, { terminal: args.terminal, pattern: args.pattern, timeout: args.timeout_seconds }),
  },
  {
    name: 'terminal_status',
    description: 'Estado de um terminal: pasta, se há comando em execução e o último código de saída.',
    inputSchema: { type: 'object', properties: { terminal: terminalRef } },
    run: (request, args) => request('status', args),
  },
  {
    name: 'focus_terminal',
    description: 'Traz um terminal para a frente no app.',
    inputSchema: { type: 'object', properties: { terminal: terminalRef }, required: ['terminal'] },
    run: (request, args) => request('focus', args),
  },
  {
    name: 'notify_user',
    description:
      'Avisa o usuário com uma notificação do Windows e uma marca no seu terminal. Use ao terminar uma tarefa longa ' +
      '(ex.: "backend e frontend no ar") ou quando precisar de uma decisão dele.',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Texto curto do aviso.' },
        title: { type: 'string', description: 'Prefixo opcional (ex.: "Claude").' },
      },
      required: ['message'],
    },
    run: (request, args) => request('notify', args),
  },
  {
    name: 'close_terminal',
    description: 'Fecha um terminal. Se houver processo em execução, falha a menos que force=true.',
    inputSchema: {
      type: 'object',
      properties: { terminal: terminalRef, force: { type: 'boolean', description: 'Encerrar mesmo com processo rodando.' } },
      required: ['terminal'],
    },
    run: (request, args) => request('close', args),
  },
];

module.exports = { TOOLS: [...TOOLS, ...TASK_TOOLS, ...MEMORY_TOOLS] };
