// Pasta de dados do app: %APPDATA%\Brain Organizer (até a v0.1, "Bash Organizer").
// Na primeira abertura depois da troca de nome, a pasta antiga é renomeada para a nova. Se não der
// (ex.: a versão antiga ainda aberta segurando o memory.db), este início usa a pasta antiga e tenta
// de novo na próxima vez — nada se perde. BO_USER_DATA (testes, perfil isolado) passa por cima.
const fs = require('fs');
const path = require('path');

const CURRENT = 'Brain Organizer';
const LEGACY = 'Bash Organizer'; // nome até a v0.1

/** Caminho da pasta de dados (migrando a antiga, se for o caso). `appData`: %APPDATA%; `fsx`: só nos testes. */
function dataFolder(appData, override = process.env.BO_USER_DATA, fsx = fs) {
  if (override) return { dir: override, migrated: false };
  const current = path.join(appData, CURRENT);
  const legacy = path.join(appData, LEGACY);
  if (fsx.existsSync(current) || !fsx.existsSync(legacy)) return { dir: current, migrated: false };
  try {
    fsx.renameSync(legacy, current);
    return { dir: current, migrated: true };
  } catch {
    return { dir: legacy, migrated: false }; // fica para a próxima abertura
  }
}

module.exports = { dataFolder, CURRENT, LEGACY };
