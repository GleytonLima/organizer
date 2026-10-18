// O que gera notificações a partir do próprio terminal, sem integração específica:
//   - bell (\a), usado por vários CLIs (ex.: Claude Code com o canal "terminal_bell")
//   - OSC 9;<mensagem>        (estilo Windows Terminal / iTerm2)
//   - OSC 777;notify;<título>;<corpo>
//   - comandos longos (≥ 15 s) que terminam enquanto você não está olhando
import { pushNotification } from './center.js';

const BELL_COOLDOWN_MS = 4000;
const LONG_COMMAND_MS = 15000;

const OSC_COOLDOWN_MS = 5000;

export function attachNotifySources(id, term) {
  let lastBell = 0;
  let lastOsc = 0;
  // a saída de qualquer programa pode emitir OSC 9/777: no máximo um aviso a cada 5 s por terminal
  // (o título do aviso já diz de qual terminal veio — ver center.js)
  const oscAllowed = () => {
    const now = Date.now();
    if (now - lastOsc < OSC_COOLDOWN_MS) return false;
    lastOsc = now;
    return true;
  };
  term.onBell(() => {
    const now = Date.now();
    if (now - lastBell < BELL_COOLDOWN_MS) return;
    lastBell = now;
    pushNotification({ terminalId: id, body: 'Pediu sua atenção' });
  });

  term.parser.registerOscHandler(9, (data) => {
    if (/^\d+;/.test(data)) return false; // subcomandos ConEmu/WT (ex.: 9;4 progresso, 9;9 pasta)
    if (oscAllowed()) pushNotification({ terminalId: id, body: String(data).slice(0, 200) });
    return true;
  });

  term.parser.registerOscHandler(777, (data) => {
    const [kind, title, ...body] = data.split(';');
    if (kind !== 'notify') return false;
    if (oscAllowed()) pushNotification({ terminalId: id, label: String(title).slice(0, 80), body: body.join(';').slice(0, 200) });
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
