// `bo mem <ação>`: memória do projeto pela linha de comando (mesmos métodos do MCP).
const { request } = require('./client');
const { linkActions, linksOf, LINK_FLAGS } = require('./commands-memory-links');

const where = (m) => (m.scope === 'global' ? 'global' : m.scope === 'folder' ? `pasta ${m.folder.split(/[\\/]/).pop()}` : m.repo);
const MARK = { decision: '◆', note: '•', progress: '▸', idea: '✦', howto: '≡' };
const flag = (m) => (m.conflict ? '  [em conflito]' : '') + (m.review ? '  [a revisar]' : '');
const line = (m) => `${MARK[m.kind] || '•'} [${m.id}] ${m.text}${where(m) ? `  (${where(m)})` : ''}${flag(m)}`;
/** --global | --folder [nome/caminho] → escopo da memória (padrão: projeto). */
const scopeOf = (o) => (o.global ? { scope: 'global' } : o.folder ? { scope: 'folder', folder: o.folder === true ? undefined : o.folder } : {});
const lines = (items, empty) => items.map(line).join('\n') || empty;

const ACTIONS = {
  decide: {
    usage: `decide <frase com o porquê...> [--global | --folder [pasta]] [--tags a,b] [--supersedes ID] ${LINK_FLAGS}`,
    run: async (pos, o) =>
      line(await request('memory_decision', { text: pos.join(' '), ...scopeOf(o), repo: o.repo, tags: o.tags, supersedes: o.supersedes, links: linksOf(o) })),
  },
  note: {
    usage: `note <texto...> [--global | --folder [pasta]] [--tags a,b] ${LINK_FLAGS}`,
    run: async (pos, o) => line(await request('memory_note', { text: pos.join(' '), ...scopeOf(o), repo: o.repo, tags: o.tags, links: linksOf(o) })),
  },
  search: {
    usage: 'search <consulta...> [--decisions] [--all]',
    run: async (pos, o) => {
      const r = await request('memory_search', { query: pos.join(' '), kind: o.decisions ? 'decision' : undefined, all: !!o.all });
      return `(${r.mode})${r.warning ? ` ${r.warning}` : ''}\n${lines(r.items, '(nada encontrado)')}`;
    },
  },
  decisions: { usage: 'decisions [--repo R]', run: async (_p, o) => lines(await request('memory_decisions', { repo: o.repo }), '(sem decisões)') },
  progress: {
    usage: 'progress <onde parou...> [--task BO-12] [--next "passo 1; passo 2"]',
    run: async (pos, o) =>
      line(await request('memory_progress', { status: pos.join(' '), task: o.task, nextSteps: o.next ? String(o.next).split(';').map((s) => s.trim()).filter(Boolean) : [] })),
  },
  sync: {
    usage: 'sync',
    run: async () => {
      const s = await request('memory_sync', {});
      return s.state === 'off' ? 'Sync desligado (configure o servidor na aba Memória).' : s.state === 'error' ? `Erro: ${s.error}` : 'Sincronizado.';
    },
  },
  idea: {
    usage: 'idea <texto...> [--global | --folder [pasta]] [--tags a,b]   (fica aberta até virar tarefa)',
    run: async (pos, o) => line(await request('memory_note', { kind: 'idea', text: pos.join(' '), ...scopeOf(o), tags: o.tags, links: linksOf(o) })),
  },
  howto: {
    usage: `howto <como fazer...> [--global | --folder [pasta]] [--tags a,b] ${LINK_FLAGS}`,
    run: async (pos, o) => line(await request('memory_note', { kind: 'howto', text: pos.join(' '), ...scopeOf(o), tags: o.tags, links: linksOf(o) })),
  },
  'idea-task': {
    usage: 'idea-task <id> [--existing TAREFA]   (a ideia vira tarefa; --existing: já virou esta)',
    run: async ([id], o) => {
      if (o.existing) return line(await request('memory_update', { id, status: 'converted', task: o.existing }));
      const t = await request('memory_idea_to_task', { id });
      return `${t.key}  ${t.title}`;
    },
  },
  ...linkActions({ line, lines }),
  forget: { usage: 'forget <id>', run: async ([id]) => JSON.stringify(await request('memory_forget', { id })) },
};

const help = () => ['bo mem — memória (◆ decisão, • nota, ✦ ideia, ≡ como fazer, ▸ progresso); escopos: projeto (padrão), --folder, --global', ...Object.values(ACTIONS).map((a) => `  bo mem ${a.usage}`)].join('\n');

async function runMemory({ pos, opts }) {
  const [name, ...rest] = pos;
  const action = ACTIONS[name];
  console.log(action ? await action.run(rest, opts) : help());
}

module.exports = { runMemory };
