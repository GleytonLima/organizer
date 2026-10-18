// Pedidos da API local (CLI `bo`, agentes pelo MCP) que precisam do seu OK no app, porque persistem
// execução de comandos: o "comando inicial" de um terminal roda de novo a cada vez que o app abre.
// Um agente pode ter sido induzido por um texto não confiável (memória, saída de terminal) a pedi-lo.
import { commit, findTerm } from '../core/store.js';
import { termLabel } from '../core/format.js';
import { writeWhenReady } from '../terminals/sessions.js';
import { openModal } from '../ui/modal.js';

/** Pede para salvar (e rodar) o comando inicial do terminal; não espera: a API responde na hora. */
export function requestStartup(terminalId, command) {
  const entry = findTerm(terminalId);
  if (!entry) return;
  openModal({
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
