// AWS na interface: o diálogo "AWS do projeto…" (perfil, região, ambiente) e o indicador da barra de status
// (perfil · conta; "sessão expirou · Entrar"; produção em destaque discreto). Só aparece em projeto com AWS.
import { el } from '../../core/dom.js';
import { currentProject } from '../../core/store.js';
import { openModal, field } from '../modal.js';
import { showMenu } from '../menu.js';
import { icon } from '../icons.js';
import { awsView, checkAws, awsProfiles } from '../../cloud/aws.js';
import { setProjectAws, awsLogin } from '../../actions/project-cloud.js';

export async function awsDialog(project) {
  const { cli, profiles } = await awsProfiles();
  const cur = project.aws || {};
  const options = [{ value: '', label: 'Nenhum (o padrão da sua máquina)' }, ...[...new Set([...profiles, cur.profile].filter(Boolean))].map((p) => ({ value: p, label: p }))];
  const v = await openModal({
    title: `AWS de “${project.name}”`,
    message: cli
      ? 'Terminais e agentes abertos daqui em diante recebem AWS_PROFILE e a região. Os que já estão abertos continuam como estão.'
      : 'A AWS CLI não foi encontrada nesta máquina; o perfil vale assim que ela for instalada.',
    fields: [
      field.select('profile', 'Perfil', cur.profile || '', { options }),
      field.text('region', 'Região', cur.region || '', { placeholder: 'sa-east-1 (vazio = a do perfil)' }),
      field.select('env', 'Ambiente', cur.prod ? 'prod' : 'dev', {
        options: [{ value: 'dev', label: 'Desenvolvimento' }, { value: 'prod', label: 'Produção — aviso visível e pedidos do agente marcados' }],
      }),
    ],
    submit: 'Salvar',
  });
  if (v) setProjectAws(project, { profile: v.profile, region: v.region, prod: v.env === 'prod' });
}

/** { kind, text, title } do perfil do projeto em foco. */
function awsState(project) {
  const { profile, prod } = project.aws;
  const id = awsView.identities[profile];
  const env = prod ? 'produção · ' : '';
  if (!id || id.state === 'checking') return { kind: 'busy', text: `${env}AWS ${profile}`, title: 'Conferindo a conta…' };
  if (id.state === 'ok') return { kind: prod ? 'warn' : 'ok', text: `${env}AWS ${profile} · ${id.account}`, title: id.arn };
  if (id.state === 'expired') return { kind: 'warn', text: `AWS ${profile} · sessão expirou · Entrar`, title: 'A sessão SSO venceu. Clique para entrar de novo (aws sso login).' };
  if (id.state === 'missing') return { kind: 'offline', text: 'AWS · CLI não encontrada', title: 'Instale a AWS CLI v2 para conferir a conta.' };
  return { kind: 'warn', text: `${env}AWS ${profile} · erro`, title: id.message || '' };
}

function menu(e, project) {
  const id = awsView.identities[project.aws.profile];
  showMenu(e, [
    id?.state === 'expired' ? { label: 'Entrar (aws sso login)', action: () => awsLogin(project) } : null,
    { label: 'Conferir de novo', action: () => checkAws(project.aws.profile, { fresh: true }) },
    { label: 'AWS do projeto…', action: () => awsDialog(project) },
  ].filter(Boolean));
}

/** Pílula da barra de status (null em projeto sem AWS). */
export function awsIndicator() {
  const project = currentProject();
  if (!project?.aws?.profile) return null;
  checkAws(project.aws.profile); // com cache: só consulta a cada 5 min
  const s = awsState(project);
  const click = (e) => (awsView.identities[project.aws.profile]?.state === 'expired' ? awsLogin(project) : menu(e, project));
  return el('button', { class: `sync-indicator aws-indicator ${s.kind}`, title: s.title, onclick: click, oncontextmenu: (e) => menu(e, project) }, icon('key'), el('span', { text: s.text }));
}
