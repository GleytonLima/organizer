// Pedidos da API local (CLI `bo`, agentes pelo MCP) que precisam do seu OK no app. Um agente pode ter
// sido induzido por um texto não confiável (memória, saída de terminal) a pedi-los:
//   - comando inicial de um terminal (roda de novo a cada vez que o app abre);
//   - digitar em (ou fechar) um terminal que não é o de quem pede, nem foi aberto por ele;
//   - apagar uma memória (some também do time, se ela sincroniza).
// Um pedido por vez (o diálogo é um só); "Sempre deste terminal" vale até o app fechar.
import { commit, findTerm } from '../core/store.js';
import { termLabel } from '../core/format.js';
import { writeWhenReady } from '../terminals/sessions.js';
import { openModal } from '../ui/modal.js';

let queue = Promise.resolve();
const ask = (opts) => (queue = queue.then(() => openModal(opts), () => openModal(opts)));
const trusted = new Set(); // "origem→destino" liberados com "Sempre deste terminal"

const label = (id) => {
  const e = findTerm(id);
  return e ? `“${termLabel(e.t)}”` : 'um processo';
};

/** Pede para salvar (e rodar) o comando inicial do terminal; não espera: a API responde na hora. */
export function requestStartup(terminalId, command) {
  const entry = findTerm(terminalId);
  if (!entry) return;
  ask({
    title: 'Salvar comando inicial?',
    message: `Um agente ou o CLI pediu para o terminal “${termLabel(entry.t)}” rodar este comando agora e toda vez que o app abrir:\n\n${command}\n\nSó permita se você confia nele.`,
    submit: 'Permitir e rodar',
    danger: true,
  }).then((ok) => {
    const now = findTerm(terminalId);
    if (!ok || !now) return;
    now.t.startup = command;
    commit();
    writeWhenReady(terminalId, `${command}\r`);
  });
}

/**
 * Pedido de um terminal (`caller`, identificado pelo token dele) para agir em outro (`target`):
 * livre no próprio terminal e nos que ele abriu; nos demais, só com o seu OK. Lança se você recusar.
 */
export async function approveCrossTerminal(caller, target, action, detail = '') {
  if (!caller?.terminal) return; // token mestre: você mesmo, fora do app
  const from = caller.terminal;
  const key = `${from}→${target.t.id}`;
  if (target.t.id === from || target.t.openedBy === from || trusted.has(key)) return;
  const what = detail ? `:\n\n${detail}` : '.';
  const answer = await ask({
    title: `${action} em outro terminal?`,
    message: `O terminal ${label(from)} quer ${action.toLowerCase()} no terminal “${termLabel(target.t)}”${what}\n\nSó permita se foi você quem pediu.`,
    submit: 'Permitir',
    danger: true,
    extra: { label: 'Sempre deste terminal', value: 'always' },
  });
  if (answer === 'always') trusted.add(key);
  else if (!answer) throw new Error(`O usuário não permitiu ${action.toLowerCase()} no terminal “${termLabel(target.t)}”.`);
}

/** Apagar memória pedido por um terminal: só com o seu OK (pelo token mestre, segue direto). */
export async function approveForget(caller, memory) {
  if (!caller?.terminal) return;
  const ok = await ask({
    title: 'Apagar memória?',
    message: `O terminal ${label(caller.terminal)} pediu para apagar:\n\n“${memory?.text || '(memória)'}”\n\nSe ela sincroniza com o servidor, some também para o time.`,
    submit: 'Apagar',
    danger: true,
  });
  if (!ok) throw new Error('O usuário não permitiu apagar a memória.');
}
