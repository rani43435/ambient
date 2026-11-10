// Runs in every page and frame before the page's own scripts: gives the glow script its
// settings (shared through the app) and starts it in the page itself.
const { contextBridge, ipcRenderer, webFrame } = require('electron');
const fs = require('fs');
const path = require('path');

contextBridge.exposeInMainWorld('AmbientBridge', {
  get: () => ipcRenderer.sendSync('cfg-get'),
  set: (json) => ipcRenderer.send('cfg-set', String(json).slice(0, 500)),
  panel: () => ipcRenderer.send('panel'),
  // a screenshot of part of the page, when the page may not read a video itself
  capture: (r) => ipcRenderer.invoke('capture', r),
});
const code = fs.readFileSync(path.join(__dirname, 'ambient.js'), 'utf8');
webFrame.executeJavaScript(code).catch(() => {});
