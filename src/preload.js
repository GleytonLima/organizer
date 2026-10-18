const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: (state) => ipcRenderer.send('state:save', state),
  saveStateSync: (state) => ipcRenderer.sendSync('state:saveSync', state),

  // caminho no disco de um arquivo arrastado/escolhido (vazio para um print colado)
  filePath: (file) => webUtils.getPathForFile(file),

  ptyInfo: () => ipcRenderer.invoke('pty:info'),
  ptyCreate: (opts) => ipcRenderer.invoke('pty:create', opts),
  ptyWrite: (id, data) => ipcRenderer.send('pty:write', id, data),
  ptyResize: (id, cols, rows) => ipcRenderer.send('pty:resize', id, cols, rows),
  ptyKill: (id) => ipcRenderer.send('pty:kill', id),
  onPtyData: (cb) => ipcRenderer.on('pty:data', (_e, id, data) => cb(id, data)),
  onPtyExit: (cb) => ipcRenderer.on('pty:exit', (_e, id, code) => cb(id, code)),

  fromMsys: (p) => ipcRenderer.invoke('path:fromMsys', p),
  pickFolder: (defaultPath) => ipcRenderer.invoke('dialog:folder', defaultPath),
  pickFolders: (defaultPath) => ipcRenderer.invoke('dialog:folders', defaultPath),
  clipboardRead: () => ipcRenderer.invoke('clipboard:read'),
  clipboardWrite: (text) => ipcRenderer.send('clipboard:write', text),
  openPath: (p) => ipcRenderer.send('shell:openPath', p),
  openInEditor: (p) => ipcRenderer.invoke('editor:open', p),
  playwrightDetect: (dir) => ipcRenderer.invoke('playwright:detect', dir),

  gitStatus: (cwd) => ipcRenderer.invoke('git:status', cwd),

  memory: {
    add: (data) => ipcRenderer.invoke('memory:add', data),
    update: (id, data) => ipcRenderer.invoke('memory:update', id, data),
    remove: (id) => ipcRenderer.invoke('memory:remove', id),
    get: (id) => ipcRenderer.invoke('memory:get', id),
    list: (opts) => ipcRenderer.invoke('memory:list', opts),
    search: (query, opts) => ipcRenderer.invoke('memory:search', query, opts),
    links: (id) => ipcRenderer.invoke('memory:links', id),
    many: (refs) => ipcRenderer.invoke('memory:many', refs),
    markReview: (ids, data) => ipcRenderer.invoke('memory:markReview', ids, data),
    confirmReview: (id) => ipcRenderer.invoke('memory:confirmReview', id),
    settings: () => ipcRenderer.invoke('memory:settings'),
    saveSettings: (s) => ipcRenderer.invoke('memory:saveSettings', s),
    testEmbeddings: () => ipcRenderer.invoke('memory:testEmbeddings'),
    reindex: () => ipcRenderer.invoke('memory:reindex'),
    onChanged: (cb) => ipcRenderer.on('memory:changed', () => cb()),
  },

  // Sessões de agente via ACP (Agent Client Protocol): terminal do tipo "agente".
  acp: {
    start: (id, opts) => ipcRenderer.invoke('acp:start', id, opts),
    prompt: (id, text, attachments) => ipcRenderer.invoke('acp:prompt', id, text, attachments),
    cancel: (id) => ipcRenderer.invoke('acp:cancel', id),
    permission: (id, requestId, optionId) => ipcRenderer.invoke('acp:permission', id, requestId, optionId),
    setMode: (id, modeId) => ipcRenderer.invoke('acp:setMode', id, modeId),
    setConfig: (id, configId, value) => ipcRenderer.invoke('acp:setConfig', id, configId, value),
    sessions: (id) => ipcRenderer.invoke('acp:sessions', id),
    stop: (id) => ipcRenderer.send('acp:stop', id),
    onEvent: (cb) => ipcRenderer.on('acp:event', (_e, id, event) => cb(id, event)),
  },

  // Eventos do painel Insights (src/main/metrics).
  metrics: {
    record: (ev) => ipcRenderer.send('metrics:record', ev),
    query: (opts) => ipcRenderer.invoke('metrics:query', opts),
  },
  // Feedback qualitativo (texto + rótulo + contexto) sobre tarefas ou tags.
  feedback: {
    add: (f) => ipcRenderer.invoke('feedback:add', f),
    list: (q) => ipcRenderer.invoke('feedback:list', q),
    remove: (id) => ipcRenderer.invoke('feedback:remove', id),
    exportAll: () => ipcRenderer.invoke('feedback:export'),
  },

  // Sync da memória com o bo-memory-server.
  sync: {
    settings: () => ipcRenderer.invoke('sync:settings'),
    saveSettings: (s) => ipcRenderer.invoke('sync:saveSettings', s),
    test: () => ipcRenderer.invoke('sync:test'),
    status: () => ipcRenderer.invoke('sync:status'),
    now: () => ipcRenderer.invoke('sync:now'),
    setContext: (ctx) => ipcRenderer.send('sync:context', ctx),
    resolve: (id, choice, text) => ipcRenderer.invoke('sync:resolve', id, choice, text),
    claim: (id) => ipcRenderer.invoke('sync:claim', id),
    onStatus: (cb) => ipcRenderer.on('sync:status', (_e, s) => cb(s)),
    // projeto/layout no servidor (trocar de máquina)
    remoteProjects: () => ipcRenderer.invoke('sync:remoteProjects'),
    fetchProject: (key, opts) => ipcRenderer.invoke('sync:fetchProject', key, opts),
    clone: (url, dir) => ipcRenderer.invoke('sync:clone', url, dir),
    adoptProject: (key, project, layout) => ipcRenderer.invoke('sync:adoptProject', key, project, layout),
    onProject: (cb) => ipcRenderer.on('sync:project', (_e, id, changed) => cb(id, changed)),
  },

  showToast: (payload) => ipcRenderer.invoke('notify:show', payload),
  onToastClicked: (cb) => ipcRenderer.on('notify:clicked', (_e, id) => cb(id)),

  // API local: pedidos chegam do main; a resposta volta com o mesmo id.
  onApiRequest: (cb) => ipcRenderer.on('api:request', (_e, id, method, params) => cb(id, method, params)),
  apiRespond: (id, error, result) => ipcRenderer.send('api:response', id, error, result),
});
