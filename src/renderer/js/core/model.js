// Fábricas das entidades e migração do estado salvo.
// Hierarquia: Projeto (pasta raiz) → Grupos → Terminais.
import { DOT_COLORS } from '../themes/palette.js';

export const uid = () => Math.random().toString(36).slice(2, 10);

export const makeTerminal = (fields = {}) => ({ id: uid(), name: '', color: null, cwd: '', startup: '', ...fields });

export const makeGroup = (fields = {}) => ({ id: uid(), name: 'Terminais', collapsed: false, terminals: [], ...fields });

export const makeProject = (fields = {}) => ({
  id: uid(),
  name: 'Projeto',
  color: DOT_COLORS[0],
  cwd: '',
  open: true,
  collapsed: false,
  groups: [makeGroup()],
  ...fields,
});

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
  for (const p of projects) if (!p.groups?.length) p.groups = [makeGroup()];
  return {
    version: 2,
    layout: s.layout || 'left',
    theme: s.theme || 'grafite',
    activeId: s.activeId || null,
    projects: projects.length ? projects : [makeProject({ name: 'Geral', cwd: home })],
    commands: s.commands || DEFAULT_COMMANDS(),
  };
}
