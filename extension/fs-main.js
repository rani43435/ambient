// Ambient Video (page world): if a site puts only the <video> in full screen, the glow
// (its sibling) would be hidden, so put the video's player box in full screen instead.
// Only while the glow is on (anysite.js sets data-av-on on <html>).
(() => {
  const on = () => document.documentElement.dataset.avOn === '1';
  for (const name of ['requestFullscreen', 'webkitRequestFullscreen']) {
    const real = Element.prototype[name];
    if (!real) continue;
    Element.prototype[name] = function (...a) {
      const t = this instanceof HTMLVideoElement && on() && this.parentElement ? this.parentElement : this;
      return real.apply(t, a);
    };
  }
})();
