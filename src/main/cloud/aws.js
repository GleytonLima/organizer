// AWS CLI: quais perfis existem (~/.aws/config e credentials — só os nomes, nunca as chaves) e em que conta
// um perfil está agora (`aws sts get-caller-identity`, com cache curto). Sessão SSO vencida vira
// { state: 'expired' } para a barra de status oferecer "Entrar" (`aws sso login`).
// AWS_CONFIG_FILE / AWS_SHARED_CREDENTIALS_FILE mudam os arquivos (como na própria CLI); BO_AWS_BIN, o executável.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { findBin, runBin } = require('../setup/run');

const CACHE_MS = 5 * 60e3;
const configFile = () => process.env.AWS_CONFIG_FILE || path.join(os.homedir(), '.aws', 'config');
const credentialsFile = () => process.env.AWS_SHARED_CREDENTIALS_FILE || path.join(os.homedir(), '.aws', 'credentials');
const bin = () => findBin(['aws.exe', 'aws.cmd'], [path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Amazon', 'AWSCLIV2')], process.env.BO_AWS_BIN);

function sections(file, prefix) {
  try {
    return [...fs.readFileSync(file, 'utf8').matchAll(/^\s*\[([^\]]+)\]/gm)].map((m) => m[1].trim()).filter((s) => !/^sso-session\s/.test(s)).map((s) => s.replace(prefix, '').trim());
  } catch {
    return [];
  }
}

/** Nomes dos perfis configurados (config + credentials), sem repetir. */
const profiles = () => [...new Set([...sections(configFile(), /^profile\s+/), ...sections(credentialsFile(), /^$/)])].sort();

/** Tem SSO (para oferecer `aws sso login` quando vence)? */
function usesSso(profile) {
  try {
    const text = fs.readFileSync(configFile(), 'utf8');
    const head = profile === 'default' ? /^\s*\[default\]/m : new RegExp(`^\\s*\\[profile\\s+${profile.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`, 'm');
    const start = text.search(head);
    if (start < 0) return false;
    const body = text.slice(start).split(/\n\s*\[/)[0];
    return /^\s*sso_(start_url|session)\s*=/m.test(body);
  } catch {
    return false;
  }
}

const EXPIRED = /expired|ExpiredToken|Token has expired|refresh failed|sso session|UnauthorizedSSOToken|InvalidClientTokenId/i;
const cache = new Map(); // perfil → { at, result }

/** { state: 'ok', account, arn } | { state: 'expired', sso } | { state: 'error', message } | { state: 'missing' } */
async function identity(profile, { fresh = false } = {}) {
  const b = bin();
  if (!b) return { state: 'missing' };
  const hit = cache.get(profile);
  if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.result;
  const r = await runBin(b, ['sts', 'get-caller-identity', '--output', 'json', '--profile', profile], { timeout: 20000 });
  let result;
  try {
    const data = JSON.parse(r.out);
    result = { state: 'ok', account: data.Account, arn: data.Arn };
  } catch {
    result = EXPIRED.test(r.out) ? { state: 'expired', sso: usesSso(profile) } : { state: 'error', message: r.out.split(/\r?\n/).filter(Boolean).pop() || 'falhou' };
  }
  cache.set(profile, { at: Date.now(), result });
  return result;
}

/** Linha para entrar de novo num terminal do app. */
const loginCommand = (profile) => `aws sso login --profile ${profile}`;

module.exports = { profiles, identity, loginCommand, hasCli: () => !!bin() };
