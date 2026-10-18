// Ponte de pedidos main → renderer: o estado (projetos, terminais) vive no renderer.
const { ipcMain } = require('electron');
const { getWindow, sendToWindow } = require('../window');

const TIMEOUT_MS = 15000;
// Métodos que podem esperar a sua confirmação no app (approvals.js, excluir tarefa): mais tempo.
// Mesma lista em bin/lib/client.js.
const ASKS_YOU = new Set(['send', 'close', 'memory_forget', 'task_delete']);
const ASK_TIMEOUT_MS = 5 * 60000;
const pending = new Map(); // id -> { resolve, reject, timer }
let seq = 0;

function callRenderer(method, params) {
  return new Promise((resolve, reject) => {
    if (!getWindow()) return reject(new Error('A janela do app não está aberta.'));
    const id = ++seq;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Sem resposta do app para "${method}".`));
    }, ASKS_YOU.has(method) ? ASK_TIMEOUT_MS : Number(process.env.BO_BRIDGE_TIMEOUT_MS) || TIMEOUT_MS); // variável: só nos testes
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
