const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: (state) => ipcRenderer.send('state:save', state),

  ptyInfo: () => ipcRenderer.invoke('pty:info'),
  ptyCreate: (opts) => ipcRenderer.invoke('pty:create', opts),
  ptyWrite: (id, data) => ipcRenderer.send('pty:write', id, data),
  ptyResize: (id, cols, rows) => ipcRenderer.send('pty:resize', id, cols, rows),
  ptyKill: (id) => ipcRenderer.send('pty:kill', id),
  onPtyData: (cb) => ipcRenderer.on('pty:data', (_e, id, data) => cb(id, data)),
  onPtyExit: (cb) => ipcRenderer.on('pty:exit', (_e, id, code) => cb(id, code)),

  fromMsys: (p) => ipcRenderer.invoke('path:fromMsys', p),
  pickFolder: (defaultPath) => ipcRenderer.invoke('dialog:folder', defaultPath),
  clipboardRead: () => ipcRenderer.invoke('clipboard:read'),
  clipboardWrite: (text) => ipcRenderer.send('clipboard:write', text),
  openPath: (p) => ipcRenderer.send('shell:openPath', p),

  gitStatus: (cwd) => ipcRenderer.invoke('git:status', cwd),
});
