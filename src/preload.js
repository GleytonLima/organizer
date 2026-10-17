const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: (state) => ipcRenderer.send('state:save', state),
  saveStateSync: (state) => ipcRenderer.sendSync('state:saveSync', state),

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
    agents: () => ipcRenderer.invoke('acp:agents'),
    start: (id, opts) => ipcRenderer.invoke('acp:start', id, opts),
    prompt: (id, text) => ipcRenderer.invoke('acp:prompt', id, text),
    cancel: (id) => ipcRenderer.invoke('acp:cancel', id),
    permission: (id, requestId, optionId) => ipcRenderer.invoke('acp:permission', id, requestId, optionId),
    stop: (id) => ipcRenderer.send('acp:stop', id),
    onEvent: (cb) => ipcRenderer.on('acp:event', (_e, id, event) => cb(id, event)),
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
  },

  showToast: (payload) => ipcRenderer.invoke('notify:show', payload),
  onToastClicked: (cb) => ipcRenderer.on('notify:clicked', (_e, terminalId) => cb(terminalId)),

  // API local: pedidos chegam do main; a resposta volta com o mesmo id.
  onApiRequest: (cb) => ipcRenderer.on('api:request', (_e, id, method, params) => cb(id, method, params)),
  apiRespond: (id, error, result) => ipcRenderer.send('api:response', id, error, result),
});
