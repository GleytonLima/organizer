// AWS do projeto: `project.aws = { profile, region, prod }`. Os terminais e agentes do projeto nascem com
// AWS_PROFILE e a região (ver src/main/cloud/env.js); a barra de status mostra em que conta o perfil está
// e avisa quando a sessão SSO vence. Aqui só consultas e o cache da conta (estado da interface).
import { notify, findTerm } from '../core/store.js';

const REFRESH_MS = 5 * 60e3;

/** { profile, region } do projeto para o ambiente dos processos, ou null sem AWS configurada. */
export const projectCloud = (project) => (project?.aws?.profile ? { profile: project.aws.profile, region: project.aws.region || '' } : null);
export const terminalCloud = (terminalId) => projectCloud(findTerm(terminalId)?.project);

/** Conta de cada perfil: { state: 'checking'|'ok'|'expired'|'error'|'missing', account?, sso?, message?, at } */
export const awsView = { identities: {} };

/** Consulta (com cache de 5 min) em que conta o perfil está; `fresh` ignora o cache. */
export async function checkAws(profile, { fresh = false } = {}) {
  if (!profile) return null;
  const cur = awsView.identities[profile];
  if (!fresh && cur && cur.state !== 'checking' && Date.now() - cur.at < REFRESH_MS) return cur;
  if (cur?.state === 'checking') return cur;
  awsView.identities[profile] = { ...cur, state: 'checking', at: Date.now() };
  notify();
  let result;
  try {
    result = await api.cloud.awsIdentity(profile, { fresh });
  } catch (err) {
    result = { state: 'error', message: String(err?.message || err) };
  }
  awsView.identities[profile] = { ...result, at: Date.now() };
  notify();
  return awsView.identities[profile];
}

/** Perfis configurados nesta máquina (só os nomes) e se a CLI existe. */
export const awsProfiles = () => api.cloud.awsProfiles();
