// Ambient Video for YouTube: an Ambilight around YouTube's own player.
// Same colour method as index.html: read a thin strip along each edge of a
// 96x54 copy of the frame, average it into segments, boost it, ease it, and
// paint it into a 16x9 canvas stretched up behind the (slightly shrunk) video.
// It reads the <video> directly, so no screen sharing is needed.
(() => {
  const SW = 96, SH = 54, EDGE = 1, GW = 16, GH = 9, SPREAD = 1.8;
  const DEF = { on: true, amount: 100, size: 80 };
  let cfg = { ...DEF };

  const sc = document.createElement('canvas'); sc.width = SW; sc.height = SH;
  const s = sc.getContext('2d', { willReadFrequently: true });
  const glow = document.createElement('canvas'); glow.id = 'av-glow'; glow.width = GW; glow.height = GH;
  const g = glow.getContext('2d', { alpha: false });
  const out = g.createImageData(GW, GH);
  const cur = new Float32Array(GW * GH * 3);
  let player = null, video = null, last = 0, lastT = -1, blocked = false;

  // Average the edge strip into n segments along one side.
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
  // Make the colour livelier: more saturation, a bit brighter.
  function boost([r, gg, b]) {
    const l = 0.299 * r + 0.587 * gg + 0.114 * b;
    return [r, gg, b].map((v) => Math.max(0, Math.min(255, (l + (v - l) * 1.8) * 1.3)));
  }
  function sampleEdges() {
    s.drawImage(video, 0, 0, SW, SH);
    let px;
    try { px = s.getImageData(0, 0, SW, SH).data; }
    catch (e) { blocked = true; return; } // protected video: nothing we can read
    const top = strip(px, GW, 'top'), bottom = strip(px, GW, 'bottom');
    const left = strip(px, GH, 'left'), right = strip(px, GH, 'right');
    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) {
        // Each cell takes the colour of the nearest edge, so colour radiates outward.
        const dx = Math.min(x, GW - 1 - x) / (GW - 1), dy = Math.min(y, GH - 1 - y) / (GH - 1);
        let col = dx < dy ? (x < GW / 2 ? left[y] : right[y]) : (y < GH / 2 ? top[x] : bottom[x]);
        col = boost(col);
        const j = (y * GW + x) * 3, o = (y * GW + x) * 4;
        for (let c = 0; c < 3; c++) {
          cur[j + c] += (col[c] - cur[j + c]) * 0.35;
          out.data[o + c] = cur[j + c];
        }
        out.data[o + 3] = 255;
      }
    }
    g.putImageData(out, 0, 0);
  }

  // Keep the glow centred on the video and SPREAD times its size (the player clips the rest).
  function place() {
    const p = player.getBoundingClientRect(), v = video.getBoundingClientRect();
    if (!v.width || !v.height) return;
    const w = v.width * SPREAD, h = v.height * SPREAD;
    glow.style.width = w + 'px'; glow.style.height = h + 'px';
    glow.style.transform = `translate(${v.left - p.left + v.width / 2 - w / 2}px, ${v.top - p.top + v.height / 2 - h / 2}px)`;
  }

  function apply() {
    if (!player) return;
    player.classList.toggle('av-on', !!cfg.on);
    player.style.setProperty('--av-scale', cfg.size / 100);
    glow.style.opacity = cfg.amount / 100;
    lastT = -1;
    syncPanel();
  }

  // ~12 updates a second is plenty for a glow and keeps the device cool.
  function paint(now) {
    requestAnimationFrame(paint);
    if (!cfg.on || !player || !video || !player.isConnected || now - last < 80) return;
    if (video.readyState < 2 || !video.videoWidth) return;
    place();
    // While paused only redraw when the frame changed (e.g. after seeking).
    if (video.paused && video.currentTime === lastT) return;
    lastT = video.currentTime; last = now;
    blocked = false;
    sampleEdges();
  }
  requestAnimationFrame(paint);

  // ---- UI: a button in YouTube's control bar opens a small panel (works in full screen) ----
  const btn = document.createElement('button');
  btn.className = 'ytp-button av-btn'; btn.title = 'Ambient glow (G)'; btn.setAttribute('aria-label', 'Ambient glow');
  // Built with createElement: YouTube enforces Trusted Types, so innerHTML would throw.
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, ns) => { const n = ns ? document.createElementNS(ns, tag) : document.createElement(tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };
  const svg = el('svg', { viewBox: '0 0 24 24' }, NS);
  svg.append(el('rect', { x: 7, y: 8, width: 10, height: 8, rx: 1.5 }, NS),
    el('path', { d: 'M3 12h1.5M19.5 12H21M12 3v1.5M12 19.5V21M5.6 5.6l1 1M17.4 17.4l1 1M18.4 5.6l-1 1M6.6 17.4l-1 1' }, NS));
  btn.append(svg);
  const panel = el('div', { id: 'av-panel' });
  const row = (text, input) => { const l = el('label'); l.append(text + ' ', input); return l; };
  panel.append(
    row('Ambient glow', el('input', { type: 'checkbox', 'data-k': 'on' })),
    row('Strength', el('input', { type: 'range', min: 0, max: 100, 'data-k': 'amount' })),
    row('Video size', el('input', { type: 'range', min: 50, max: 100, 'data-k': 'size' })));
  btn.addEventListener('click', (e) => { e.stopPropagation(); panel.classList.toggle('open'); });
  ['click', 'mousedown', 'keydown', 'dblclick'].forEach((ev) => panel.addEventListener(ev, (e) => e.stopPropagation()));
  panel.addEventListener('input', (e) => {
    const k = e.target.dataset.k; if (!k) return;
    save({ [k]: k === 'on' ? e.target.checked : +e.target.value });
  });
  document.addEventListener('click', (e) => { if (!panel.contains(e.target) && e.target !== btn) panel.classList.remove('open'); }, true);
  function syncPanel() {
    panel.querySelectorAll('input').forEach((i) => {
      const k = i.dataset.k; if (i === document.activeElement && i.type === 'range') return;
      if (i.type === 'checkbox') i.checked = !!cfg[k]; else i.value = cfg[k];
    });
  }

  // G toggles the glow (ignored while typing).
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'g' && e.key !== 'G') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    save({ on: !cfg.on });
  }, true);

  // ---- Settings (shared with the toolbar popup) ----
  function save(part) { cfg = { ...cfg, ...part }; apply(); try { chrome.storage.sync.set(part); } catch (e) {} }
  try {
    chrome.storage.sync.get(DEF, (v) => { cfg = { ...DEF, ...v }; apply(); });
    chrome.storage.onChanged.addListener((ch) => {
      for (const k in ch) if (k in DEF) cfg[k] = ch[k].newValue;
      apply();
    });
  } catch (e) {}

  // ---- Attach to the player (YouTube swaps pages and sometimes the <video> without reloading) ----
  function attach() {
    const p = document.getElementById('movie_player');
    const v = p && p.querySelector('video.html5-main-video, video');
    if (!p || !v) return;
    if (p !== player) {
      if (player) player.classList.remove('av-on');
      player = p;
    }
    if (glow.parentNode !== p) p.insertBefore(glow, p.firstChild); // under the video layer
    if (v !== video) { video = v; cur.fill(0); lastT = -1; v.addEventListener('seeked', () => (lastT = -1)); }
    const rc = p.querySelector('.ytp-right-controls');
    if (rc && btn.parentNode !== rc) rc.insertBefore(btn, rc.firstChild);
    if (panel.parentNode !== p) p.appendChild(panel);
    apply();
  }
  attach();
  setInterval(attach, 1000);
  document.addEventListener('yt-navigate-finish', attach);
  document.addEventListener('fullscreenchange', () => { lastT = -1; });
})();
