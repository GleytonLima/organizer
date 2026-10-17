// Atende os pedidos da API local repassados pelo processo principal.
import { handlers } from './handlers.js';

export function initApi() {
  api.onApiRequest(async (id, method, params) => {
    const handler = Object.hasOwn(handlers, method) ? handlers[method] : null;
    if (!handler) return api.apiRespond(id, `Método desconhecido: ${method}`);
    try {
      api.apiRespond(id, null, await handler(params || {}));
    } catch (err) {
      api.apiRespond(id, err.message || String(err));
    }
  });
}
