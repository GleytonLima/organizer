// Configurações → Nuvem (AWS): o catálogo de contas. Cada perfil da sua ~/.aws (só o nome; região, SSO e conta
// vêm do config ou da conferência) com apelido, sistema e ambiente — é por aqui que a IA entende
// "a conta de hom da Loja". Sessão SSO vencida: "Entrar" abre o aws sso login num terminal.
import { el } from '../../core/dom.js';
import { notify } from '../../core/store.js';
import { cleanError } from '../../core/errors.js';
import { checkAws, awsProfiles } from '../../cloud/aws.js';
import { catalogEntries, ENVS } from '../../cloud/catalog.js';
import { setAwsMeta } from '../../actions/aws-catalog.js';
import { awsLoginProfile } from '../../actions/project-cloud.js';

const ui = { loaded: false, cli: true, details: [], error: '' };

export async function refreshCloud({ check = false } = {}) {
  try {
    const r = await awsProfiles();
    Object.assign(ui, { loaded: true, cli: r.cli, details: r.details, error: '' });
    if (check) await Promise.all(r.details.map((d) => checkAws(d.profile, { fresh: true })));
  } catch (err) {
    ui.error = cleanError(err);
  }
  notify();
}

const SESSION = {
  ok: 'sessão ok',
  expired: 'sessão expirou',
  error: 'erro ao conferir',
  missing: 'CLI não encontrada',
  checking: 'conferindo…',
  unknown: 'não conferida',
};

function input(profile, key, value, placeholder) {
  const node = el('input', { class: 'input', 'data-draft': `aws-${key}-${profile}`, placeholder, onchange: (e) => setAwsMeta(profile, { [key]: e.target.value }) });
  node.value = value;
  return node;
}

function row(e) {
  const facts = [e.account ? `conta ${e.account}` : null, e.region || null, e.sso ? 'SSO' : null, SESSION[e.session]].filter(Boolean).join(' · ');
  return el(
    'div',
    { class: `aws-row${e.env === 'prod' ? ' prod' : ''}`, 'data-profile': e.profile },
    el('div', { class: 'aws-row-head' },
      el('span', { class: 'aws-profile', text: e.profile }),
      el('span', { class: 'set-hint', text: facts }),
      el('span', { class: 'spacer' }),
      e.session === 'expired' ? el('button', { type: 'button', class: 'btn small', onclick: () => awsLoginProfile(e.profile), text: 'Entrar' }) : null),
    el('div', { class: 'aws-row-fields' },
      input(e.profile, 'alias', e.alias, 'Apelido (ex.: Loja — homologação)'),
      input(e.profile, 'system', e.system, 'Sistema (ex.: Loja)'),
      el('select', { class: 'input select', onchange: (ev) => setAwsMeta(e.profile, { env: ev.target.value }) },
        ENVS.map((o) => el('option', { value: o.value, selected: o.value === e.env, text: o.value ? o.label : 'Ambiente…' })))),
  );
}

export function cloudSection() {
  if (!ui.loaded) refreshCloud();
  const entries = catalogEntries(ui.details);
  return [
    el('h3', { class: 'set-title', text: 'Nuvem (AWS)' }),
    el('p', { class: 'set-hint', text: 'A IA usa este catálogo para entender pedidos como “olhe os logs da Loja em homologação”: ela escolhe o perfil certo e sempre passa --profile. Da sua ~/.aws saem só os nomes dos perfis, a região, o SSO e a conta — nunca as chaves.' }),
    ui.error ? el('p', { class: 'set-error', text: ui.error }) : null,
    !ui.cli ? el('p', { class: 'set-hint', text: 'A AWS CLI não foi encontrada: a conta e a sessão não podem ser conferidas até ela ser instalada.' }) : null,
    entries.length
      ? [el('div', { class: 'aws-list' }, entries.map(row)), el('button', { type: 'button', class: 'btn aws-check', onclick: () => refreshCloud({ check: true }), text: 'Conferir contas' })]
      : ui.loaded ? el('p', { class: 'set-hint', text: 'Nenhum perfil em ~/.aws/config ou credentials.' }) : el('p', { class: 'set-hint', text: 'Lendo os perfis…' }),
  ];
}
