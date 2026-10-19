// `bo aws`: o catálogo de contas AWS pela linha de comando (mesmos métodos do MCP).
const { request } = require('./client');

const ENV = { dev: 'dev', hom: 'hom', prod: 'PROD' };
const line = (p) =>
  [p.profile.padEnd(16), (ENV[p.env] || '—').padEnd(5), (p.alias || '').padEnd(28), p.account || '', p.region || '', p.session !== 'ok' ? `(${p.session})` : ''].filter(Boolean).join('  ');

/** bo aws [whoami <perfil>] */
async function aws({ pos, opts }) {
  const [action, profile] = pos;
  if (action === 'whoami') {
    const r = await request('aws_identity', { profile });
    return console.log(opts.json ? JSON.stringify(r, null, 2) : `${profile}: ${r.state === 'ok' ? `conta ${r.account} (${r.arn})` : r.state}`);
  }
  const r = await request('aws_profiles', { check: opts.check !== false }); // --no-check vira check: false
  console.log(opts.json ? JSON.stringify(r, null, 2) : r.profiles.map(line).join('\n') || '(nenhum perfil em ~/.aws)');
}

module.exports = { aws };
