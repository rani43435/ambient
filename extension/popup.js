const DEF = { on: true, amount: 100, size: 80 };
chrome.storage.sync.get(DEF, (v) => {
  document.getElementById('on').checked = v.on;
  document.getElementById('amount').value = v.amount;
  document.getElementById('size').value = v.size;
});
document.getElementById('on').onchange = (e) => chrome.storage.sync.set({ on: e.target.checked });
document.getElementById('amount').oninput = (e) => chrome.storage.sync.set({ amount: +e.target.value });
document.getElementById('size').oninput = (e) => chrome.storage.sync.set({ size: +e.target.value });
document.getElementById('tv').onclick = () => { chrome.tabs.create({ url: 'https://www.youtube.com/tv' }); window.close(); };
