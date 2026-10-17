// "Retomar…": escolher uma sessão anterior do agente nesta pasta e continuá-la (session/list + load).
import { timeAgo } from '../../core/format.js';
import { openModal, field } from '../modal.js';

export async function resumeDialog(s) {
  let sessions;
  try {
    sessions = await s.listSessions();
  } catch (err) {
    return openModal({ title: 'Não foi possível listar as sessões', message: err.message });
  }
  if (!sessions.length) return openModal({ title: 'Retomar sessão', message: 'O agente não tem sessões anteriores nesta pasta.' });
  const label = (x) => `${x.title || x.sessionId.slice(0, 12)}${x.updatedAt ? ` · ${timeAgo(Date.parse(x.updatedAt))}` : ''}${x.sessionId === s.t.acpSessionId ? ' (atual)' : ''}`;
  const v = await openModal({
    title: `Retomar sessão do ${s.label}`,
    message: 'A conversa escolhida volta para este terminal e o agente continua de onde parou.',
    fields: [field.select('sessionId', 'Sessão', sessions[0].sessionId, { options: sessions.map((x) => ({ value: x.sessionId, label: label(x) })) })],
    submit: 'Retomar',
  });
  if (v?.sessionId) s.restart({ resume: v.sessionId });
}
