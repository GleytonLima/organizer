// Subcomandos do CLI `bo`.
const path = require('path');
const { request } = require('./client');
const { waitForOutput } = require('./wait');
const { formatList, formatTerminal } = require('./format');
const { mcpConfig } = require('./mcp-config');

const BOOLEAN_FLAGS = new Set(['focus', 'force', 'json', 'help', 'decisions', 'all']);

function parseArgs(argv) {
  const pos = [];
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      pos.push(a);
      continue;
    }
    const [key, inline] = a.slice(2).split(/=(.*)/s);
    if (inline !== undefined) opts[key] = inline;
    else if (key.startsWith('no-')) opts[key.slice(3)] = false;
    else if (BOOLEAN_FLAGS.has(key) || i + 1 >= argv.length) opts[key] = true;
    else opts[key] = argv[++i];
  }
  return { pos, opts };
}

const print = (opts, result, text) => console.log(opts.json ? JSON.stringify(result, null, 2) : text(result));

const COMMANDS = {
  open: {
    usage: 'open [--name N] [--repo R | --cwd PASTA] [--run CMD] [--startup CMD] [--group G] [--project P] [--focus]',
    help: 'Abre um terminal (no seu grupo, ou em --group, criado se preciso).',
    async run({ opts }) {
      const r = await request('open', {
        name: opts.name,
        repo: opts.repo,
        cwd: opts.cwd && (opts.repo ? String(opts.cwd) : path.resolve(String(opts.cwd))),
        command: opts.run,
        startup: opts.startup,
        group: opts.group,
        project: opts.project,
        focus: !!opts.focus,
      });
      print(opts, r, (t) => `Aberto: ${formatTerminal(t)}`);
    },
  },
  list: {
    usage: 'list [--json]',
    help: 'Lista projetos, grupos e terminais.',
    async run({ opts }) {
      print(opts, await request('list'), formatList);
    },
  },
  send: {
    usage: 'send <terminal> <texto...> [--no-enter]',
    help: 'Envia texto a um terminal (com Enter).',
    async run({ pos, opts }) {
      const [terminal, ...text] = pos;
      await request('send', { terminal, text: text.join(' '), enter: opts.enter !== false });
    },
  },
  read: {
    usage: 'read [terminal] [--lines N]',
    help: 'Mostra as últimas linhas de um terminal.',
    async run({ pos, opts }) {
      print(opts, await request('read', { terminal: pos[0], lines: Number(opts.lines) || 50 }), (r) => r.output);
    },
  },
  wait: {
    usage: 'wait <terminal> --match REGEX [--timeout SEG]',
    help: 'Espera a saída do terminal casar com REGEX (sai com 1 se não casar).',
    async run({ pos, opts }) {
      const r = await waitForOutput(request, { terminal: pos[0], pattern: opts.match, timeout: Number(opts.timeout) || 60 });
      print(opts, r, (x) => (x.matched ? 'ok' : `não casou${x.timedOut ? ' (tempo esgotado)' : x.reason ? ` (${x.reason})` : ''}`));
      if (!r.matched) process.exitCode = 1;
    },
  },
  status: {
    usage: 'status [terminal]',
    help: 'Estado de um terminal (padrão: o atual).',
    async run({ pos, opts }) {
      print(opts, await request('status', { terminal: pos[0] }), formatTerminal);
    },
  },
  focus: {
    usage: 'focus <terminal>',
    help: 'Traz o terminal para a frente.',
    async run({ pos }) {
      await request('focus', { terminal: pos[0] });
    },
  },
  close: {
    usage: 'close <terminal> [--force]',
    help: 'Fecha o terminal (--force se houver processo rodando).',
    async run({ pos, opts }) {
      await request('close', { terminal: pos[0], force: !!opts.force });
    },
  },
  notify: {
    usage: 'notify [mensagem...] [--title T] [--terminal X]',
    help: 'Avisa você (toast do Windows + marca no terminal). Ideal para hooks de agentes.',
    async run({ pos, opts }) {
      const r = await request('notify', { message: pos.join(' ') || undefined, title: opts.title, terminal: opts.terminal });
      if (opts.json) console.log(JSON.stringify(r, null, 2));
    },
  },
  project: {
    usage: 'project add <nome> <pasta...>',
    help: 'Cria um projeto com pastas (ou acrescenta pastas a um existente).',
    async run({ pos, opts }) {
      const [action, name, ...folders] = pos;
      if (action !== 'add' || !name) throw new Error('uso: bo project add <nome> <pasta...>');
      const r = await request('project_create', { name, repos: folders.map((f) => path.resolve(f)) });
      print(opts, r, (p) => `${p.name}: ${p.repos.map((x) => x.name).join(', ') || '(sem pastas)'}`);
    },
  },
  task: {
    usage: 'task <list|columns|add|move|report|wait|done|waiting> …',
    help: 'Quadro de tarefas do projeto (bo task, sem argumentos, mostra a ajuda).',
    run: (args) => require('./commands-task').runTask(args),
  },
  mem: {
    usage: 'mem <decide|note|search|decisions|forget> …',
    help: 'Memória do projeto: decisões (uma frase com o porquê) e notas, com busca.',
    run: (args) => require('./commands-memory').runMemory(args),
  },
  mcp: {
    usage: 'mcp',
    help: 'Inicia o servidor MCP (stdio) para agentes (Claude Code, Devin…).',
    run: () => require('./mcp').serve(),
  },
  'mcp-config': {
    usage: 'mcp-config',
    help: 'Mostra como registrar o servidor MCP nos agentes.',
    run: () => console.log(mcpConfig()),
  },
};

function helpText() {
  const lines = ['bo — controla o Bash Organizer a partir do terminal', '', 'Uso: bo <comando> [opções]', ''];
  for (const c of Object.values(COMMANDS)) lines.push(`  bo ${c.usage}`, `      ${c.help}`);
  lines.push('', 'Terminal = id ou nome. --json em qualquer comando para saída em JSON.');
  return lines.join('\n');
}

async function main(argv) {
  const [name, ...rest] = argv;
  const cmd = COMMANDS[name];
  if (!cmd || name === 'help') {
    console.log(helpText());
    if (name && name !== 'help') process.exitCode = 1;
    return;
  }
  try {
    await cmd.run(parseArgs(rest));
  } catch (err) {
    console.error(`bo: ${err.message}`);
    process.exitCode = 1;
  }
}

module.exports = { main };
