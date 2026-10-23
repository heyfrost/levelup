/* Part 27: collecting points and MCQs from a PDF runs in the background.
   A red bar shows on the PDF card in Notes and at the top of the reader. One PDF at a time, the rest wait in a queue. */
(function () {
  const LU = window.LU, esc = LU.esc;
  const Q = []; let cur = null;

  LU.keepAwake = (on) => {
    try { if (window.Android && Android.keepOn) Android.keepOn(!!on); } catch (e) {}
    try {
      if (on && navigator.wakeLock && !LU._wl) navigator.wakeLock.request('screen').then((l) => { LU._wl = l; l.addEventListener('release', () => { LU._wl = null; }); }).catch(() => {});
      if (!on && LU._wl) { LU._wl.release().catch(() => {}); LU._wl = null; }
    } catch (e) {}
  };

  /* the bar itself: always in the page, shown only while that PDF is being read or waiting */
  LU.bgHtml = (docId, kind) => `<div class="bgb ${kind || 'card'}" data-bg="${docId}" hidden><div class="bgt"><span class="bgm"></span><button class="bgx" data-act="bgStop" data-id="${docId}">Stop</button></div><div class="bgbar"><i></i></div></div>`;

  const paint = () => {
    document.querySelectorAll('[data-bg]').forEach((el) => {
      const id = el.dataset.bg, run = cur && cur.id === id, wait = Q.findIndex((x) => x.id === id);
      if (!run && wait < 0) { el.hidden = true; return; }
      el.hidden = false;
      const m = el.querySelector('.bgm'), b = el.querySelector('.bgbar i');
      if (run) { const p = Math.max(0, Math.min(100, Math.round(cur.pct || 0))); if (b) b.style.width = p + '%'; if (m) m.textContent = p + '% · ' + (cur.msg || 'Reading…'); el.classList.remove('wait'); }
      else { if (b) b.style.width = '0%'; if (m) m.textContent = 'Waiting in the queue (' + (wait + 1) + ')'; el.classList.add('wait'); }
    });
  };
  LU.bgPaint = paint;
  LU.bgIdle = () => !cur && !Q.length;
  LU.bgBusy = (docId) => !!((cur && cur.id === docId) || Q.some((x) => x.id === docId));

  const next = async () => {
    const j = Q.shift();
    if (!j) { cur = null; LU.keepAwake(false); paint(); return; }
    cur = j; j.pct = 0; j.msg = 'Starting…'; j.stop = false;
    LU.keepAwake(true); paint();
    try { await j.fn(); } catch (e) { console.error(e); LU.toast('Collecting stopped: ' + (e && e.message || e), { ms: 4000 }); }
    cur = null; paint(); next();
  };
  LU.bgEnqueue = (docId, fn, silent) => {
    if (LU.bgBusy(docId)) { if (!silent) LU.toast('This PDF is already being read.'); return; }
    Q.push({ id: docId, fn });
    if (cur) { if (!silent) LU.toast('Added to the queue. It starts after the one running now.', { ms: 3000 }); }
    else { if (!silent) LU.toast('Reading in the background. You can keep using the app.', { ms: 3500 }); next(); }
    paint();
  };
  /* same shape as the old progress sheet, but nothing covers the screen */
  LU.bgProg = (docId) => {
    const j = cur && cur.id === docId ? cur : null;
    return {
      set(i, msg) { if (!j) return; j.pct = i; if (msg) j.msg = msg; paint(); },
      get stopped() { return !!(j && j.stop); },
      close() { },
    };
  };
  LU.actions.bgStop = (el) => {
    const id = el.dataset.id;
    if (cur && cur.id === id) { cur.stop = true; cur.msg = 'Stopping…'; paint(); LU.toast('Stopping. What was found is kept.', { ms: 2500 }); return; }
    const i = Q.findIndex((x) => x.id === id); if (i >= 0) { Q.splice(i, 1); paint(); }
  };
  /* bars are painted again whenever a screen is drawn */
  let raf = 0;
  const watch = () => {
    const root = document.getElementById('app') || document.body;
    new MutationObserver((ms) => { if (!cur && !Q.length) return; if (raf) return; if (!ms.some((m) => [...m.addedNodes].some((n) => n.nodeType === 1 && (n.matches && n.matches('[data-bg]') || n.querySelector && n.querySelector('[data-bg]'))))) return; raf = requestAnimationFrame(() => { raf = 0; try { paint(); } catch (e) {} }); }).observe(root, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
})();
