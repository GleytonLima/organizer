// Pedidos de permissão do agente (session/request_permission): ficam pendentes até alguém responder
// — na conversa ou na tarefa em espera — ou até o turno ser interrompido (resposta "cancelled").
class PermissionGate {
  constructor(emit) {
    this.emit = emit;
    this.pending = new Map(); // requestId → resolve
    this.seq = 0;
  }

  ask({ toolCall, options }) {
    const requestId = ++this.seq;
    return new Promise((resolve) => {
      this.pending.set(requestId, resolve);
      this.emit({ type: 'permission', requestId, toolCall, options });
    });
  }

  /** `optionId` null = cancelado. */
  answer(requestId, optionId) {
    const resolve = this.pending.get(requestId);
    if (!resolve) return false;
    this.pending.delete(requestId);
    resolve({ outcome: optionId ? { outcome: 'selected', optionId } : { outcome: 'cancelled' } });
    this.emit({ type: 'permission-answered', requestId, optionId });
    return true;
  }

  cancelAll() {
    for (const id of [...this.pending.keys()]) this.answer(id, null);
  }
}

module.exports = { PermissionGate };
