/* Part 17: runs in a normal browser too (iPad Safari, home-screen web app). Everything here is skipped inside the Android app. */
(function () {
  const LU = window.LU, root = document.documentElement;
  LU.ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  LU.standalone = !!(window.navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches));
  if (LU.ios) root.setAttribute('data-plat', 'ios');
  if (window.Android) return;                       /* Android app: nothing else to do */
  /* offline copy of the app, so it opens with no internet after the first visit */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }
  /* ask the browser to keep our data (PDFs, marks) instead of clearing it when space runs low */
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().then((ok) => { LU.persisted = ok; }).catch(() => {}); } catch (e) {}
})();
