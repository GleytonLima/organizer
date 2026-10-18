// Espera até a saída de um terminal casar com uma expressão regular.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @returns {{ matched: boolean, timedOut?: boolean, reason?: string, output: string }}
 */
async function waitForOutput(request, { terminal, pattern, timeout = 60, interval = 1000 }) {
  if (!pattern) throw new Error('Informe o padrão (regex) a esperar.');
  if (String(pattern).length > 200) throw new Error('Padrão longo demais (máx. 200 caracteres).'); // ReDoS
  const re = new RegExp(pattern, 'mi');
  const deadline = Date.now() + timeout * 1000;
  for (;;) {
    const r = await request('read', { terminal, lines: 300 });
    if (re.test(r.output || '')) return { matched: true, ...r };
    if (r.status === 'exited') return { matched: false, reason: 'o shell foi encerrado', ...r };
    if (Date.now() >= deadline) return { matched: false, timedOut: true, ...r };
    await sleep(interval);
  }
}

module.exports = { waitForOutput };
