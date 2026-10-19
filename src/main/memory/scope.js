// Escopos da memória:
//   global  — vale em todos os projetos (preferências, convenções gerais)
//   project — vale no projeto (padrão)
//   folder  — vale numa pasta/repositório, em QUALQUER projeto que a inclua (repos são
//             compartilhados entre projetos; por isso a chave é o caminho, não o projeto)
const SCOPES = ['global', 'project', 'folder'];

/** Chave comparável de pasta: barras invertidas, sem barra final, minúsculas. */
const folderKey = (p) => (p ? String(p).replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase() : null);

/** Valida e completa os campos de escopo de uma memória nova/editada. */
function normalizeScope({ scope = 'project', projectId = null, folder = null }) {
  if (!SCOPES.includes(scope)) throw new Error(`Escopo inválido: "${scope}". Use: ${SCOPES.join(', ')}.`);
  if (scope === 'project' && !projectId) throw new Error('Memória de projeto precisa de um projeto.');
  if (scope === 'folder' && !folder) throw new Error('Memória de pasta precisa do caminho da pasta.');
  return {
    scope,
    projectId: scope === 'global' ? null : projectId, // em "folder", guarda o projeto de origem (informativo)
    folder: scope === 'folder' ? String(folder).replace(/[\\/]+$/, '') : null,
    folderKey: scope === 'folder' ? folderKey(folder) : null,
  };
}

/**
 * Cláusula SQL do contexto de leitura: tudo o que vale para um projeto —
 * globais + as do projeto + as das pastas dele. Sem contexto: todas.
 * `withGlobal: false` deixa as globais de fora (a visão "Deste projeto" da aba Memória).
 */
function contextClause(context, col) {
  if (!context) return null;
  const folders = (context.folders || []).map(folderKey).filter(Boolean);
  const parts = context.withGlobal === false ? [] : [`${col('scope')} = 'global'`];
  const args = [];
  if (context.projectId) {
    parts.push(`(${col('scope')} = 'project' AND ${col('project_id')} = ?)`);
    args.push(context.projectId);
  }
  if (folders.length) {
    parts.push(`(${col('scope')} = 'folder' AND ${col('folder_key')} IN (${folders.map(() => '?').join(', ')}))`);
    args.push(...folders);
  }
  return { sql: parts.length ? `(${parts.join(' OR ')})` : '0 = 1', args };
}

module.exports = { SCOPES, folderKey, normalizeScope, contextClause };
