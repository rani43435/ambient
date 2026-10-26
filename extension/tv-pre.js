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
