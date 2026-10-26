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
