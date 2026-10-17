// Formatação de saída do CLI (texto legível para humanos).
const STATUS = { running: '▶', error: '✖', exited: '■', idle: '·' };

function terminalLine(t) {
  const detail = t.running ? `executando: ${t.running}` : t.status === 'error' ? `saiu com ${t.lastExit}` : t.status;
  return `${t.active ? '*' : ' '} ${STATUS[t.status] || '·'} ${t.name}  [${t.id}]  ${detail}  — ${t.cwd}`;
}

function formatList({ caller, projects }) {
  const out = [];
  for (const p of projects) {
    out.push(`${p.name}${p.open ? '' : ' (fechado)'}  ${p.cwd || ''}`);
    for (const g of p.groups) {
      out.push(`  ${g.name}`);
      for (const t of g.terminals) out.push(`    ${terminalLine(t)}${t.id === caller ? '  ← você' : ''}`);
    }
  }
  return out.join('\n');
}

const formatTerminal = (t) => `${t.name} [${t.id}] em ${t.project} / ${t.group}\n  ${terminalLine(t).trim()}`;

module.exports = { formatList, formatTerminal };
