// "Retomar…": escolher uma sessão anterior do agente nesta pasta e continuá-la (session/list + load).
// As sessões aparecem numa lista à vista (título + quando), a atual marcada; já vem escolhida a mais
// recente que não é a atual. Duplo clique retoma direto.
import { el, mount } from '../../core/dom.js';
import { timeAgo } from '../../core/format.js';
import { openModal } from '../modal.js';

function sessionRow(x, { current, checked, onPick, onOpen }) {
  const meta = [x.updatedAt ? timeAgo(Date.parse(x.updatedAt)) : null, current ? 'atual' : null].filter(Boolean).join(' · ');
  return el(
    'label',
    { class: `pick-row${checked ? ' on' : ''}`, ondblclick: onOpen },
    el('input', { type: 'radio', name: 'resume-session', value: x.sessionId, checked, onchange: onPick }),
    el(
      'span',
      { class: 'pick-text' },
      el('span', { class: 'pick-body', text: x.title || x.sessionId.slice(0, 12) }),
      el('span', { class: 'pick-meta', text: meta }),
    ),
  );
}

export async function resumeDialog(s) {
  let sessions;
  try {
    sessions = await s.listSessions();
  } catch (err) {
    return openModal({ title: 'Não foi possível listar as sessões', message: err.message });
  }
  const current = s.t.acpSessionId;
  if (!sessions.some((x) => x.sessionId !== current)) return openModal({ title: 'Retomar sessão', message: 'O agente não tem outras sessões nesta pasta.' });

  let chosen = sessions.find((x) => x.sessionId !== current).sessionId;
  const list = el('div', { class: 'resume-list' });
  const draw = () =>
    mount(
      list,
      sessions.map((x) =>
        sessionRow(x, {
          current: x.sessionId === current,
          checked: x.sessionId === chosen,
          onPick: () => ((chosen = x.sessionId), draw()),
          onOpen: () => ((chosen = x.sessionId), list.closest('form')?.requestSubmit()),
        }),
      ),
    );
  draw();

  const ok = await openModal({
    title: `Retomar sessão do ${s.label}`,
    message: `${sessions.length} sessões nesta pasta, da mais recente para a mais antiga. A escolhida volta para este terminal e o agente continua de onde parou.`,
    content: list,
    submit: 'Retomar',
    wide: true,
  });
  if (ok && chosen !== current) s.restart({ resume: chosen });
}
