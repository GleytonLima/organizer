import { store, commit, findTerm, openTerminals, activeEntry, currentGroup, findGroup } from '../core/store.js';
import { makeTerminal, uid } from '../core/model.js';
import { basename, termLabel } from '../core/format.js';
import { createSession, destroySession, fitVisible, focusActive, runningCommand } from '../terminals/sessions.js';
import { leaveSplitIfOutside } from './split.js';
import { openModal, field } from '../ui/modal.js';
import { confirmDanger } from '../ui/confirm.js';

/** Marca o projeto como aberto e sobe as sessões de todos os seus terminais. */
export function ensureProjectOpen(project) {
  project.open = true;
  project.collapsed = false;
  project.groups.forEach((g) => g.terminals.forEach(createSession));
}

export function activate(id) {
  const entry = findTerm(id);
  if (!entry) return;
  if (!entry.project.open) ensureProjectOpen(entry.project);
  entry.group.collapsed = false;
  createSession(entry.t);
  leaveSplitIfOutside(id);
  store.state.activeId = id;
  store.state.focusProjectId = entry.project.id; // ativar um terminal foca o projeto dele
  commit();
  requestAnimationFrame(() => {
    fitVisible();
    focusActive();
  });
}

/** Adiciona um terminal ao grupo e sobe a sessão; com `focus`, também o ativa. */
export function addTerminal(group, fields, { focus = true } = {}) {
  const owner = findGroup(group.id);
  const t = makeTerminal(fields);
  group.terminals.push(t);
  ensureProjectOpen(owner.project);
  if (focus) activate(t.id);
  else commit();
  return t;
}

/** Cria um terminal no grupo (padrão: grupo atual), herdando a pasta do terminal ativo do mesmo projeto. */
export function newTerminal(group = currentGroup(), extra = {}) {
  const owner = group && findGroup(group.id);
  if (!owner) return;
  const act = activeEntry();
  const cwd = act?.project === owner.project ? act.t.cwd : owner.project.cwd || store.info.home;
  addTerminal(group, { cwd, ...extra });
}

/** Terminal do tipo "agente": conversa com o agente via ACP (experimento; ver terminals/agent-session.js). */
export function newAgentTerminal(group = currentGroup(), agent = 'claude') {
  newTerminal(group, { kind: 'agent', agent, agentLabel: 'Claude Code', name: 'Claude (ACP)' });
}

/** Remove o terminal do estado e escolhe o próximo ativo. Não pergunta nada. */
export function removeTerminal(id) {
  const entry = findTerm(id);
  if (!entry) return;
  const open = openTerminals();
  const idx = open.findIndex((x) => x.t.id === id);
  destroySession(id);
  entry.group.terminals = entry.group.terminals.filter((t) => t.id !== id);
  if (store.state.activeId === id) {
    const rest = open.filter((x) => x.t.id !== id);
    const next = rest[Math.min(idx, rest.length - 1)];
    store.state.activeId = null;
    if (next) return activate(next.t.id);
  }
  commit();
}

/** Fecha o terminal; se houver um processo rodando, pede confirmação. */
export async function closeTerminal(id) {
  const entry = findTerm(id);
  if (!entry) return;
  const cmd = runningCommand(id);
  if (cmd) {
    const ok = await confirmDanger({
      title: `Fechar “${termLabel(entry.t)}”?`,
      message: `“${cmd}” ainda está em execução e será encerrado.`,
      submit: 'Fechar',
    });
    if (!ok) return;
  }
  removeTerminal(id);
}

export function cycleTerminal(dir) {
  const open = openTerminals();
  if (!open.length) return;
  const idx = open.findIndex((x) => x.t.id === store.state.activeId);
  activate(open[(idx + dir + open.length) % open.length].t.id);
}

export function duplicateTerminal(id) {
  const entry = findTerm(id);
  if (!entry) return;
  const { group, t } = entry;
  const copy = { ...t, id: uid() };
  group.terminals.splice(group.terminals.indexOf(t) + 1, 0, copy);
  activate(copy.id);
}

/** Move o terminal para `target` (grupo), antes de `beforeId` ou no fim. */
export function moveTerminal(id, target, beforeId = null) {
  const entry = findTerm(id);
  const owner = findGroup(target.id);
  if (!entry || !owner || id === beforeId) return;
  entry.group.terminals = entry.group.terminals.filter((t) => t.id !== id);
  const idx = beforeId ? target.terminals.findIndex((t) => t.id === beforeId) : -1;
  target.terminals.splice(idx >= 0 ? idx : target.terminals.length, 0, entry.t);
  target.collapsed = false;
  if (!owner.project.open) ensureProjectOpen(owner.project);
  commit();
}

export async function editTerminal(id) {
  const entry = findTerm(id);
  if (!entry) return;
  const { t, project } = entry;
  const v = await openModal({
    title: 'Editar terminal',
    fields: [
      field.text('name', 'Nome', t.name, { placeholder: basename(t.cwd), hint: 'Vazio usa o nome da pasta atual.' }),
      field.color('color', 'Cor', t.color || project.color),
      field.text('startup', 'Comando inicial', t.startup, {
        mono: true,
        placeholder: 'npm run dev',
        hint: 'Opcional. Executado sempre que o terminal abre.',
      }),
    ],
    submit: 'Salvar',
  });
  if (!v) return;
  Object.assign(t, { name: v.name.trim(), color: v.color, startup: v.startup.trim() });
  commit();
}
