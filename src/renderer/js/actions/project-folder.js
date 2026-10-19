// Projeto a partir de uma pasta: o app lê a pasta (repositórios e comandos prováveis, ver
// src/main/setup/scan.js), você marca o que vira terminal e o projeto abre montado — um grupo por
// repositório e, se quiser, um terminal de agente. Os comandos só rodam quando o terminal abre.
import { store, commit, projects } from '../core/store.js';
import { el } from '../core/dom.js';
import { makeGroup, makeTerminal } from '../core/model.js';
import { cleanError } from '../core/errors.js';
import { openModal, field } from '../ui/modal.js';
import { addProject, openProject } from './projects.js';
import { activate, ensureProjectOpen } from './terminals.js';
import { agentProfileFor } from '../agents/profiles.js';

const TITLE = 'Projeto a partir de uma pasta';
const same = (a, b) => String(a).toLowerCase().replace(/[\\/]+$/, '') === String(b).toLowerCase().replace(/[\\/]+$/, '');

function check(label, checked, { cmd = false, hint = '' } = {}) {
  const box = el('input', { type: 'checkbox', checked });
  return { box, node: el('label', { class: 'folder-check' }, box, el('span', { class: cmd ? 'folder-cmd' : '', text: label }), hint ? el('span', { class: 'folder-note', text: hint }) : null) };
}

/** O agente do terminal de agente: o primeiro pronto nos Primeiros passos (instalado, logado, com perfil). */
function pickAgent(setup) {
  for (const a of setup.agents || []) {
    const profile = a.id === 'claude' ? agentProfileFor('claude') : a.connected && agentProfileFor(a.id);
    if (a.installed && a.loggedIn && profile) return { profileId: profile.id, label: profile.label };
  }
  return null;
}

/** Conteúdo do diálogo: cada repositório com os comandos marcáveis; no fim, o terminal de agente. */
function review(scan, agentPick) {
  const picks = scan.repos.map((r) => r.commands.map((c) => ({ ...c, ...check(c.cmd, c.checked, { cmd: true }) })));
  const agent = check(agentPick ? `Terminal de agente (${agentPick.label})` : 'Terminal de agente', !!agentPick, { hint: agentPick ? '' : 'conecte um agente nos Primeiros passos' });
  const node = el(
    'div',
    { class: 'folder-review' },
    scan.repos.map((r, i) =>
      el(
        'section',
        { class: 'folder-repo' },
        el('div', { class: 'folder-repo-name', text: r.name }),
        el('div', { class: 'folder-repo-path', text: r.path }),
        picks[i].length ? picks[i].map((p) => p.node) : el('div', { class: 'folder-note', text: 'Nenhum comando detectado: abre um terminal na pasta.' }),
      ),
    ),
    agent.node,
  );
  const collect = () => ({ picked: picks.map((list) => list.filter((p) => p.box.checked)), agent: agent.box.checked });
  return { node, collect };
}

/** Grupos do projeto: um por repositório (com os comandos marcados) e o do agente. */
function buildGroups(scan, picked, agent, cwd) {
  const groups = scan.repos.map((r, i) =>
    makeGroup({
      name: scan.repos.length > 1 ? r.name : 'Terminais',
      terminals: picked[i].length ? picked[i].map((c) => makeTerminal({ name: c.name, cwd: r.path, startup: c.cmd })) : [makeTerminal({ name: r.name, cwd: r.path })],
    }),
  );
  if (agent) groups.push(makeGroup({ name: 'Agente', terminals: [makeTerminal({ kind: 'agent', agent: agent.profileId, name: `${agent.label} (ACP)`, cwd })] }));
  return groups;
}

/** Fluxo completo; `dir` vem de arrastar uma pasta (sem ele, abre o seletor). Devolve o projeto. */
export async function projectFromFolder(dir) {
  dir ||= await api.pickFolder(store.info.home);
  if (!dir) return null;
  let scan, setup;
  try {
    [scan, setup] = await Promise.all([api.setup.scan(dir), api.setup.check()]);
  } catch (err) {
    await openModal({ title: TITLE, message: cleanError(err), submit: 'OK' });
    return null;
  }
  const existing = projects().find((p) => p.repos.some((r) => scan.repos.some((s) => same(r.path, s.path))));
  if (existing) {
    const open = await openModal({ title: TITLE, message: `A pasta já está no projeto “${existing.name}”.`, submit: 'Abrir o projeto' });
    if (open) openProject(existing);
    return open ? existing : null;
  }
  const agentPick = pickAgent(setup);
  const { node, collect } = review(scan, agentPick);
  const v = await openModal({
    title: TITLE,
    message: 'Marque o que vira terminal. Os comandos rodam quando o terminal abre.',
    fields: [field.text('name', 'Nome', scan.name)],
    content: node,
    collect,
    submit: 'Criar projeto',
    wide: true,
  });
  if (!v) return null;
  const project = addProject({ name: v.name, repos: scan.repos.map((r) => ({ name: r.name, path: r.path })) });
  project.groups = buildGroups(scan, v.picked, v.agent ? agentPick || { profileId: 'claude', label: 'Claude Code' } : null, project.cwd);
  store.state.taskView = 'off';
  ensureProjectOpen(project); // sobe todos os terminais: os comandos marcados já começam
  activate(project.groups[0].terminals[0].id);
  return project;
}
