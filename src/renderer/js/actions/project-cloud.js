// Ações da AWS do projeto: escolher perfil/região/ambiente e entrar de novo quando a sessão SSO vence.
import { commit } from '../core/store.js';
import { newTerminal } from './terminals.js';
import { checkAws } from '../cloud/aws.js';

/** `aws`: { profile, region, prod } — perfil vazio tira a AWS do projeto. */
export function setProjectAws(project, { profile = '', region = '', prod = false }) {
  const p = String(profile || '').trim();
  project.aws = p ? { profile: p, region: String(region || '').trim(), prod: !!prod } : null;
  commit();
  if (p) checkAws(p, { fresh: true });
}

/** Abre um terminal do projeto com o `aws sso login` do perfil; ao voltar à janela, confere de novo. */
export function awsLogin(project) {
  const profile = project.aws?.profile;
  if (!profile) return;
  newTerminal(project.groups[0], { name: 'AWS login', startup: `aws sso login --profile ${profile}` });
  window.addEventListener('focus', () => checkAws(profile, { fresh: true }), { once: true });
}
