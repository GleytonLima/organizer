// Ferramentas MCP dos lembretes: o agente pede para lembrar o usuário de algo depois.
const REMINDER_TOOLS = [
  {
    name: 'remind_me',
    description:
      'Agenda um lembrete para o USUÁRIO (toast do Windows na hora e um cartão na Home do app até ele concluir). ' +
      'Use quando algo precisa da atenção dele mais tarde: "conferir o deploy em 30 min", "revisar o PR amanhã 9h". ' +
      'Não use para você mesmo esperar algo (para isso, wait_for_output).',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Do que lembrar, curto e acionável.' },
        when: { type: 'string', description: 'Quando: "em 30 min", "em 2h", "amanhã 9h", "sexta 14h", "18h" ou ISO ("2026-10-20T09:00").' },
        task: { type: 'string', description: 'Tarefa ligada (chave, ex.: "MA-3"): clicar no lembrete abre a tarefa. Opcional.' },
      },
      required: ['text', 'when'],
    },
    run: (request, args) => request('reminder_add', { ...args, via: 'agent' }),
  },
  {
    name: 'list_reminders',
    description: 'Lista os lembretes do usuário: os que já tocaram (esperando por ele) e os próximos.',
    inputSchema: { type: 'object', properties: {} },
    run: (request) => request('reminder_list', {}),
  },
];

module.exports = { REMINDER_TOOLS };
