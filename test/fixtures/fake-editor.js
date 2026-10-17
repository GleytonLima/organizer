// Editor falso para os testes de "Abrir no VS Code": registra a pasta recebida em FAKE_EDITOR_LOG.
const fs = require('fs');
fs.appendFileSync(process.env.FAKE_EDITOR_LOG, `${JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd() })}\n`);
