// Ambient Video on YouTube TV (youtube.com/tv) in Chrome: the same glow script as the
// Pocket TV app (android/app/src/main/assets/ambient.js, copied below by build-tv.sh),
// with its settings kept in chrome.storage so the toolbar popup and the panel agree.
(() => {
  let cache = {};
  window.AmbientBridge = {
    get: () => JSON.stringify(cache),
    set: (json) => {
      try { const v = JSON.parse(json); cache = { ...cache, ...v }; chrome.storage.sync.set({ on: v.on, amount: v.amount, size: v.size }); } catch (e) {}
    },
  };
  const reload = () => { if (window.__ambientReload) window.__ambientReload(); };
  try {
    chrome.storage.sync.get({ on: true, amount: 100, size: 80 }, (v) => { cache = v; reload(); });
    chrome.storage.onChanged.addListener((ch) => { for (const k in ch) cache[k] = ch[k].newValue; reload(); });
  } catch (e) {}
})();
// Ambient Video (Pocket TV app): an Ambilight around whatever video is playing,
// on YouTube or any other site. The app injects this into every page and every
// frame. Same colour method as index.html and the Chrome extension: read a thin
// strip along each edge of a 96x54 copy of the frame, average it into segments,
// boost it, ease it, and paint it into a 16x9 canvas stretched up behind the
// (slightly shrunk) video. It reads the <video> directly, no screen sharing.
(() => {
  if (window.__ambientVideo) return;
  window.__ambientVideo = true;
  // The Ambient Video page has its own glow: leave it alone.
  if (/rani43435\.github\.io\/(ambient|glancepay\/ambient)/.test(location.href)) return;

  const SW = 96, SH = 54, EDGE = 1, GW = 16, GH = 9, SPREAD = 1.8;
  const DEF = { on: true, amount: 100, size: 80 };
  const bridge = window.AmbientBridge; // set by the Android app (shared by all pages and frames)
  let cfg = { ...DEF };
  function load() {
    try { if (bridge) return { ...DEF, ...JSON.parse(bridge.get() || '{}') }; } catch (e) {}
    try { return { ...DEF, ...JSON.parse(localStorage.getItem('ambientVideo') || '{}') }; } catch (e) {}
    return { ...DEF };
  }
  function save(part) {
    cfg = { ...cfg, ...part };
    try { if (bridge) bridge.set(JSON.stringify(cfg)); else localStorage.setItem('ambientVideo', JSON.stringify(cfg)); } catch (e) {}
    apply();
  }
  cfg = load();

  // ---- Styles ----
  const css = `
.av-host.av-on { background: #000 !important; }
.av-host.av-on video.av-video { transform: scale(var(--av-scale, 0.8)) !important; transform-origin: center center !important; border-radius: 6px; }
.av-video.av-pos { position: relative; }
#av-glow { position: absolute !important; left: 0; top: 0; margin: 0 !important; pointer-events: none; display: none;
  -webkit-mask-image: radial-gradient(closest-side, #000 68%, transparent); mask-image: radial-gradient(closest-side, #000 68%, transparent); }
.av-host.av-on > #av-glow { display: block; }
:fullscreen.av-host > video.av-video { width: 100% !important; height: 100% !important; object-fit: contain; }
#av-btn { position: absolute; top: 12px; left: 12px; z-index: 2147483646; width: 44px; height: 44px; border-radius: 50%;
  border: 1.5px solid #34373D; background: rgba(20,21,24,.75); padding: 0; cursor: pointer; display: flex; align-items: center; justify-content: center;
  opacity: 0; transition: opacity .3s; pointer-events: none; }
#av-btn.show, #av-btn:focus { opacity: 1; pointer-events: auto; }
#av-btn:focus { outline: 3px solid #7FE3B0; }
#av-btn svg { width: 24px; height: 24px; fill: none; stroke: #fff; stroke-width: 2; stroke-linecap: round; }
.av-on > #av-btn svg { stroke: #7FE3B0; }
#av-panel { position: absolute; top: 64px; left: 12px; z-index: 2147483647; display: none; flex-direction: column; gap: 12px;
  padding: 14px 16px; min-width: 250px; background: rgba(20,21,24,.94); border: 1px solid #34373D; border-radius: 14px;
  color: #F2F2EF; font: 500 15px/1.2 Roboto, system-ui, sans-serif; text-align: left; }
#av-panel.open { display: flex; }
#av-panel label { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
#av-panel input[type=range] { width: 130px; accent-color: #7FE3B0; }
#av-panel input[type=checkbox] { accent-color: #7FE3B0; width: 20px; height: 20px; }
#av-panel input:focus { outline: 2px solid #7FE3B0; outline-offset: 2px; }`;
  function addStyle() {
    if (document.getElementById('av-style')) return;
    const st = document.createElement('style'); st.id = 'av-style'; st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  // ---- Full screen: if a site puts only the <video> in full screen, the glow
  // (its sibling) would be hidden, so put the video's player box in full screen instead.
  const realFS = Element.prototype.requestFullscreen;
  if (realFS) {
    Element.prototype.requestFullscreen = function (...a) {
      const t = this instanceof HTMLVideoElement && cfg.on && this.parentElement ? this.parentElement : this;
      return realFS.apply(t, a);
    };
  }
  if (Element.prototype.webkitRequestFullscreen) {
    const realW = Element.prototype.webkitRequestFullscreen;
    Element.prototype.webkitRequestFullscreen = function (...a) {
      const t = this instanceof HTMLVideoElement && cfg.on && this.parentElement ? this.parentElement : this;
      return realW.apply(t, a);
    };
  }

  // ---- Colour reading (same as index.html) ----
  const sc = document.createElement('canvas'); sc.width = SW; sc.height = SH;
  const s = sc.getContext('2d', { willReadFrequently: true });
  const glow = document.createElement('canvas'); glow.id = 'av-glow'; glow.width = GW; glow.height = GH;
  const g = glow.getContext('2d', { alpha: false });
  const out = g.createImageData(GW, GH);
  const cur = new Float32Array(GW * GH * 3);
  const blocked = new WeakSet(); // videos we can't read (protected / other site without CORS)
  let host = null, video = null, last = 0, lastT = -1;

  function strip(px, n, side) {
    const res = [];
    for (let k = 0; k < n; k++) {
      let r = 0, gg = 0, b = 0, c = 0;
      const horiz = side === 'top' || side === 'bottom';
      const len = horiz ? SW : SH;
      const a0 = Math.floor((k * len) / n), a1 = Math.floor(((k + 1) * len) / n);
      for (let a = a0; a < a1; a++) {
        for (let d = 0; d < EDGE; d++) {
          const x = horiz ? a : side === 'left' ? d : SW - 1 - d;
          const y = horiz ? (side === 'top' ? d : SH - 1 - d) : a;
          const i = (y * SW + x) * 4;
          r += px[i]; gg += px[i + 1]; b += px[i + 2]; c++;
        }
      }
      res.push([r / c, gg / c, b / c]);
    }
    return res;
  }
  function boost([r, gg, b]) {
    const l = 0.299 * r + 0.587 * gg + 0.114 * b;
    return [r, gg, b].map((v) => Math.max(0, Math.min(255, (l + (v - l) * 1.8) * 1.3)));
  }
  function sampleEdges() {
    let px;
    try { s.drawImage(video, 0, 0, SW, SH); px = s.getImageData(0, 0, SW, SH).data; }
    catch (e) { blocked.add(video); detach(); return; }
    const top = strip(px, GW, 'top'), bottom = strip(px, GW, 'bottom');
    const left = strip(px, GH, 'left'), right = strip(px, GH, 'right');
    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) {
        const dx = Math.min(x, GW - 1 - x) / (GW - 1), dy = Math.min(y, GH - 1 - y) / (GH - 1);
        let col = dx < dy ? (x < GW / 2 ? left[y] : right[y]) : (y < GH / 2 ? top[x] : bottom[x]);
        col = boost(col);
        const j = (y * GW + x) * 3, o = (y * GW + x) * 4;
        for (let c = 0; c < 3; c++) { cur[j + c] += (col[c] - cur[j + c]) * 0.35; out.data[o + c] = cur[j + c]; }
        out.data[o + 3] = 255;
      }
    }
    g.putImageData(out, 0, 0);
  }

  // Keep the glow centred on the video, SPREAD times its size (the player box clips the rest).
  function place() {
    const p = host.getBoundingClientRect(), v = video.getBoundingClientRect();
    if (!v.width || !v.height) return;
    const w = v.width * SPREAD, h = v.height * SPREAD;
    const ox = p.left + host.clientLeft - host.scrollLeft, oy = p.top + host.clientTop - host.scrollTop;
    glow.style.width = w + 'px'; glow.style.height = h + 'px';
    glow.style.transform = `translate(${v.left - ox + v.width / 2 - w / 2}px, ${v.top - oy + v.height / 2 - h / 2}px)`;
  }

  function apply() {
    if (!host) return;
    host.classList.toggle('av-on', !!cfg.on);
    host.style.setProperty('--av-scale', cfg.size / 100);
    glow.style.opacity = cfg.amount / 100;
    lastT = -1;
    syncPanel();
  }

  function paint(now) {
    requestAnimationFrame(paint);
    if (!cfg.on || !host || !video || !video.isConnected || now - last < 80) return;
    if (video.readyState < 2 || !video.videoWidth) return;
    place();
    if (video.paused && video.currentTime === lastT) return;
    lastT = video.currentTime; last = now;
    sampleEdges();
  }
  requestAnimationFrame(paint);

  // ---- Controls: a small button on the player (touch or D-pad), and a panel ----
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, ns) => { const n = ns ? document.createElementNS(ns, tag) : document.createElement(tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };
  const btn = el('button', { id: 'av-btn', 'aria-label': 'Ambient glow', title: 'Ambient glow' });
  const svg = el('svg', { viewBox: '0 0 24 24' }, NS);
  svg.append(el('rect', { x: 7, y: 8, width: 10, height: 8, rx: 1.5 }, NS),
    el('path', { d: 'M3 12h1.5M19.5 12H21M12 3v1.5M12 19.5V21M5.6 5.6l1 1M17.4 17.4l1 1M18.4 5.6l-1 1M6.6 17.4l-1 1' }, NS));
  btn.append(svg);
  const panel = el('div', { id: 'av-panel' });
  const row = (text, input) => { const l = el('label'); l.append(text + ' ', input); return l; };
  panel.append(
    row('Ambient glow', el('input', { type: 'checkbox', 'data-k': 'on' })),
    row('Strength', el('input', { type: 'range', min: 0, max: 100, step: 5, 'data-k': 'amount' })),
    row('Video size', el('input', { type: 'range', min: 50, max: 100, step: 5, 'data-k': 'size' })));
  const stop = (e) => e.stopPropagation();
  ['click', 'mousedown', 'pointerdown', 'touchstart', 'dblclick'].forEach((ev) => panel.addEventListener(ev, stop));
  panel.addEventListener('keydown', (e) => {
    e.stopPropagation(); // keep the site from seeking while the panel has focus
    if (e.key === 'Escape' || e.key === 'Backspace') { panel.classList.remove('open'); btn.focus(); e.preventDefault(); }
  });
  // In the app the settings open as a native window (works with the remote on any site);
  // in a plain browser the small HTML panel is used.
  function openPanel() {
    if (bridge && bridge.panel) { bridge.panel(); return; }
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) panel.querySelector('input').focus();
  }
  btn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); openPanel(); } });
  // Some players (YouTube TV) swallow mouse and touch events before they reach the
  // button, so catch a press on the button's area first, at the window level.
  let lastPress = 0;
  const hitBtn = (e) => {
    if (!btn.isConnected || !btn.classList.contains('show')) return false;
    const t = e.touches ? e.touches[0] : e;
    if (!t || t.clientX == null) return false;
    const r = btn.getBoundingClientRect();
    return t.clientX >= r.left - 6 && t.clientX <= r.right + 6 && t.clientY >= r.top - 6 && t.clientY <= r.bottom + 6;
  };
  ['pointerdown', 'mousedown', 'touchstart', 'pointerup', 'mouseup', 'touchend', 'click'].forEach((ev) =>
    window.addEventListener(ev, (e) => {
      if (!hitBtn(e)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if ((ev === 'pointerdown' || ev === 'mousedown' || ev === 'touchstart') && Date.now() - lastPress > 600) { lastPress = Date.now(); openPanel(); }
    }, { capture: true, passive: false }));
  panel.addEventListener('input', (e) => {
    const k = e.target.dataset.k; if (!k) return;
    save({ [k]: k === 'on' ? e.target.checked : +e.target.value });
  });
  document.addEventListener('click', (e) => { if (!panel.contains(e.target) && e.target !== btn) panel.classList.remove('open'); }, true);
  function syncPanel() {
    panel.querySelectorAll('input').forEach((i) => {
      if (i === document.activeElement && i.type === 'range') return;
      const k = i.dataset.k; if (i.type === 'checkbox') i.checked = !!cfg[k]; else i.value = cfg[k];
    });
  }
  let hideT;
  function showBtn() {
    if (!host) return;
    btn.classList.add('show'); clearTimeout(hideT);
    hideT = setTimeout(() => { if (!panel.classList.contains('open')) btn.classList.remove('show'); }, 3000);
  }
  ['pointermove', 'pointerdown', 'touchstart', 'keydown'].forEach((ev) => document.addEventListener(ev, showBtn, { passive: true, capture: true }));

  // Called by the app (menu key on the remote) and for G on a keyboard.
  window.__ambientToggle = () => save({ on: !cfg.on });
  window.__ambientPanel = () => { if (!host) return; showBtn(); openPanel(); };
  window.__ambientReload = () => { cfg = load(); apply(); };
  document.addEventListener('keydown', (e) => {
    if ((e.key !== 'g' && e.key !== 'G') || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    window.__ambientToggle();
  }, true);

  // ---- Find the main video and attach to its player box ----
  function pickVideo() {
    let best = null, bestA = 0;
    for (const v of document.querySelectorAll('video')) {
      if (blocked.has(v)) continue;
      const r = v.getBoundingClientRect(), a = r.width * r.height;
      if (r.width < 200 || r.height < 110) continue;
      const score = a * (v.paused ? 1 : 4) * (v.readyState >= 2 ? 2 : 1);
      if (score > bestA) { bestA = score; best = v; }
    }
    return best;
  }
  function detach() {
    if (host) host.classList.remove('av-on', 'av-host');
    if (video) video.classList.remove('av-video', 'av-pos');
    glow.remove(); btn.remove(); panel.remove();
    host = null; video = null;
  }
  function attach() {
    const v = pickVideo();
    if (!v) { if (video && !video.isConnected) detach(); return; }
    const h = v.closest('#movie_player') || v.parentElement;
    if (!h) return;
    if (v !== video || h !== host) {
      detach();
      addStyle();
      host = h; video = v; cur.fill(0); lastT = -1;
      if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
      host.classList.add('av-host');
      video.classList.add('av-video');
      if (getComputedStyle(video).position === 'static') video.classList.add('av-pos');
      v.addEventListener('seeked', () => (lastT = -1));
    }
    // Glow goes first in the box so the video paints on top of it.
    if (glow.parentNode !== host) host.insertBefore(glow, host.firstChild);
    if (btn.parentNode !== host) host.appendChild(btn);
    if (panel.parentNode !== host) host.appendChild(panel);
    apply();
  }
  function tick() {
    const n = load();
    if (n.on !== cfg.on || n.amount !== cfg.amount || n.size !== cfg.size) cfg = n; // settings changed in another frame / by the app
    attach();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick); else tick();
  setInterval(tick, 1000);
  document.addEventListener('fullscreenchange', () => (lastT = -1));
  document.addEventListener('yt-navigate-finish', tick);
})();
// YouTube TV puts a transparent layer over its player and takes every key for its own
// navigation, so the glow panel (which lives inside the player) never gets the mouse or
// the keyboard. While the panel is open, handle both here, before YouTube TV sees them.
(() => {
  const panel = () => document.getElementById('av-panel');
  const isOpen = () => { const p = panel(); return p && p.classList.contains('open'); };
  const inputs = () => [...panel().querySelectorAll('input')];
  const inRect = (r, x, y) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  let sel = 0, dragging = null;

  function commit(i) {
    const k = i.dataset.k, v = k === 'on' ? i.checked : +i.value;
    window.AmbientBridge.set(JSON.stringify({ [k]: v }));
    if (window.__ambientReload) window.__ambientReload();
  }
  function select(n) {
    const list = inputs(); sel = (n + list.length) % list.length;
    list.forEach((i, j) => (i.style.outline = j === sel ? '2px solid #7FE3B0' : ''));
    list.forEach((i, j) => (i.style.outlineOffset = '3px'));
  }
  function setRange(i, x) {
    const r = i.getBoundingClientRect(), min = +i.min, max = +i.max, step = +i.step || 1;
    const f = Math.max(0, Math.min(1, (x - r.left) / r.width));
    i.value = Math.round((min + f * (max - min)) / step) * step;
    commit(i);
  }
  const block = (e) => { e.preventDefault(); e.stopImmediatePropagation(); };

  // Mouse
  ['pointerdown', 'mousedown'].forEach((t) => window.addEventListener(t, (e) => {
    if (!isOpen()) return;
    const p = panel(); if (!inRect(p.getBoundingClientRect(), e.clientX, e.clientY)) return;
    block(e);
    if (t !== 'pointerdown') return;
    inputs().forEach((i, j) => {
      const row = i.parentElement.getBoundingClientRect();
      if (!inRect(row, e.clientX, e.clientY)) return;
      select(j);
      if (i.type === 'checkbox') { i.checked = !i.checked; commit(i); }
      else { dragging = i; setRange(i, e.clientX); }
    });
  }, { capture: true, passive: false }));
  window.addEventListener('pointermove', (e) => {
    if (dragging) { block(e); setRange(dragging, e.clientX); }
  }, { capture: true, passive: false });
  ['pointerup', 'mouseup', 'click', 'dblclick', 'wheel'].forEach((t) => window.addEventListener(t, (e) => {
    if (t === 'pointerup' && dragging) { dragging = null; block(e); return; }
    if (!isOpen()) return;
    if (inRect(panel().getBoundingClientRect(), e.clientX, e.clientY)) block(e);
  }, { capture: true, passive: false }));

  // Keyboard: up/down choose, left/right change, Enter/Space toggle, Esc closes.
  ['keydown', 'keyup', 'keypress'].forEach((t) => window.addEventListener(t, (e) => {
    if (!isOpen()) return;
    if (e.key === 'g' || e.key === 'G') return; // G still toggles the glow
    block(e);
    if (t !== 'keydown') return;
    const list = inputs(), i = list[sel];
    if (e.key === 'ArrowDown') select(sel + 1);
    else if (e.key === 'ArrowUp') select(sel - 1);
    else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && i.type === 'range') {
      const step = (+i.step || 1) * (e.key === 'ArrowLeft' ? -1 : 1);
      i.value = Math.max(+i.min, Math.min(+i.max, +i.value + step)); commit(i);
    } else if ((e.key === 'Enter' || e.key === ' ') && i.type === 'checkbox') { i.checked = !i.checked; commit(i); }
    else if (e.key === 'Escape' || e.key === 'Backspace') panel().classList.remove('open');
  }, { capture: true, passive: false }));

  // Highlight the first row whenever the panel opens.
  let was = false;
  setInterval(() => { const o = isOpen(); if (o && !was) select(0); was = o; }, 200);
})();
