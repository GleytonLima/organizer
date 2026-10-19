// Catálogo de contas AWS: os perfis da máquina (nome, região, SSO, conta) com o que só você sabe — apelido
// ("Loja — homologação"), sistema ("Loja") e ambiente (dev | hom | prod). É o que a IA consulta para
// entender "a conta de hom da Loja" (MCP list_aws_profiles). Guardado em `state.awsCatalog`.
import { store } from '../core/store.js';
import { awsView } from './aws.js';

export const ENVS = [
  { value: '', label: '—' },
  { value: 'dev', label: 'Desenvolvimento' },
  { value: 'hom', label: 'Homologação' },
  { value: 'prod', label: 'Produção' },
];

/** O que você anotou sobre um perfil: { alias, system, env }. */
export const awsMeta = (profile) => store.state.awsCatalog?.[profile] || {};

export const isProdProfile = (profile) => awsMeta(profile).env === 'prod';

/** Perfis citados num comando: `--profile X`, `--profile=X` ou `AWS_PROFILE=X`. */
export const profilesIn = (text) => [...String(text || '').matchAll(/(?:--profile[ =]|AWS_PROFILE=)["']?([\w.@+-]{1,64})/g)].map((m) => m[1]);

/** O primeiro perfil de produção citado no comando (ou null). */
export const prodProfileIn = (text) => profilesIn(text).find(isProdProfile) || null;

/** Nome para mostrar: "Loja — homologação" (ou o próprio perfil). */
export const profileLabel = (profile) => awsMeta(profile).alias || profile;

/**
 * Entradas completas: os perfis detectados (`details`, de api.cloud.awsProfiles) com as suas anotações e a
 * conta/sessão conhecidas. A conta vem do config (SSO) ou da última conferência.
 */
export function catalogEntries(details) {
  return details.map((d) => {
    const meta = awsMeta(d.profile);
    const id = awsView.identities[d.profile];
    return {
      profile: d.profile,
      alias: meta.alias || '',
      system: meta.system || '',
      env: meta.env || '',
      region: d.region,
      sso: d.sso,
      account: id?.account || d.account || '',
      session: id ? (id.state === 'checking' ? 'checking' : id.state) : 'unknown', // ok | expired | error | missing | unknown
    };
  });
}
