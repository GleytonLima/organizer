// IPC da nuvem (AWS CLI): perfis configurados e em que conta o perfil do projeto está agora.
const { ipcMain } = require('electron');
const aws = require('./aws');
const { PROFILE } = require('./env');

function registerCloudIpc() {
  ipcMain.handle('cloud:awsProfiles', () => ({ cli: aws.hasCli(), profiles: aws.profiles() }));
  ipcMain.handle('cloud:awsIdentity', (_e, profile, opts) => {
    if (!PROFILE.test(String(profile || ''))) throw new Error('Perfil AWS inválido.');
    return aws.identity(String(profile), { fresh: !!opts?.fresh });
  });
}

module.exports = { registerCloudIpc };
