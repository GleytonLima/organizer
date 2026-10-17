// Conversa de uma sessão de agente: aplica cada session/update do ACP aos itens exibidos.
// Itens: user | agent | thought | tool | plan | permission | error | turn | note.
// Ao continuar uma sessão (session/load), o agente reenvia a conversa como user/agent chunks.

/** Junta pedaços de texto no último item do mesmo tipo (mensagens chegam em partes). */
function appendText(s, type, text) {
  const last = s.items.at(-1);
  if (last?.type === type) last.text += text;
  else s.items.push({ type, text });
}

export function applyUpdate(s, u) {
  const text = u.content?.type === 'text' ? u.content.text : '';
  switch (u.sessionUpdate) {
    case 'user_message_chunk':
      return appendText(s, 'user', text);
    case 'agent_message_chunk':
      return appendText(s, 'agent', text);
    case 'agent_thought_chunk':
      return appendText(s, 'thought', text);
    case 'tool_call':
      s.items.push({ type: 'tool', id: u.toolCallId, title: u.title, kind: u.kind || 'other', status: u.status || 'pending' });
      return;
    case 'tool_call_update': {
      const tool = s.items.findLast((i) => i.type === 'tool' && i.id === u.toolCallId);
      if (tool) Object.assign(tool, u.title && { title: u.title }, u.status && { status: u.status });
      return;
    }
    case 'plan': {
      const plan = s.items.findLast((i) => i.type === 'plan');
      if (plan && s.items.indexOf(plan) > s.items.findLastIndex((i) => i.type === 'user')) plan.entries = u.entries;
      else s.items.push({ type: 'plan', entries: u.entries || [] });
      return;
    }
    case 'current_mode_update':
      if (s.modes) s.modes.current = u.currentModeId;
      if (s.config) for (const o of s.config) if (o.id === 'mode') o.currentValue = u.currentModeId;
      return;
    case 'config_option_update':
      if (u.configOptions) s.config = u.configOptions;
      return;
    case 'available_commands_update':
      s.commands = u.availableCommands || [];
      return;
    default:
      // outros tipos (uso, informações da sessão…) não aparecem por enquanto
  }
}

/** Há um pedido de permissão sem resposta? */
export const waitingYou = (s) => s.items.some((i) => i.type === 'permission' && i.answer === undefined);

/** Texto da conversa (para "ler o terminal" pela API). */
export function transcriptText(s, count) {
  const line = (i) => (i.type === 'user' ? `> ${i.text}` : i.type === 'agent' ? i.text : i.type === 'tool' ? `[${i.status}] ${i.title}` : '');
  return s.items.map(line).join('\n').split('\n').slice(-count).join('\n');
}
