// Só a página do próprio app (src/renderer/index.html) fala com o processo principal: um conteúdo
// que, por algum caminho, carregasse na janela (ou num iframe) não usa pty, arquivos ou agentes.
// Aplicado antes de qualquer módulo registrar canais (ver index.js): envolve ipcMain.handle e .on.
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { ipcMain } = require('electron');

const APP_PAGE = pathToFileURL(path.join(__dirname, '..', 'renderer', 'index.html')).href;

/** O remetente é o frame principal com a página do app (sem query/hash diferentes do arquivo). */
function fromApp(event) {
  const frame = event.senderFrame;
  if (!frame || frame.parent) return false; // iframe nunca
  return String(frame.url || '').split(/[?#]/)[0] === APP_PAGE;
}

function guardIpc() {
  const handle = ipcMain.handle.bind(ipcMain);
  const on = ipcMain.on.bind(ipcMain);
  ipcMain.handle = (channel, fn) =>
    handle(channel, (event, ...args) => {
      if (!fromApp(event)) throw new Error('Remetente não autorizado.');
      return fn(event, ...args);
    });
  ipcMain.on = (channel, fn) =>
    on(channel, (event, ...args) => {
      if (!fromApp(event)) {
        event.returnValue = undefined; // canais síncronos não ficam esperando
        return;
      }
      fn(event, ...args);
    });
}

module.exports = { guardIpc, fromApp };
