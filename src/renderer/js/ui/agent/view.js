// Tela de uma sessão de agente (ACP): estado (modelo, esforço, modo — o que o agente anunciar —,
// Retomar…, Nova sessão), conversa (mensagens, ferramentas, plano, pedidos de permissão com botões)
// e a caixa de mensagem, com autocompletar de "/". A caixa é criada uma vez (não perde o que você digita).
import { el, mount } from '../../core/dom.js';
import { icon } from '../icons.js';
import { resumeDialog } from './resume-dialog.js';
import { configPickers, pickerForCommand } from './config-pickers.js';
import { attachSlash } from './slash.js';
import { attachmentsBox, attachmentChip } from './attachments.js';

const TOOL_ICON = { read: 'search', search: 'search', edit: 'note', delete: 'trash', move: 'folder', execute: 'terminal', fetch: 'cloud', think: 'memory' };
const STATUS_LABEL = { pending: 'aguardando', in_progress: 'em andamento', completed: 'feito', failed: 'falhou' };
const ALLOW = new Set(['allow_once', 'allow_always']);

// Pedido de permissão: aparece dentro do bloco da ferramenta que o pediu (ou sozinho, se ela não veio).
function permissionItem(s, i, { nested = false } = {}) {
  const chosen = i.options.find((o) => o.optionId === i.answer);
  return el(
    'div',
    { class: `ag-permission${i.answer === undefined ? ' open' : ''}` },
    el('div', { class: 'ag-permission-title' }, icon('pause'), el('span', { text: nested ? 'Pede permissão' : `Pede permissão: ${i.title}` })),
    i.answer === undefined
      ? el(
          'div',
          { class: 'ag-permission-actions' },
          i.options.map((o) => el('button', { class: `btn small${ALLOW.has(o.kind) ? ' primary' : ''}`, title: o.detail || '', onclick: () => s.answer(i.requestId, o.optionId), text: o.name })),
        )
      : el('div', { class: 'ag-muted', text: chosen ? `Respondido: ${chosen.name}` : 'Cancelado' }),
  );
}

const permissionsOf = (s, tool) => s.items.filter((p) => p.type === 'permission' && p.toolCallId === tool.id);
const hasTool = (s, id) => id != null && s.items.some((t) => t.type === 'tool' && t.id === id);

function toolItem(s, i) {
  const asks = permissionsOf(s, i);
  const waiting = asks.some((p) => p.answer === undefined);
  const row = el(
    'div',
    { class: `ag-tool ${i.status}` },
    icon(TOOL_ICON[i.kind] || 'settings'),
    el('span', { class: 'ag-tool-title', text: i.title }),
    el('span', { class: 'ag-chip', text: waiting ? 'aguardando você' : STATUS_LABEL[i.status] || i.status }),
  );
  if (!asks.length) return row;
  return el('div', { class: `ag-tool-block${waiting ? ' open' : ''}` }, row, asks.map((p) => permissionItem(s, p, { nested: true })));
}

const ITEM = {
  user: (_s, i) =>
    el(
      'div',
      { class: 'ag-user' },
      el('div', { class: 'ag-who', text: 'Você' }),
      i.attachments?.length ? el('div', { class: 'ag-attachments' }, i.attachments.map((a) => attachmentChip(a))) : null,
      i.text ? el('div', { class: 'ag-text', text: i.text }) : null,
    ),
  agent: (s, i) => el('div', { class: 'ag-agent' }, el('div', { class: 'ag-who', text: s.label }), el('div', { class: 'ag-text', text: i.text })),
  thought: (_s, i) => el('div', { class: 'ag-thought', title: i.text, text: i.text }),
  tool: toolItem,
  plan: (_s, i) =>
    el('ol', { class: 'ag-plan' }, i.entries.map((e) => el('li', { class: e.status }, e.status === 'completed' ? icon('check') : el('span', { class: 'ag-dot' }), el('span', { text: e.content })))),
  permission: (s, i) => (hasTool(s, i.toolCallId) ? null : permissionItem(s, i)),
  error: (_s, i) => el('div', { class: 'ag-error', text: i.text }),
  note: (_s, i) => el('div', { class: 'ag-muted', text: i.text }),
  turn: (_s, i) => (i.stopReason === 'end_turn' ? null : el('div', { class: 'ag-muted', text: i.stopReason === 'cancelled' ? 'Interrompido.' : `Turno encerrado: ${i.stopReason}` })),
};

function build(s) {
  const textarea = el('textarea', {
    class: 'input textarea ag-input',
    rows: 2,
    placeholder: `Mensagem para o ${s.label}… (Enter envia, Shift+Enter quebra linha, / comandos)`,
    onkeydown: (e) => {
      if (e.key !== 'Enter' || e.shiftKey) return;
      e.preventDefault();
      submit();
    },
  });
  const sendBtn = el('button', { class: 'btn primary', onclick: () => submit(), text: 'Enviar' });
  const stopBtn = el('button', { class: 'btn', onclick: () => s.cancel(), text: 'Interromper' });
  const files = attachmentsBox({ onError: (text) => (s.items.push({ type: 'error', text }), s.render()) });
  function submit() {
    if (!files.list.length && pickerForCommand(s, textarea.value, textarea)) return void (textarea.value = '');
    try {
      s.send(textarea.value, files.list);
      textarea.value = '';
      files.clear();
    } catch (err) {
      s.items.push({ type: 'error', text: err.message });
      s.render();
    }
  }
  attachSlash(s, textarea);
  files.bind(textarea, s.body);
  const view = {
    status: el('div', { class: 'ag-status' }),
    log: el('div', { class: 'ag-log' }),
    textarea, sendBtn, stopBtn, files,
  };
  mount(s.body, view.status, view.log, el('div', { class: 'ag-composer' }, files.chips, textarea, el('div', { class: 'ag-buttons' }, files.button, stopBtn, sendBtn)));
  return view;
}

/** Barra de estado: agente e estado; seletores (modelo, esforço, modo…); Retomar… e Nova sessão. */
function statusBar(s) {
  const busy = s.state === 'trabalhando' || s.state === 'iniciando';
  return [
    el('span', { class: `ag-state ${s.stateLabel() === 'aguardando você' ? 'aguardando' : s.state}` }),
    el('span', { text: `${s.label} · ACP · ${s.stateLabel()}` }),
    el('span', { class: 'spacer' }),
    configPickers(s, { disabled: busy }),
    s.caps?.canList ? el('button', { class: 'btn small ghost', disabled: busy, onclick: () => resumeDialog(s), text: 'Retomar…' }) : null,
    el('button', { class: 'btn small ghost', disabled: s.state === 'trabalhando', onclick: () => s.restart({ resume: null }), text: 'Nova sessão' }),
  ];
}

export function renderAgentView(s) {
  const v = (s.view ||= build(s));
  const nearBottom = v.log.scrollHeight - v.log.scrollTop - v.log.clientHeight < 60;
  mount(v.status, statusBar(s));
  mount(
    v.log,
    s.items.length ? s.items.map((i) => ITEM[i.type]?.(s, i)) : el('div', { class: 'ag-empty', text: `Converse com o ${s.label} nesta pasta. Pedidos de permissão viram “Em espera” na tarefa deste terminal.` }),
  );
  if (nearBottom) v.log.scrollTop = v.log.scrollHeight;
  const working = s.state === 'trabalhando';
  v.sendBtn.disabled = s.state !== 'pronto';
  v.stopBtn.classList.toggle('hidden', !working);
}
