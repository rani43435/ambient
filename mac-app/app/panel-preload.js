const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('glow', {
  set: (part) => ipcRenderer.send('cfg-set', JSON.stringify(part)),
  close: () => ipcRenderer.send('panel-close'),
  onCfg: (fn) => ipcRenderer.on('cfg', (e, c) => fn(c)),
});
