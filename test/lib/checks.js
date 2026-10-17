// Registro de asserções: cada verificação imprime ✓/✗ na hora e entra no resumo da suíte.
const util = require('util');

const show = (v) => (typeof v === 'string' ? JSON.stringify(v) : util.inspect(v, { depth: 4, breakLength: 120 }));

function createChecks(print) {
  const results = [];

  function record(ok, label, detail) {
    results.push({ ok: !!ok, label, detail: ok ? undefined : detail });
    print(ok ? `  ✓ ${label}` : `  ✗ ${label}${detail ? `\n      ${detail}` : ''}`);
    return !!ok;
  }

  return {
    results,
    /** Passa se `cond` for verdadeiro; `detail` aparece só na falha. */
    check: (cond, label, detail) => record(cond, label, detail),
    equal: (actual, expected, label) =>
      record(util.isDeepStrictEqual(actual, expected), label, `esperado ${show(expected)}, obtido ${show(actual)}`),
    includes: (text, part, label) =>
      record(typeof text === 'string' && text.includes(part), label, `${show(part)} não aparece em ${show(text)}`),
    match: (text, re, label) => record(typeof text === 'string' && re.test(text), label, `${re} não casa com ${show(text)}`),
    /** Erro registrado como falha (ex.: exceção inesperada no corpo do teste). */
    fail: (label, detail) => record(false, label, detail),
    failed: () => results.filter((r) => !r.ok).length,
  };
}

module.exports = { createChecks };
