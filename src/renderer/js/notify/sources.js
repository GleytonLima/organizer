// O que gera notificações a partir do próprio terminal, sem integração específica:
//   - bell (\a), usado por vários CLIs (ex.: Claude Code com o canal "terminal_bell")
//   - OSC 9;<mensagem>        (estilo Windows Terminal / iTerm2)
//   - OSC 777;notify;<título>;<corpo>
//   - comandos longos (≥ 15 s) que terminam enquanto você não está olhando
import { pushNotification } from './center.js';

const BELL_COOLDOWN_MS = 4000;
const LONG_COMMAND_MS = 15000;

export function attachNotifySources(id, term) {
  let lastBell = 0;
  term.onBell(() => {
    const now = Date.now();
    if (now - lastBell < BELL_COOLDOWN_MS) return;
    lastBell = now;
    pushNotification({ terminalId: id, body: 'Pediu sua atenção' });
  });

  term.parser.registerOscHandler(9, (data) => {
    if (/^\d+;/.test(data)) return false; // subcomandos ConEmu/WT (ex.: 9;4 progresso, 9;9 pasta)
    pushNotification({ terminalId: id, body: data });
    return true;
  });

  term.parser.registerOscHandler(777, (data) => {
    const [kind, title, ...body] = data.split(';');
    if (kind !== 'notify') return false;
    pushNotification({ terminalId: id, label: title, body: body.join(';') });
    return true;
  });
}

const duration = (ms) => {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}min ${s % 60}s`;
};

/** Chamado quando um comando termina (OSC 6973;end). */
export function commandFinished(id, running, exitCode) {
  if (!running) return;
  const elapsed = Date.now() - running.since;
  if (elapsed < LONG_COMMAND_MS) return;
  const outcome = exitCode ? `falhou (saiu com ${exitCode})` : 'terminou';
  pushNotification({ terminalId: id, body: `“${running.cmd}” ${outcome} em ${duration(elapsed)}` });
}
