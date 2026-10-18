// Arquivo só do usuário (o api.json guarda o token mestre). No Unix basta o modo 0600; no Windows o
// chmod não vale nada e o arquivo herda o ACL da pasta do perfil — que pode incluir outros grupos
// (ex.: sandboxes de ferramentas). Lá: sem herança, controle total só para você e o SYSTEM.
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');

// caminho completo: no PATH de um app aberto pelo Git Bash, "whoami" é o do coreutils
const sys32 = (exe) => path.join(process.env.SystemRoot || String.raw`C:\Windows`, 'System32', exe);

const run = (cmd, args) =>
  new Promise((resolve, reject) =>
    execFile(cmd, args, { windowsHide: true, timeout: 10000 }, (err, stdout) => (err ? reject(new Error(err.message)) : resolve(stdout))),
  );

let sid = null;
async function userSid() {
  sid ||= (await run(sys32('whoami.exe'), ['/user', '/fo', 'csv', '/nh'])).trim().split(',').pop().replaceAll('"', '');
  return sid;
}

/** Restringe o arquivo (criado vazio se faltar) ao usuário atual. */
async function restrictToUser(file) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, '');
  if (process.platform !== 'win32') return fs.chmodSync(file, 0o600);
  await run(sys32('icacls.exe'), [file, '/inheritance:r', '/grant:r', `*${await userSid()}:F`, '/grant:r', '*S-1-5-18:F']);
}

/** Grava o conteúdo num arquivo já restrito (sem renomear: o rename traria o ACL herdado do temporário). */
async function writePrivate(file, text) {
  try {
    await restrictToUser(file);
  } catch (err) {
    console.error('não foi possível restringir', file, err.message);
  }
  fs.writeFileSync(file, text);
}

module.exports = { restrictToUser, writePrivate };
