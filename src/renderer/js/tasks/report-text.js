// Texto dos relatos: a resposta do agente vem em markdown e longa. O relato guardado é o último parágrafo
// (onde o agente costuma concluir), em texto simples e cortado em palavra inteira; a prévia da Home
// mostra o começo dele.

/** Markdown → texto simples (sem blocos de código, crases, negrito, títulos e marcadores de lista). */
export function plainText(md) {
  return String(md || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*|__/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/^\s*(?:[-*•]|\d+\.)\s+/gm, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** Corta em `max` caracteres sem partir palavra (com reticências). */
export function cut(text, max) {
  if (text.length <= max) return text;
  const head = text.slice(0, max);
  const space = head.lastIndexOf(' ');
  return `${(space > max * 0.6 ? head.slice(0, space) : head).replace(/[\s,;:.-]+$/, '')}…`;
}

/** Relato de fim de turno: o último parágrafo da resposta, limpo. */
export function turnSummary(message, max = 400) {
  const paragraphs = plainText(message).split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  return cut(paragraphs.at(-1) || '', max);
}

/** Prévia de um relato (inclusive os antigos, cortados no meio da palavra). */
export function reportPreview(text, max = 160) {
  const plain = plainText(text).replace(/\s*\n\s*/g, ' ');
  return cut(/^[a-zà-ú]/.test(plain) ? `…${plain}` : plain, max);
}
