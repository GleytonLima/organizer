// Provedor de embeddings falso (formato OpenAI /embeddings) para a busca semântica nos testes (cópia
// do bo-memory-web/test/lib/fake-embed.js, com os textos recebidos em `inputs`) —
// mesmo esquema do bo-memory-server/internal/semantic/fakeembed: palavras do mesmo "conceito" caem
// na mesma dimensão ("banco de dados" fica perto de "PostgreSQL"); as demais (3+ letras), uma
// dimensão por hash, então só a mesma palavra aproxima.
const http = require('http');

const CONCEPTS = [
  ['banco', 'postgres', 'postgresql', 'sql', 'database', 'dados', 'pgvector'],
  ['login', 'autenticação', 'autenticacao', 'sso', 'senha', 'oidc', 'entrar'],
  ['teste', 'testes', 'playwright', 'e2e', 'cobertura'],
  ['cor', 'cores', 'tema', 'visual', 'design', 'paleta'],
];
const HASHED = 4096;

function fnv1a(s) {
  let h = 0x811c9dc5;
  for (const b of Buffer.from(s)) h = Math.imul(h ^ b, 0x01000193) >>> 0;
  return h;
}

function vector(text) {
  const v = new Array(CONCEPTS.length + HASHED).fill(0);
  for (const w of String(text).toLowerCase().match(/[\p{L}\p{N}]+/gu) || []) {
    const c = CONCEPTS.findIndex((g) => g.includes(w));
    if (c >= 0) v[c]++;
    else if ([...w].length >= 3) v[CONCEPTS.length + (fnv1a(w) % HASHED)]++;
  }
  return v;
}

/** { url, calls, inputs (textos do último pedido), stop }. */
function startFakeEmbed() {
  const fake = { calls: 0 };
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (d) => (body += d));
    req.on('end', () => {
      fake.calls++;
      const input = JSON.parse(body || '{}').input || [];
      fake.inputs = input;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: input.map((t, index) => ({ index, embedding: vector(t) })) }));
    });
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => {
      fake.url = `http://127.0.0.1:${server.address().port}`;
      fake.stop = () => server.close();
      resolve(fake);
    }),
  );
}

module.exports = { startFakeEmbed };
