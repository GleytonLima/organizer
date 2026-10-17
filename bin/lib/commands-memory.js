// `bo mem <ação>`: memória do projeto pela linha de comando (mesmos métodos do MCP).
const { request } = require('./client');

const line = (m) => `${m.kind === 'decision' ? '◆' : '•'} [${m.id}] ${m.text}${m.repo ? `  (${m.repo})` : ''}`;
const lines = (items, empty) => items.map(line).join('\n') || empty;

const ACTIONS = {
  decide: {
    usage: 'decide <frase com o porquê...> [--repo R] [--tags a,b] [--supersedes ID]',
    run: async (pos, o) => line(await request('memory_decision', { text: pos.join(' '), repo: o.repo, tags: o.tags, supersedes: o.supersedes })),
  },
  note: { usage: 'note <texto...> [--repo R] [--tags a,b]', run: async (pos, o) => line(await request('memory_note', { text: pos.join(' '), repo: o.repo, tags: o.tags })) },
  search: {
    usage: 'search <consulta...> [--decisions] [--all]',
    run: async (pos, o) => {
      const r = await request('memory_search', { query: pos.join(' '), kind: o.decisions ? 'decision' : undefined, all: !!o.all });
      return `(${r.mode})${r.warning ? ` ${r.warning}` : ''}\n${lines(r.items, '(nada encontrado)')}`;
    },
  },
  decisions: { usage: 'decisions [--repo R]', run: async (_p, o) => lines(await request('memory_decisions', { repo: o.repo }), '(sem decisões)') },
  forget: { usage: 'forget <id>', run: async ([id]) => JSON.stringify(await request('memory_forget', { id })) },
};

const help = () => ['bo mem — memória do projeto (◆ decisão, • nota)', ...Object.values(ACTIONS).map((a) => `  bo mem ${a.usage}`)].join('\n');

async function runMemory({ pos, opts }) {
  const [name, ...rest] = pos;
  const action = ACTIONS[name];
  console.log(action ? await action.run(rest, opts) : help());
}

module.exports = { runMemory };
