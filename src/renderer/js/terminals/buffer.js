// Leitura do conteúdo de um terminal (para a API / agentes).
import { getSession } from './sessions.js';

/** Últimas `count` linhas do terminal, juntando linhas quebradas pela largura. */
export function readLines(id, count = 50) {
  const s = getSession(id);
  if (!s) return null;
  if (s.agent) return s.readLines(count); // sessão de agente: o texto da conversa
  const buf = s.term.buffer.active;
  const lines = [];
  for (let i = 0; i < buf.length; i++) {
    const line = buf.getLine(i);
    if (!line) continue;
    const text = line.translateToString(true);
    if (line.isWrapped && lines.length) lines[lines.length - 1] += text;
    else lines.push(text);
  }
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  return lines.slice(-count).join('\n');
}
