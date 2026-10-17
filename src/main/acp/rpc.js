// JSON-RPC 2.0 sobre stdio (uma mensagem por linha), nos dois sentidos — como o ACP exige:
// o cliente chama o agente (initialize, session/prompt…) e o agente também chama o cliente
// (session/request_permission) e notifica (session/update).
const readline = require('readline');

class RpcPeer {
  /** `input`: stream lida (stdout do agente); `output`: stream escrita (stdin do agente). */
  constructor(input, output) {
    this.output = output;
    this.seq = 0;
    this.pending = new Map(); // id → { resolve, reject }
    this.handlers = new Map(); // método → (params) => resultado (pedidos do agente)
    this.listeners = new Map(); // método → (params) => void (notificações do agente)
    readline.createInterface({ input }).on('line', (line) => this.receive(line));
  }

  send(msg) {
    this.output.write(`${JSON.stringify({ jsonrpc: '2.0', ...msg })}\n`);
  }

  request(method, params) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.send({ id, method, params });
    });
  }

  notify(method, params) {
    this.send({ method, params });
  }

  onRequest(method, fn) {
    this.handlers.set(method, fn);
  }

  onNotification(method, fn) {
    this.listeners.set(method, fn);
  }

  /** Rejeita tudo que está pendente (o agente encerrou). */
  close(reason) {
    for (const p of this.pending.values()) p.reject(new Error(reason));
    this.pending.clear();
  }

  async receive(line) {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return; // linha que não é JSON (log do agente): ignora
    }
    if (msg.id != null && !msg.method) {
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      if (msg.error) p.reject(Object.assign(new Error(msg.error.message || 'Erro do agente'), { code: msg.error.code, data: msg.error.data }));
      else p.resolve(msg.result);
      return;
    }
    if (msg.id == null) return this.listeners.get(msg.method)?.(msg.params);
    const fn = this.handlers.get(msg.method);
    if (!fn) return this.send({ id: msg.id, error: { code: -32601, message: `Método não suportado: ${msg.method}` } });
    try {
      this.send({ id: msg.id, result: (await fn(msg.params)) ?? null });
    } catch (err) {
      this.send({ id: msg.id, error: { code: -32603, message: err.message } });
    }
  }
}

module.exports = { RpcPeer };
