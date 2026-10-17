// Ponte de pedidos main → renderer: o estado (projetos, terminais) vive no renderer.
const { ipcMain } = require('electron');
const { getWindow, sendToWindow } = require('../window');

const TIMEOUT_MS = 15000;
const pending = new Map(); // id -> { resolve, reject, timer }
let seq = 0;

function callRenderer(method, params) {
  return new Promise((resolve, reject) => {
    if (!getWindow()) return reject(new Error('A janela do app não está aberta.'));
    const id = ++seq;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Sem resposta do app para "${method}".`));
    }, TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    sendToWindow('api:request', id, method, params);
  });
}

function registerBridgeIpc() {
  ipcMain.on('api:response', (_e, id, error, result) => {
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    clearTimeout(p.timer);
    if (error) p.reject(new Error(error));
    else p.resolve(result);
  });
}

module.exports = { callRenderer, registerBridgeIpc };
