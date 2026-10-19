// Claude Code falso para os testes da primeira abertura (BO_CLAUDE_BIN): responde --version e grava
// `mcp add`/`mcp remove` no .claude.json de CLAUDE_CONFIG_DIR, como o de verdade (escopo do usuário).
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const file = path.join(process.env.CLAUDE_CONFIG_DIR, '.claude.json');
const read = () => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {});
fs.appendFileSync(path.join(process.env.CLAUDE_CONFIG_DIR, 'calls.log'), JSON.stringify(args) + '\n');

if (args[0] === '--version') {
  console.log('9.9.9 (Claude Code)');
} else if (args[0] === 'mcp' && args[1] === 'add') {
  const sep = args.indexOf('--');
  const env = Object.fromEntries(args.slice(0, sep).flatMap((a, i) => (args[i - 1] === '-e' ? [a.split('=')] : [])));
  const cfg = read();
  cfg.mcpServers = { ...cfg.mcpServers, [args[2]]: { type: 'stdio', command: args[sep + 1], args: args.slice(sep + 2), env } };
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
  console.log(`Added stdio MCP server ${args[2]}`);
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
