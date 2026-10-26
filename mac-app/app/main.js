// Ambient Video for the Mac: the same idea as the Pocket TV app. A window that is its
// own browser, so YouTube TV, Plex or any site opens inside it, and the glow script
// (ambient.js, shared with the Pocket TV app) runs in every page and frame.
const { app, BrowserWindow, ipcMain, Menu, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

app.setName('Ambient Video');
const HOME = 'file://' + path.join(__dirname, 'home.html');
// youtube.com/tv only opens for TVs; this is a Samsung TV browser's user agent.
const TV_UA = 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) 76.0.3809.146/6.0 TV Safari/537.36';
let defaultUA = '';

const isYtTv = (u) => /^https?:\/\/(www\.)?youtube\.com\/tv/.test(u || '');
// youtube.com/watch?v=ID, youtu.be/ID, shorts… → the same video in the YouTube TV interface.
function toYtTv(u) {
  if (!u || isYtTv(u) || !/^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)(\/|$)/.test(u)) return u;
  const m = u.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([\w-]{11})/);
  return m ? 'https://www.youtube.com/tv#/watch?v=' + m[1] : 'https://www.youtube.com/tv';
}

// ---- Glow settings (shared by every page and frame, and the settings window) ----
const cfgFile = () => path.join(app.getPath('userData'), 'glow.json');
let cfg = { on: true, amount: 100, size: 80 };
try { cfg = { ...cfg, ...JSON.parse(fs.readFileSync(cfgFile(), 'utf8')) }; } catch (e) {}
function saveCfg(part) {
  cfg = { ...cfg, ...part };
  try { fs.writeFileSync(cfgFile(), JSON.stringify(cfg)); } catch (e) {}
  if (win) for (const f of win.webContents.mainFrame.framesInSubtree) {
    f.executeJavaScript('window.__ambientReload && window.__ambientReload()').catch(() => {});
  }
  if (panel && !panel.isDestroyed()) panel.webContents.send('cfg', cfg);
}
ipcMain.on('cfg-get', (e) => { e.returnValue = JSON.stringify(cfg); });
ipcMain.on('cfg-set', (e, json) => { try { saveCfg(JSON.parse(json)); } catch (err) {} });
ipcMain.on('panel', () => togglePanel());
ipcMain.on('panel-close', () => { if (panel && !panel.isDestroyed()) panel.hide(); });

let win = null, panel = null;

function go(url) {
  url = toYtTv(url);
  const ua = isYtTv(url) ? TV_UA : defaultUA;
  if (win.webContents.getUserAgent() !== ua) win.webContents.setUserAgent(ua);
  win.loadURL(url);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 780, minWidth: 640, minHeight: 400,
    backgroundColor: '#000000', title: 'Ambient Video', titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegrationInSubFrames: true, // the glow also runs in iframe players
      contextIsolation: true, sandbox: false, autoplayPolicy: 'no-user-gesture-required',
    },
  });
  defaultUA = win.webContents.getUserAgent().replace(/ (Electron|ambient-video)\/\S+/g, '');
  win.webContents.setUserAgent(defaultUA);

  // Stay in this window: links that open new windows open here; other apps' links go to the Mac.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) go(url); else shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });
  // Switch user agent when going into or out of YouTube TV, and send YouTube to YouTube TV.
  win.webContents.on('will-navigate', (e, url) => {
    const t = toYtTv(url);
    const want = isYtTv(t) ? TV_UA : defaultUA;
    if (t !== url || want !== win.webContents.getUserAgent()) { e.preventDefault(); go(t); }
  });
  win.on('page-title-updated', (e) => { e.preventDefault(); win.setTitle('Ambient Video'); });
  win.on('move', placePanel);
  win.on('resize', placePanel);
  go(HOME);
}

// ---- Glow settings window (works on every site, even ones that grab the mouse) ----
function placePanel() {
  if (!panel || panel.isDestroyed() || !win) return;
  const b = win.getContentBounds();
  panel.setBounds({ x: b.x + 24, y: b.y + 40, width: 340, height: 250 });
}
function togglePanel() {
  if (panel && !panel.isDestroyed()) {
    if (panel.isVisible()) { panel.hide(); return; }
    placePanel(); panel.show(); panel.webContents.send('cfg', cfg); return;
  }
  panel = new BrowserWindow({
    parent: win, frame: false, resizable: false, show: false, transparent: true, hasShadow: true,
    fullscreenable: false, alwaysOnTop: true, skipTaskbar: true, backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'panel-preload.js'), contextIsolation: true },
  });
  panel.loadFile(path.join(__dirname, 'panel.html'));
  panel.once('ready-to-show', () => { placePanel(); panel.show(); panel.webContents.send('cfg', cfg); });
  panel.on('blur', () => { if (panel && !panel.isDestroyed()) panel.hide(); });
}

function menu() {
  const tpl = [
    { role: 'appMenu' },
    { role: 'editMenu' },
    {
      label: 'Go', submenu: [
        { label: 'Home', accelerator: 'CmdOrCtrl+Shift+H', click: () => go(HOME) },
        { label: 'YouTube TV', accelerator: 'CmdOrCtrl+Y', click: () => go('https://www.youtube.com/tv') },
        { label: 'Back', accelerator: 'CmdOrCtrl+[', click: () => win.webContents.navigationHistory.canGoBack() && win.webContents.navigationHistory.goBack() },
        { label: 'Forward', accelerator: 'CmdOrCtrl+]', click: () => win.webContents.navigationHistory.canGoForward() && win.webContents.navigationHistory.goForward() },
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => win.webContents.reload() },
      ],
    },
    {
      label: 'Glow', submenu: [
        { label: 'Glow Settings…', accelerator: 'CmdOrCtrl+,', click: togglePanel },
        { label: 'Glow On / Off', accelerator: 'CmdOrCtrl+G', click: () => saveCfg({ on: !cfg.on }) },
      ],
    },
    { label: 'View', submenu: [{ role: 'togglefullscreen' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }] },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) {
    try { app.dock.setIcon(nativeImage.createFromPath(path.join(__dirname, 'icon.png'))); } catch (e) {}
  }
  menu();
  createWindow();
});
app.on('window-all-closed', () => app.quit());
// Open links given to the app (e.g. dragged onto its icon).
app.on('open-url', (e, url) => { e.preventDefault(); if (win) go(url); });
