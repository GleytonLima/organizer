// Contexto de memória de um projeto (compartilhado pela API e pela aba Memória).
// Ler: globais + as do projeto + as das pastas do projeto. Escrever: escolher o escopo.

/** O que vale para o projeto: { projectId, folders } (ver src/main/memory/scope.js). */
export const memoryContext = (project) => ({ projectId: project.id, folders: (project.repos || []).map((r) => r.path) });

/** Nome curto da pasta de uma memória de escopo "folder" (o nome dado no projeto, se houver). */
export function folderLabel(project, folder) {
  const key = String(folder || '').toLowerCase();
  const repo = (project?.repos || []).find((r) => r.path.toLowerCase() === key);
  return repo?.name || String(folder || '').split(/[\\/]/).pop();
}

/**
 * Escopo legível de uma memória, para exibir: null quando é do projeto (o caso comum).
 * Ex.: "global", "pasta backend".
 */
export function scopeLabel(project, m) {
  if (m.scope === 'global') return 'global';
  if (m.scope === 'folder') return `pasta ${folderLabel(project, m.folder)}`;
  return null;
}
