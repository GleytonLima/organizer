// Tela de uma sessão de agente (ACP): estado, conversa (mensagens, ferramentas, plano, pedidos de
// permissão com botões) e a caixa de mensagem. A caixa é criada uma vez (não perde o que você digita).
import { el, mount } from '../../core/dom.js';
import { icon } from '../icons.js';

const TOOL_ICON = { read: 'search', search: 'search', edit: 'note', delete: 'trash', move: 'folder', execute: 'terminal', fetch: 'cloud', think: 'memory' };
const STATUS_LABEL = { pending: 'aguardando', in_progress: 'em andamento', completed: 'feito', failed: 'falhou' };
const ALLOW = new Set(['allow_once', 'allow_always']);

function permissionItem(s, i) {
  const chosen = i.options.find((o) => o.optionId === i.answer);
  return el(
    'div',
    { class: `ag-permission${i.answer === undefined ? ' open' : ''}` },
    el('div', { class: 'ag-permission-title' }, icon('pause'), el('span', { text: `Pede permissão: ${i.title}` })),
    i.answer === undefined
      ? el(
          'div',
          { class: 'ag-permission-actions' },
          i.options.map((o) => el('button', { class: `btn small${ALLOW.has(o.kind) ? ' primary' : ''}`, onclick: () => s.answer(i.requestId, o.optionId), text: o.name })),
        )
      : el('div', { class: 'ag-muted', text: chosen ? `Respondido: ${chosen.name}` : 'Cancelado' }),
  );
}

const ITEM = {
  user: (_s, i) => el('div', { class: 'ag-user' }, el('div', { class: 'ag-who', text: 'Você' }), el('div', { class: 'ag-text', text: i.text })),
  agent: (s, i) => el('div', { class: 'ag-agent' }, el('div', { class: 'ag-who', text: s.label }), el('div', { class: 'ag-text', text: i.text })),
  thought: (_s, i) => el('div', { class: 'ag-thought', title: i.text, text: i.text }),
  tool: (_s, i) =>
    el('div', { class: `ag-tool ${i.status}` }, icon(TOOL_ICON[i.kind] || 'settings'), el('span', { class: 'ag-tool-title', text: i.title }), el('span', { class: 'ag-chip', text: STATUS_LABEL[i.status] || i.status })),
  plan: (_s, i) =>
    el('ol', { class: 'ag-plan' }, i.entries.map((e) => el('li', { class: e.status }, e.status === 'completed' ? icon('check') : el('span', { class: 'ag-dot' }), el('span', { text: e.content })))),
  permission: permissionItem,
  error: (_s, i) => el('div', { class: 'ag-error', text: i.text }),
  turn: (_s, i) => (i.stopReason === 'end_turn' ? null : el('div', { class: 'ag-muted', text: i.stopReason === 'cancelled' ? 'Interrompido.' : `Turno encerrado: ${i.stopReason}` })),
};

function build(s) {
  const textarea = el('textarea', {
    class: 'input textarea ag-input',
    rows: 2,
    placeholder: `Mensagem para o ${s.label}… (Enter envia, Shift+Enter quebra linha)`,
    onkeydown: (e) => {
      if (e.key !== 'Enter' || e.shiftKey) return;
      e.preventDefault();
      submit();
    },
  });
  const sendBtn = el('button', { class: 'btn primary', onclick: () => submit() }, icon('send'), 'Enviar');
  const stopBtn = el('button', { class: 'btn', onclick: () => s.cancel(), text: 'Interromper' });
  const restartBtn = el('button', { class: 'btn', onclick: () => s.restart(), text: 'Nova sessão' });
  function submit() {
    try {
      s.send(textarea.value);
      textarea.value = '';
    } catch (err) {
      s.items.push({ type: 'error', text: err.message });
      s.render();
    }
  }
  const view = {
    status: el('div', { class: 'ag-status' }),
    log: el('div', { class: 'ag-log' }),
    textarea, sendBtn, stopBtn, restartBtn,
  };
  mount(s.body, view.status, view.log, el('div', { class: 'ag-composer' }, textarea, el('div', { class: 'ag-buttons' }, stopBtn, restartBtn, sendBtn)));
  return view;
}

export function renderAgentView(s) {
  const v = (s.view ||= build(s));
  const nearBottom = v.log.scrollHeight - v.log.scrollTop - v.log.clientHeight < 60;
  mount(v.status, el('span', { class: `ag-state ${s.stateLabel() === 'aguardando você' ? 'aguardando' : s.state}` }), `${s.label} · ACP · ${s.stateLabel()}`);
  mount(
    v.log,
    s.items.length ? s.items.map((i) => ITEM[i.type]?.(s, i)) : el('div', { class: 'ag-empty', text: `Converse com o ${s.label} nesta pasta. Pedidos de permissão viram “Em espera” na tarefa deste terminal.` }),
  );
  if (nearBottom) v.log.scrollTop = v.log.scrollHeight;
  const working = s.state === 'trabalhando';
  v.sendBtn.disabled = s.state !== 'pronto';
  v.stopBtn.classList.toggle('hidden', !working);
  v.restartBtn.classList.toggle('hidden', s.state !== 'encerrado');
}
