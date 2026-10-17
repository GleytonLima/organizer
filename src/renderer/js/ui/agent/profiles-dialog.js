// "Agentes (ACP)…": escolher, criar, editar e remover perfis de agente (ver agents/profiles.js).
import { cleanError } from '../../core/errors.js';
import { agentProfiles, saveProfile, removeProfile } from '../../agents/profiles.js';
import { openModal, field } from '../modal.js';
import { confirmDanger } from '../confirm.js';

const MODE_HINT = 'Opcional. Modo de permissão ao abrir a sessão, se o agente tiver — no Claude Code: default, acceptEdits, plan, bypassPermissions. Dá para trocar na conversa.';

async function editProfile(profile = null) {
  const builtin = !!profile?.builtin;
  const v = await openModal({
    title: profile ? `Agente: ${profile.label}` : 'Novo agente (ACP)',
    message: builtin ? 'Embutido: o Claude Code pelo adaptador ACP, com o seu login do Claude Code CLI.' : 'Qualquer CLI que fale ACP (Agent Client Protocol) pelo stdio.',
    fields: [
      field.text('label', 'Nome', profile?.label || '', { placeholder: 'Gemini' }),
      builtin ? null : field.text('command', 'Comando', profile?.command || '', { placeholder: 'gemini', mono: true, hint: 'Executável no PATH (ou caminho completo).' }),
      builtin ? null : field.text('args', 'Argumentos', profile?.args || '', { placeholder: '--experimental-acp', mono: true }),
      field.textarea('env', 'Variáveis de ambiente', profile?.env || '', { rows: 3, placeholder: 'NOME=valor (uma por linha)' }),
      field.text('mode', 'Modo padrão', profile?.mode || '', { placeholder: 'acceptEdits', mono: true, hint: MODE_HINT }),
    ].filter(Boolean),
    submit: 'Salvar',
    extra: profile && !builtin ? { label: 'Remover', value: 'remove', danger: true } : null,
    wide: true,
  });
  if (!v) return;
  try {
    if (v === 'remove') {
      if (await confirmDanger({ title: `Remover “${profile.label}”?`, message: 'Terminais que usam este agente passam a usar o Claude Code.' })) removeProfile(profile);
      return;
    }
    saveProfile({ ...v, id: profile?.id });
  } catch (err) {
    await openModal({ title: 'Não foi possível salvar', message: cleanError(err) });
  }
}

/** Lista os perfis; editar ou criar volta para a lista até você fechar. */
export async function agentsDialog() {
  for (;;) {
    const profiles = agentProfiles();
    const v = await openModal({
      title: 'Agentes (ACP)',
      message: 'Perfis usados em “Nova sessão de agente”. Cada um diz como iniciar o agente e em que modo.',
      fields: [field.select('id', 'Agente', profiles[0].id, { options: profiles.map((p) => ({ value: p.id, label: p.builtin ? `${p.label} (embutido)` : `${p.label} — ${p.command} ${p.args}`.trim() })) })],
      submit: 'Editar…',
      extra: { label: 'Novo agente…', value: 'new' },
    });
    if (!v) return;
    await editProfile(v === 'new' ? null : profiles.find((p) => p.id === v.id));
  }
}
