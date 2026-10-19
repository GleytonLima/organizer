// Fábricas das entidades e migração do estado salvo.
// Hierarquia: Projeto (pasta raiz) → Grupos → Terminais.
import { DOT_COLORS } from '../themes/palette.js';
import { DEFAULT_AGENT_PROFILES } from '../agents/profiles.js';

// ids de entidades: 8 caracteres de um gerador criptográfico (nada de Math.random)
export const uid = () => crypto.randomUUID().replaceAll('-', '').slice(0, 8);

export const makeTerminal = (fields = {}) => ({ id: uid(), name: '', color: null, cwd: '', startup: '', ...fields });

export const makeGroup = (fields = {}) => ({ id: uid(), name: 'Terminais', collapsed: false, terminals: [], ...fields });

/**
 * Projeto: um conjunto explícito de pastas (repositórios clonados onde você quiser — é comum
 * vários projetos dividirem a mesma pasta de clones). `cwd` = primeira pasta, padrão dos terminais.
 */
export const makeProject = (fields = {}) => ({
  id: uid(),
  name: 'Projeto',
  color: DOT_COLORS[0],
  cwd: '',
  repos: [], // [{ name, path }]
  open: true,
  collapsed: false,
  groups: [makeGroup()],
  ...fields,
});

/**
 * Tarefa do quadro (colunas em tasks/columns.js, por projeto).
 * `history`: [{ at, by: 'agente'|'você', type: 'created'|'moved'|'report'|'input'|'edit', text }].
 */
export const makeTask = (fields = {}) => {
  const now = Date.now();
  return {
    id: uid(),
    key: '', // ex.: "MA-12" (prefixo do projeto + sequência)
    projectId: null,
    columnId: null,
    title: '',
    description: '',
    terminalId: null, // terminal de origem (o agente que criou/atualizou)
    progress: null, // 0–100, opcional
    needsInput: null, // { question, at } quando o agente aguarda uma decisão sua
    parentId: null, // subtarefa de outra tarefa (id)
    tags: [], // rótulos (tasks/tags.js); tarefas antigas sem o campo = sem tags
    createdAt: now,
    updatedAt: now,
    history: [],
    ...fields,
  };
};

const DEFAULT_COMMANDS = () => [
  { id: uid(), label: 'status', cmd: 'git status' },
  { id: uid(), label: 'log', cmd: 'git log --oneline -15 --graph' },
  { id: uid(), label: 'pull', cmd: 'git pull' },
];

// v1 tinha `workspaces` com `terminals` direto; cada workspace vira um projeto com um grupo.
function projectsFromV1(workspaces) {
  return workspaces.map(({ terminals = [], ...ws }) => makeProject({ ...ws, groups: [makeGroup({ terminals })] }));
}

/** Normaliza o estado salvo (qualquer versão) para o formato atual. */
export function migrate(saved, home) {
  const s = saved || {};
  const projects = s.projects || (s.workspaces ? projectsFromV1(s.workspaces) : []);
  for (const p of projects) {
    if (!p.groups?.length) p.groups = [makeGroup()];
    p.repos ||= [];
  }
  return {
    version: 2,
    layout: s.layout || 'left',
    theme: s.theme || 'grafite',
    activeId: s.activeId || null,
    focusProjectId: s.focusProjectId || null, // projeto em foco (ver currentProject em store.js)
    split: s.split || null, // visão lado a lado: { kind: 'group' | 'project', id }
    projects: projects.length ? projects : [makeProject({ name: 'Geral', cwd: home })],
    commands: s.commands || DEFAULT_COMMANDS(),
    tasks: s.tasks || [],
    taskView: s.taskView || 'off', // 'off' | 'panel' | 'board'
    taskPeriod: s.taskPeriod || '7d', // período da lista de tarefas (tasks/period.js)
    taskScope: s.taskScope || 'project', // lista de tarefas: projeto em foco | todos (tasks/filter.js)
    insights: s.insights || { period: '30d', scope: 'project', prices: null }, // painel Insights (metrics/insights.js)
    agentProfiles: s.agentProfiles?.length ? s.agentProfiles : DEFAULT_AGENT_PROFILES(), // agentes ACP (agents/profiles.js)
    sideTab: s.sideTab || 'tasks', // aba do painel lateral: 'tasks' | 'memory'
    homeSeenAt: s.homeSeenAt || null, // quando você saiu da Home pela última vez (base do "enquanto você esteve fora")
    focusMode: !!s.focusMode, // modo foco: só avisos urgentes viram toast (notify/center.js)
  };
}
