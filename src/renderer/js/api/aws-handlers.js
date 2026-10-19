// Métodos da API para o catálogo de contas AWS (usados pelo MCP — a IA — e pelo `bo aws`).
import { callerOf } from './resolve.js';
import { checkAws, awsProfiles } from '../cloud/aws.js';
import { catalogEntries, awsMeta } from '../cloud/catalog.js';

const PROFILE = /^[\w.@+-]{1,64}$/;

export const awsHandlers = {
  /** Todos os perfis com apelido, sistema, ambiente, conta e sessão; `check: false` não confere as contas. */
  async aws_profiles(p) {
    const { cli, details } = await awsProfiles();
    if (cli && p.check !== false) await Promise.all(details.map((d) => checkAws(d.profile))); // cache de 5 min
    const project = callerOf(p)?.project;
    return { cli, projectDefault: project?.aws?.profile || null, profiles: catalogEntries(details) };
  },

  /** Confere agora em que conta o perfil está (sessão ok, vencida…). */
  async aws_identity(p) {
    if (!PROFILE.test(String(p.profile || ''))) throw new Error('Informe o perfil AWS (nome como em ~/.aws/config).');
    const id = await checkAws(p.profile, { fresh: true });
    return { profile: p.profile, ...awsMeta(p.profile), ...id };
  },
};
