// Estado da conexão com o servidor do time, sempre visível na barra de status (e na seção
// Configurações → Servidor do time). Clicar abre a seção. Sem servidor: "Local" — é um modo válido.
import { el } from '../core/dom.js';
import { syncView } from '../memory/sync.js';
import { taskSyncView } from '../tasks/sync.js';
import { icon } from './icons.js';

/** Memórias + tarefas esperando o servidor. */
export const pendingCount = () => (syncView.status.pending || 0) + taskSyncView.pending;

const clock = (at) => (at ? new Date(at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');

/** { kind, text, title } do estado atual. */
export function syncState() {
  const { state, at, error } = syncView.status;
  const n = pendingCount();
  const queue = n ? ` · ${n} na fila` : '';
  switch (state) {
    case 'off':
      return { kind: 'local', text: 'Local', title: 'Tudo fica nesta máquina. Clique para conectar ao servidor do time (opcional).' };
    case 'syncing':
      return { kind: 'busy', text: 'Sincronizando…', title: 'Enviando e recebendo do servidor do time' };
    case 'ok':
      return { kind: 'ok', text: `Sincronizado${queue}`, title: `Sincronizado às ${clock(at)}` };
    case 'offline':
      return { kind: 'offline', text: `Offline${queue}`, title: `${error}\nVocê continua trabalhando; o que mudar sobe quando o servidor voltar.` };
    case 'auth':
      return { kind: 'warn', text: 'Sessão expirou · Entrar', title: 'Entre de novo para voltar a sincronizar (nada se perde).' };
    default:
      return { kind: 'warn', text: 'Erro no sync', title: error || '' };
  }
}

export const syncStateText = () => syncState().text;

/** Botão da barra de status. */
export function syncIndicator(onClick) {
  const s = syncState();
  return el('button', { class: `sync-indicator ${s.kind}`, title: s.title, onclick: onClick }, icon('cloud'), el('span', { text: s.text }));
}
