/* global Terminal, FitAddon, WebLinksAddon, api */
'use strict';

// `api` é exposto pelo preload (contextBridge) como global.

const COLORS = ['#5fa8ff', '#5fd38d', '#f2c66d', '#ff8f5f', '#ff6b6b', '#c38bff', '#4fd6d6', '#9aa3b2'];
const GIT_POLL_MS = 3000;

const THEME = {
  background: '#14161b',
  foreground: '#d7dae0',
  cursor: '#5fa8ff',
  cursorAccent: '#14161b',
  selectionBackground: '#3a4a6680',
  black: '#1b1e25',
  red: '#ff6b6b',
  green: '#5fd38d',
  yellow: '#f2c66d',
  blue: '#5fa8ff',
  magenta: '#c38bff',
  cyan: '#4fd6d6',
  white: '#d7dae0',
  brightBlack: '#5d6472',
  brightRed: '#ff8a8a',
  brightGreen: '#7fe3a6',
  brightYellow: '#ffd98a',
  brightBlue: '#8cc2ff',
  brightMagenta: '#d6adff',
  brightCyan: '#7fe6e6',
  brightWhite: '#ffffff',
};

let state = null;
let info = { bash: null, home: '' };
const sessions = new Map(); // id -> { term, fit, host, exited }
const gitByCwd = new Map(); // cwd -> git info | null

const $ = (sel) => document.querySelector(sel);
const uid = () => Math.random().toString(36).slice(2, 10);

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

// ---------------- estado ----------------

function defaultState() {
  return {
    version: 1,
    layout: 'left',
    activeId: null,
    workspaces: [
      { id: uid(), name: 'Geral', color: COLORS[0], cwd: info.home, open: true, collapsed: false, terminals: [] },
    ],
    commands: [
      { id: uid(), label: 'status', cmd: 'git status' },
      { id: uid(), label: 'log', cmd: 'git log --oneline -15 --graph' },
      { id: uid(), label: 'pull', cmd: 'git pull' },
    ],
  };
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => api.saveState(state), 250);
}

function allTerminals() {
  return state.workspaces.flatMap((ws) => ws.terminals.map((t) => ({ ws, t })));
}
function findTerm(id) {
  for (const ws of state.workspaces) {
    const t = ws.terminals.find((x) => x.id === id);
    if (t) return { ws, t };
  }
  return null;
}
function activeEntry() {
  return state.activeId ? findTerm(state.activeId) : null;
}
function wsById(id) {
  return state.workspaces.find((w) => w.id === id);
}
function currentWs() {
  return activeEntry()?.ws || state.workspaces.find((w) => w.open) || state.workspaces[0];
}

function basename(p) {
  if (!p) return '';
  const parts = p.replace(/[\\/]+$/, '').split(/[\\/]/);
  return parts[parts.length - 1] || p;
}
function termLabel(t) {
  return t.name || basename(t.cwd) || 'bash';
}
function shortPath(p) {
  if (!p) return '';
  if (info.home && p.toLowerCase().startsWith(info.home.toLowerCase())) return '~' + p.slice(info.home.length);
  return p;
}

// ---------------- sessões (xterm + pty) ----------------

function createSession(t) {
  if (sessions.has(t.id)) return sessions.get(t.id);
  const host = el('div', { class: 'term-host', 'data-id': t.id });
  $('#terminals').append(host);

  const term = new Terminal({
    fontFamily: "'Cascadia Mono', 'Cascadia Code', Consolas, monospace",
    fontSize: 13,
    lineHeight: 1.15,
    cursorBlink: true,
    scrollback: 10000,
    allowProposedApi: true,
    theme: THEME,
  });
  const fit = new FitAddon.FitAddon();
  term.loadAddon(fit);
  term.loadAddon(new WebLinksAddon.WebLinksAddon((_e, url) => window.open(url)));
  term.open(host);

  const s = { term, fit, host, exited: false };
  sessions.set(t.id, s);

  // O hook do bash emite OSC 7 com o $PWD a cada prompt.
  term.parser.registerOscHandler(7, (data) => {
    const m = /^file:\/\/[^/]*(\/.*)$/.exec(data);
    if (m) onCwdChange(t.id, m[1]);
    return true;
  });

  term.onData((data) => {
    if (s.exited) {
      if (data === '\r') restartSession(t.id);
      return;
    }
    api.ptyWrite(t.id, data);
  });
  term.onResize(({ cols, rows }) => api.ptyResize(t.id, cols, rows));
  term.attachCustomKeyEventHandler((e) => terminalKeyHandler(e, t.id));
  host.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (term.hasSelection()) {
      api.clipboardWrite(term.getSelection());
      term.clearSelection();
    } else {
      api.clipboardRead().then((text) => text && term.paste(text));
    }
  });

  spawnPty(t, s);
  return s;
}

async function spawnPty(t, s) {
  try {
    s.fit.fit();
  } catch {}
  const r = await api.ptyCreate({ id: t.id, cwd: t.cwd, cols: s.term.cols, rows: s.term.rows });
  if (!r.ok) {
    s.term.write(`\x1b[31m${r.error}\x1b[0m\r\n`);
    s.exited = true;
    return;
  }
  if (r.cwd && r.cwd !== t.cwd) {
    t.cwd = r.cwd;
    save();
  }
  if (t.startup) api.ptyWrite(t.id, t.startup + '\r');
}

function restartSession(id) {
  const s = sessions.get(id);
  const entry = findTerm(id);
  if (!s || !entry) return;
  api.ptyKill(id);
  s.exited = false;
  s.term.reset();
  spawnPty(entry.t, s);
  render();
}

function destroySession(id) {
  const s = sessions.get(id);
  if (!s) return;
  api.ptyKill(id);
  s.term.dispose();
  s.host.remove();
  sessions.delete(id);
}

api.onPtyData((id, data) => sessions.get(id)?.term.write(data));
api.onPtyExit((id) => {
  const s = sessions.get(id);
  if (!s || s.exited) return;
  s.exited = true;
  s.term.write('\r\n\x1b[2m[processo encerrado — pressione Enter para reiniciar]\x1b[0m\r\n');
  render();
});

async function onCwdChange(id, msysPath) {
  const entry = findTerm(id);
  if (!entry) return;
  const cwd = await api.fromMsys(msysPath);
  if (cwd === entry.t.cwd) return;
  entry.t.cwd = cwd;
  save();
  await refreshGit(cwd);
  render();
}

function fitActive() {
  const s = sessions.get(state.activeId);
  if (!s) return;
  try {
    s.fit.fit();
  } catch {}
}

// ---------------- ações ----------------

function activate(id) {
  const entry = findTerm(id);
  if (!entry) return;
  if (!entry.ws.open) openWorkspace(entry.ws, false);
  createSession(entry.t);
  state.activeId = id;
  save();
  render();
  requestAnimationFrame(() => {
    fitActive();
    sessions.get(id)?.term.focus();
  });
}

function newTerminal(ws = currentWs(), extra = {}) {
  if (!ws) return;
  const act = activeEntry();
  const cwd = act && act.ws === ws ? act.t.cwd : ws.cwd || info.home;
  const t = { id: uid(), name: '', color: ws.color, cwd, startup: '', ...extra };
  ws.terminals.push(t);
  ws.open = true;
  ws.collapsed = false;
  activate(t.id);
}

function closeTerminal(id) {
  const entry = findTerm(id);
  if (!entry) return;
  const { ws } = entry;
  const flat = allTerminals().filter((x) => x.ws.open);
  const idx = flat.findIndex((x) => x.t.id === id);
  destroySession(id);
  ws.terminals = ws.terminals.filter((t) => t.id !== id);
  if (state.activeId === id) {
    const rest = flat.filter((x) => x.t.id !== id);
    const next = rest[Math.min(idx, rest.length - 1)];
    state.activeId = next ? next.t.id : null;
    if (next) activate(next.t.id);
  }
  save();
  render();
}

function cycleTerminal(dir) {
  const flat = allTerminals().filter((x) => x.ws.open);
  if (!flat.length) return;
  const idx = flat.findIndex((x) => x.t.id === state.activeId);
  const next = flat[(idx + dir + flat.length) % flat.length];
  activate(next.t.id);
}

function openWorkspace(ws, focus = true) {
  ws.open = true;
  ws.collapsed = false;
  for (const t of ws.terminals) createSession(t);
  if (!ws.terminals.length) {
    newTerminal(ws);
    return;
  }
  if (focus) activate(ws.terminals[0].id);
  save();
  render();
}

function closeWorkspace(ws) {
  for (const t of ws.terminals) destroySession(t.id);
  ws.open = false;
  if (ws.terminals.some((t) => t.id === state.activeId)) {
    const next = allTerminals().find((x) => x.ws.open);
    state.activeId = next ? next.t.id : null;
    if (next) activate(next.t.id);
  }
  save();
  render();
}

async function createWorkspace() {
  const v = await openModal({
    title: 'Novo workspace',
    fields: [
      { key: 'name', label: 'Nome', type: 'text', value: '', placeholder: 'ex.: oteatro' },
      { key: 'cwd', label: 'Pasta do projeto', type: 'folder', value: '' },
      { key: 'color', label: 'Cor', type: 'color', value: COLORS[state.workspaces.length % COLORS.length] },
    ],
    submit: 'Criar',
  });
  if (!v) return;
  const ws = {
    id: uid(),
    name: v.name.trim() || basename(v.cwd) || 'Workspace',
    color: v.color,
    cwd: v.cwd.trim() || info.home,
    open: true,
    collapsed: false,
    terminals: [],
  };
  state.workspaces.push(ws);
  newTerminal(ws);
}

async function editWorkspace(ws) {
  const v = await openModal({
    title: 'Editar workspace',
    fields: [
      { key: 'name', label: 'Nome', type: 'text', value: ws.name },
      { key: 'cwd', label: 'Pasta do projeto', type: 'folder', value: ws.cwd, hint: 'Pasta inicial dos novos terminais.' },
      { key: 'color', label: 'Cor', type: 'color', value: ws.color },
    ],
    submit: 'Salvar',
  });
  if (!v) return;
  Object.assign(ws, { name: v.name.trim() || ws.name, cwd: v.cwd.trim() || ws.cwd, color: v.color });
  save();
  render();
}

async function deleteWorkspace(ws) {
  const ok = await openModal({
    title: `Excluir “${ws.name}”?`,
    message: `Os ${ws.terminals.length} terminal(is) deste workspace serão encerrados e removidos.`,
    submit: 'Excluir',
    danger: true,
  });
  if (!ok) return;
  closeWorkspace(ws);
  state.workspaces = state.workspaces.filter((w) => w !== ws);
  if (!state.workspaces.length) state.workspaces = defaultState().workspaces;
  save();
  render();
}

async function editTerminal(id) {
  const entry = findTerm(id);
  if (!entry) return;
  const { t } = entry;
  const v = await openModal({
    title: 'Editar terminal',
    fields: [
      { key: 'name', label: 'Nome', type: 'text', value: t.name, placeholder: basename(t.cwd), hint: 'Vazio = nome da pasta atual.' },
      { key: 'color', label: 'Cor', type: 'color', value: t.color },
      {
        key: 'startup',
        label: 'Comando inicial (opcional)',
        type: 'text',
        mono: true,
        value: t.startup || '',
        placeholder: 'ex.: npm run dev',
        hint: 'Executado sempre que o terminal for aberto ou restaurado.',
      },
    ],
    submit: 'Salvar',
  });
  if (!v) return;
  Object.assign(t, { name: v.name.trim(), color: v.color, startup: v.startup.trim() });
  save();
  render();
}

function duplicateTerminal(id) {
  const entry = findTerm(id);
  if (!entry) return;
  const { ws, t } = entry;
  const copy = { ...t, id: uid() };
  ws.terminals.splice(ws.terminals.indexOf(t) + 1, 0, copy);
  activate(copy.id);
}

function moveTerminal(id, targetWs, beforeId) {
  const entry = findTerm(id);
  if (!entry || id === beforeId) return;
  entry.ws.terminals = entry.ws.terminals.filter((t) => t.id !== id);
  const idx = beforeId ? targetWs.terminals.findIndex((t) => t.id === beforeId) : -1;
  if (idx >= 0) targetWs.terminals.splice(idx, 0, entry.t);
  else targetWs.terminals.push(entry.t);
  if (!targetWs.open) openWorkspace(targetWs, false);
  save();
  render();
}

function runCommand(cmd) {
  const id = state.activeId;
  const s = sessions.get(id);
  if (!s || s.exited) return;
  api.ptyWrite(id, cmd + '\r');
  s.term.focus();
}

async function editCommand(c) {
  const isNew = !c;
  const v = await openModal({
    title: isNew ? 'Novo comando salvo' : 'Editar comando',
    fields: [
      { key: 'label', label: 'Rótulo', type: 'text', value: c?.label || '', placeholder: 'ex.: dev' },
      { key: 'cmd', label: 'Comando', type: 'text', mono: true, value: c?.cmd || '', placeholder: 'ex.: npm run dev' },
    ],
    submit: isNew ? 'Adicionar' : 'Salvar',
  });
  if (!v || !v.cmd.trim()) return;
  const data = { label: v.label.trim() || v.cmd.trim(), cmd: v.cmd.trim() };
  if (isNew) state.commands.push({ id: uid(), ...data });
  else Object.assign(c, data);
  save();
  render();
}

function setLayout(layout) {
  state.layout = layout;
  save();
  render();
  requestAnimationFrame(fitActive);
}

// ---------------- git ----------------

async function refreshGit(cwd) {
  if (!cwd) return;
  gitByCwd.set(cwd, await api.gitStatus(cwd));
}

async function pollGit() {
  const cwds = new Set();
  for (const { ws, t } of allTerminals()) if (ws.open && t.cwd) cwds.add(t.cwd);
  const before = JSON.stringify([...gitByCwd]);
  await Promise.all([...cwds].map(refreshGit));
  for (const k of [...gitByCwd.keys()]) if (!cwds.has(k)) gitByCwd.delete(k);
  if (JSON.stringify([...gitByCwd]) !== before) render();
}

function gitBadge(cwd, { full = false } = {}) {
  const g = gitByCwd.get(cwd);
  if (!g || !g.branch) return null;
  const dirty = g.changes + g.staged + g.untracked;
  const parts = [el('span', { class: 'branch', text: '⎇ ' + g.branch })];
  if (g.conflicts) parts.push(el('span', { class: 'conflict', text: `✖${g.conflicts}` }));
  if (dirty) parts.push(el('span', { class: 'dirty', title: `${g.staged} staged · ${g.changes} modificados · ${g.untracked} novos`, text: `●${dirty}` }));
  else if (full) parts.push(el('span', { class: 'clean', text: '✓ limpo' }));
  if (g.ahead) parts.push(el('span', { class: 'sync', title: 'commits para enviar', text: `↑${g.ahead}` }));
  if (g.behind) parts.push(el('span', { class: 'sync', title: 'commits para baixar', text: `↓${g.behind}` }));
  if (full && dirty) {
    parts.push(el('span', { text: `(${g.staged} staged, ${g.changes} mod., ${g.untracked} novos)` }));
  }
  return el('span', { class: 'git' }, parts);
}

// ---------------- render ----------------

let dragId = null;

function render() {
  const app = $('#app');
  app.className = `layout-${state.layout}`;
  document.querySelectorAll('.layout-switch [data-layout]').forEach((b) => {
    b.classList.toggle('on', b.dataset.layout === state.layout);
  });

  for (const [id, s] of sessions) s.host.classList.toggle('active', id === state.activeId);
  $('#empty').classList.toggle('hidden', !!sessions.get(state.activeId));

  renderSidebar();
  renderTopbar();
  renderCmdbar();
  renderStatus();
}

function renderSidebar() {
  const list = $('#ws-list');
  list.replaceChildren(
    ...state.workspaces.map((ws) => {
      const head = el(
        'div',
        {
          class: 'ws-head',
          title: ws.cwd,
          onclick: () => {
            ws.collapsed = !ws.collapsed;
            save();
            render();
          },
          oncontextmenu: (e) => wsMenu(e, ws),
          ondragover: (e) => dragId && e.preventDefault(),
          ondrop: (e) => {
            e.preventDefault();
            if (dragId) moveTerminal(dragId, ws, null);
          },
        },
        el('span', { class: 'ws-caret', text: '▼' }),
        el('span', { class: 'dot', style: { background: ws.color } }),
        el('span', { class: 'ws-name', text: ws.name }),
        el('button', {
          class: 'icon-btn',
          title: 'Novo terminal',
          onclick: (e) => {
            e.stopPropagation();
            newTerminal(ws);
          },
          text: '＋',
        }),
        el('button', {
          class: 'icon-btn',
          title: 'Opções',
          onclick: (e) => {
            e.stopPropagation();
            wsMenu(e, ws);
          },
          text: '⋯',
        }),
      );

      let body;
      if (!ws.open) {
        body = el(
          'div',
          { class: 'ws-closed-hint' },
          `${ws.terminals.length} terminal(is) fechado(s) · `,
          el('a', { onclick: () => openWorkspace(ws), text: 'abrir' }),
        );
      } else {
        body = ws.terminals.map((t) => termItem(ws, t));
      }

      return el(
        'div',
        { class: `ws${ws.collapsed ? ' collapsed' : ''}${ws.open ? '' : ' closed'}` },
        head,
        el('div', { class: 'ws-terms' }, body),
      );
    }),
  );
}

function termItem(ws, t) {
  const s = sessions.get(t.id);
  return el(
    'div',
    {
      class: `term-item${t.id === state.activeId ? ' active' : ''}${s?.exited ? ' exited' : ''}`,
      draggable: 'true',
      onclick: () => activate(t.id),
      ondblclick: () => editTerminal(t.id),
      oncontextmenu: (e) => termMenu(e, t.id),
      ondragstart: (e) => {
        dragId = t.id;
        e.dataTransfer.effectAllowed = 'move';
      },
      ondragend: () => (dragId = null),
      ondragover: (e) => dragId && e.preventDefault(),
      ondrop: (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (dragId) moveTerminal(dragId, ws, t.id);
      },
    },
    el('span', { class: 'bar', style: { background: t.color || ws.color } }),
    el(
      'div',
      { class: 'body' },
      el(
        'div',
        { class: 'row' },
        el('span', { class: 'name', text: termLabel(t) }),
        el('button', {
          class: 'icon-btn close',
          title: 'Fechar terminal',
          onclick: (e) => {
            e.stopPropagation();
            closeTerminal(t.id);
          },
          text: '✕',
        }),
      ),
      el('div', { class: 'row' }, gitBadge(t.cwd)),
      el('div', { class: 'cwd', title: t.cwd }, el('bdi', { text: shortPath(t.cwd) })),
    ),
  );
}

function renderTopbar() {
  const entry = activeEntry();

  // modo sidebar: título + git do terminal ativo
  const infoBox = $('#active-info');
  infoBox.replaceChildren(
    ...(entry
      ? [
          el('span', { class: 'dot', style: { background: entry.t.color || entry.ws.color } }),
          el('span', { class: 'title', text: termLabel(entry.t) }),
          gitBadge(entry.t.cwd, { full: true }),
        ].filter(Boolean)
      : []),
  );

  // modo abas
  const area = $('#tabs-area');
  if (state.layout !== 'tabs') {
    area.replaceChildren();
    return;
  }
  const ws = currentWs();
  const select = el(
    'select',
    {
      class: 'ws-select',
      title: 'Workspace',
      onchange: (e) => {
        if (e.target.value === '__new') return createWorkspace().then(render);
        const target = wsById(e.target.value);
        if (!target.open) openWorkspace(target);
        else if (target.terminals.length) activate(target.terminals[0].id);
        else newTerminal(target);
      },
    },
    state.workspaces.map((w) => el('option', { value: w.id, selected: w === ws, text: w.name + (w.open ? '' : ' (fechado)') })),
    el('option', { value: '__new', text: '＋ Novo workspace…' }),
  );
  const tabs = el(
    'div',
    { class: 'tabs' },
    (ws?.open ? ws.terminals : []).map((t) => {
      const s = sessions.get(t.id);
      const g = gitByCwd.get(t.cwd);
      const dirty = g ? g.changes + g.staged + g.untracked : 0;
      return el(
        'div',
        {
          class: `tab${t.id === state.activeId ? ' active' : ''}`,
          style: { borderTopColor: t.color || ws.color },
          title: `${t.cwd}${g?.branch ? '\n⎇ ' + g.branch : ''}`,
          onclick: () => activate(t.id),
          ondblclick: () => editTerminal(t.id),
          oncontextmenu: (e) => termMenu(e, t.id),
          onauxclick: (e) => e.button === 1 && closeTerminal(t.id),
        },
        el('span', { class: 'name', style: s?.exited ? { textDecoration: 'line-through' } : null, text: termLabel(t) }),
        g?.branch ? el('span', { class: 'git' }, el('span', { class: 'branch', text: g.branch }), dirty ? el('span', { class: 'dirty', text: '●' }) : null) : null,
        el('button', {
          class: 'icon-btn close',
          onclick: (e) => {
            e.stopPropagation();
            closeTerminal(t.id);
          },
          text: '✕',
        }),
      );
    }),
  );
  area.replaceChildren(
    select,
    el('button', { class: 'icon-btn', title: 'Opções do workspace', onclick: (e) => ws && wsMenu(e, ws), text: '⋯' }),
    tabs,
    el('button', { class: 'icon-btn', title: 'Novo terminal (Ctrl+Shift+T)', onclick: () => newTerminal(ws), text: '＋' }),
  );
}

function renderCmdbar() {
  $('#cmdbar').replaceChildren(
    el('span', { class: 'cmd-label', text: 'Comandos' }),
    ...state.commands.map((c) =>
      el('button', {
        class: 'chip',
        title: c.cmd + '\n(botão direito para editar)',
        onclick: () => runCommand(c.cmd),
        oncontextmenu: (e) =>
          showMenu(e, [
            { label: 'Editar', action: () => editCommand(c) },
            {
              label: 'Mover para a esquerda',
              action: () => {
                const i = state.commands.indexOf(c);
                if (i > 0) [state.commands[i - 1], state.commands[i]] = [state.commands[i], state.commands[i - 1]];
                save();
                render();
              },
            },
            { sep: true },
            {
              label: 'Remover',
              danger: true,
              action: () => {
                state.commands = state.commands.filter((x) => x !== c);
                save();
                render();
              },
            },
          ]),
        text: c.label,
      }),
    ),
    el('button', { class: 'chip add', title: 'Adicionar comando', onclick: () => editCommand(null), text: '＋' }),
  );
}

function renderStatus() {
  const entry = activeEntry();
  const bar = $('#statusbar');
  if (!entry) return bar.replaceChildren(el('span', { text: info.bash ? 'Git Bash: ' + info.bash : 'Git Bash não encontrado' }));
  bar.replaceChildren(
    el('span', { text: entry.ws.name }),
    el('span', { class: 'path', title: 'Abrir no Explorer', onclick: () => api.openPath(entry.t.cwd), text: entry.t.cwd }),
    el('span', { class: 'spacer' }),
    el('span', { text: 'Ctrl+Shift+T novo · Ctrl+Tab alternar · F2 editar' }),
  );
}

// ---------------- menus ----------------

function showMenu(e, items) {
  e.preventDefault();
  e.stopPropagation();
  const menu = $('#menu');
  menu.replaceChildren(
    ...items.map((it) =>
      it.sep
        ? el('div', { class: 'menu-sep' })
        : el('div', {
            class: `menu-item${it.danger ? ' danger' : ''}`,
            onclick: () => {
              hideMenu();
              it.action();
            },
            text: it.label,
          }),
    ),
  );
  menu.classList.remove('hidden');
  const r = menu.getBoundingClientRect();
  menu.style.left = Math.min(e.clientX, innerWidth - r.width - 6) + 'px';
  menu.style.top = Math.min(e.clientY, innerHeight - r.height - 6) + 'px';
}
function hideMenu() {
  $('#menu').classList.add('hidden');
}
document.addEventListener('mousedown', (e) => {
  if (!$('#menu').contains(e.target)) hideMenu();
});

function termMenu(e, id) {
  showMenu(e, [
    { label: 'Editar (nome, cor, comando inicial)', action: () => editTerminal(id) },
    { label: 'Duplicar', action: () => duplicateTerminal(id) },
    { label: 'Reiniciar', action: () => restartSession(id) },
    {
      label: 'Abrir pasta no Explorer',
      action: () => api.openPath(findTerm(id).t.cwd),
    },
    { sep: true },
    { label: 'Fechar', danger: true, action: () => closeTerminal(id) },
  ]);
}

function wsMenu(e, ws) {
  showMenu(e, [
    { label: 'Novo terminal', action: () => newTerminal(ws) },
    { label: 'Editar workspace', action: () => editWorkspace(ws) },
    ws.open
      ? { label: 'Fechar workspace (mantém os terminais salvos)', action: () => closeWorkspace(ws) }
      : { label: 'Abrir workspace', action: () => openWorkspace(ws) },
    { label: 'Abrir pasta no Explorer', action: () => api.openPath(ws.cwd) },
    { sep: true },
    { label: 'Excluir workspace', danger: true, action: () => deleteWorkspace(ws) },
  ]);
}

// ---------------- modal ----------------

function openModal({ title, message, fields = [], submit = 'OK', danger = false }) {
  return new Promise((resolve) => {
    const backdrop = $('#modal-backdrop');
    const form = $('#modal');
    const values = Object.fromEntries(fields.map((f) => [f.key, f.value ?? '']));

    const done = (result) => {
      backdrop.classList.add('hidden');
      form.onsubmit = null;
      backdrop.onmousedown = null;
      document.removeEventListener('keydown', onKey, true);
      resolve(result);
      requestAnimationFrame(() => sessions.get(state.activeId)?.term.focus());
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        done(null);
      }
    };

    const fieldNodes = fields.map((f) => {
      let control;
      if (f.type === 'color') {
        const sw = COLORS.map((c) =>
          el('span', {
            class: `swatch${values[f.key] === c ? ' on' : ''}`,
            style: { background: c },
            onclick: (ev) => {
              values[f.key] = c;
              ev.target.parentElement.querySelectorAll('.swatch').forEach((x) => x.classList.toggle('on', x === ev.target));
            },
          }),
        );
        control = el('div', { class: 'swatches' }, sw);
      } else {
        const input = el('input', {
          type: 'text',
          class: f.mono ? 'mono' : null,
          value: values[f.key],
          placeholder: f.placeholder || '',
          spellcheck: 'false',
          oninput: (ev) => (values[f.key] = ev.target.value),
        });
        control =
          f.type === 'folder'
            ? el(
                'div',
                { class: 'folder-row' },
                input,
                el('button', {
                  type: 'button',
                  class: 'btn',
                  onclick: async () => {
                    const p = await api.pickFolder(values[f.key] || info.home);
                    if (p) {
                      values[f.key] = input.value = p;
                    }
                  },
                  text: 'Escolher…',
                }),
              )
            : input;
      }
      return el('div', { class: 'field' }, el('label', { text: f.label }), control, f.hint ? el('div', { class: 'hint', text: f.hint }) : null);
    });

    form.replaceChildren(
      el('h2', { text: title }),
      message ? el('p', { text: message }) : null,
      ...fieldNodes,
      el(
        'div',
        { class: 'modal-actions' },
        el('button', { type: 'button', class: 'btn', onclick: () => done(null), text: 'Cancelar' }),
        el('button', { type: 'submit', class: `btn ${danger ? 'danger' : 'primary'}`, text: submit }),
      ),
    );
    form.onsubmit = (e) => {
      e.preventDefault();
      done(fields.length ? values : true);
    };
    backdrop.onmousedown = (e) => e.target === backdrop && done(null);
    document.addEventListener('keydown', onKey, true);
    backdrop.classList.remove('hidden');
    requestAnimationFrame(() => (form.querySelector('input') || form.querySelector('.btn.primary, .btn.danger'))?.focus());
  });
}

// ---------------- atalhos ----------------

function handleShortcut(e) {
  const k = e.key.toLowerCase();
  if (e.ctrlKey && e.shiftKey && k === 't') return newTerminal(), true;
  if (e.ctrlKey && e.shiftKey && k === 'w') return state.activeId && closeTerminal(state.activeId), true;
  if (e.ctrlKey && k === 'tab') return cycleTerminal(e.shiftKey ? -1 : 1), true;
  if (e.key === 'F2') return state.activeId && editTerminal(state.activeId), true;
  return false;
}

function terminalKeyHandler(e, id) {
  if (e.type !== 'keydown') return true;
  const s = sessions.get(id);
  const k = e.key.toLowerCase();
  if (handleShortcut(e)) {
    e.preventDefault();
    return false;
  }
  // copiar: Ctrl+Shift+C, ou Ctrl+C quando há seleção
  if (e.ctrlKey && k === 'c' && (e.shiftKey || s.term.hasSelection())) {
    if (s.term.hasSelection()) api.clipboardWrite(s.term.getSelection());
    s.term.clearSelection();
    e.preventDefault();
    return false;
  }
  // colar: Ctrl+V / Ctrl+Shift+V
  if (e.ctrlKey && k === 'v') {
    e.preventDefault();
    api.clipboardRead().then((text) => text && s.term.paste(text));
    return false;
  }
  return true;
}

window.addEventListener('keydown', (e) => {
  if (!$('#modal-backdrop').classList.contains('hidden')) return;
  if (e.target.closest?.('.xterm')) return; // já tratado pelo terminal
  if (handleShortcut(e)) e.preventDefault();
});

// ---------------- init ----------------

async function init() {
  info = await api.ptyInfo();
  state = (await api.loadState()) || defaultState();
  state.commands ||= [];
  state.layout ||= 'left';

  document.querySelectorAll('.layout-switch [data-layout]').forEach((b) => {
    b.addEventListener('click', () => setLayout(b.dataset.layout));
  });
  $('#btn-new-ws').addEventListener('click', createWorkspace);
  $('#btn-empty-new').addEventListener('click', () => newTerminal());

  new ResizeObserver(() => fitActive()).observe($('#terminals'));

  // restaura a sessão: recria todos os terminais dos workspaces abertos
  for (const { ws, t } of allTerminals()) if (ws.open) createSession(t);

  if (!activeEntry()?.ws.open) state.activeId = allTerminals().find((x) => x.ws.open)?.t.id || null;
  if (state.activeId) activate(state.activeId);
  else if (!allTerminals().length) newTerminal(state.workspaces[0]);
  else render();

  if (!info.bash) {
    openModal({
      title: 'Git Bash não encontrado',
      message: 'Instale o Git for Windows ou defina a variável de ambiente GIT_BASH_PATH apontando para bash.exe.',
    });
  }

  pollGit();
  setInterval(pollGit, GIT_POLL_MS);
}

window.addEventListener('beforeunload', () => {
  clearTimeout(saveTimer);
  api.saveState(state);
});

init();
