// CLI de agente falso (Claude Code, Devin) para os testes dos Primeiros passos (BO_CLAUDE_BIN,
// BO_DEVIN_BIN): `node fake-agent-cli.js <arquivo de config> <versão> [args…]`. Responde --version e grava
// `mcp add`/`mcp remove` em mcpServers do arquivo de config, como os de verdade (escopo do usuário).
const fs = require('fs');

const [file, version, ...args] = process.argv.slice(2);
const read = () => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {});
fs.appendFileSync(`${file}.calls.log`, JSON.stringify(args) + '\n');

if (args[0] === '--version') {
  console.log(version);
} else if (args[0] === 'mcp' && args[1] === 'add') {
  const sep = args.indexOf('--');
  const env = Object.fromEntries(args.slice(0, sep).flatMap((a, i) => (args[i - 1] === '-e' ? [a.split('=')] : [])));
  const cfg = read();
  cfg.mcpServers = { ...cfg.mcpServers, [args[2]]: { command: args[sep + 1], args: args.slice(sep + 2), env } };
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
  console.log(`Added MCP server ${args[2]}`);
} else if (args[0] === 'mcp' && args[1] === 'remove') {
  const cfg = read();
  if (!cfg.mcpServers?.[args[2]]) {
    console.error(`No MCP server found with name: ${args[2]}`);
    process.exit(1);
  }
  delete cfg.mcpServers[args[2]];
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
} else {
  process.exit(2);
}
