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

/** Seções de um arquivo INI da AWS: { nome → { chave: valor } } (só o que está escrito; nada é executado). */
function ini(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return {};
  }
  const out = {};
  let cur = null;
  for (const line of text.split(/\r?\n/)) {
    const head = /^\s*\[([^\]]+)\]/.exec(line);
    if (head) cur = out[head[1].trim()] = {};
    else if (cur) {
      const kv = /^\s*([\w.-]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (kv) cur[kv[1]] = kv[2];
    }
  }
  return out;
}

// do config, só o que ajuda a reconhecer a conta; do credentials, só os nomes das seções (nenhum valor sai daqui)
const SAFE = ['region', 'sso_account_id', 'sso_role_name', 'sso_start_url', 'sso_session'];

/** Perfis configurados (config + credentials), com região, SSO e a conta quando o config diz. */
function profileDetails() {
  const config = ini(configFile());
  const names = new Set(Object.keys(ini(credentialsFile())));
  const details = {};
  for (const [section, values] of Object.entries(config)) {
    if (/^sso-session\s/.test(section)) continue;
    const name = section.replace(/^profile\s+/, '').trim();
    names.add(name);
    details[name] = Object.fromEntries(SAFE.filter((k) => values[k]).map((k) => [k, values[k]]));
  }
  return [...names].sort().map((profile) => {
    const d = details[profile] || {};
    return { profile, region: d.region || '', sso: !!(d.sso_start_url || d.sso_session), account: d.sso_account_id || '', role: d.sso_role_name || '' };
  });
}

/** Nomes dos perfis configurados, sem repetir. */
const profiles = () => profileDetails().map((p) => p.profile);

/** Tem SSO (para oferecer `aws sso login` quando vence)? */
const usesSso = (profile) => !!profileDetails().find((p) => p.profile === profile)?.sso;

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

module.exports = { profiles, profileDetails, identity, loginCommand, hasCli: () => !!bin() };
