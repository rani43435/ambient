// YouTube TV (youtube.com/tv) only runs on TVs: present this tab as a TV browser.
(() => {
  const UA = 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) 76.0.3809.146/6.0 TV Safari/537.36';
  const def = (k, v) => { try { Object.defineProperty(Navigator.prototype, k, { get: () => v, configurable: true }); } catch (e) {} };
  def('userAgent', UA);
  def('appVersion', UA.replace(/^Mozilla\//, ''));
  def('platform', 'Linux armv7l');
  def('userAgentData', undefined);
})();
