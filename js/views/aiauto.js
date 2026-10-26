/* Automatic AI reading: while the app is open, PDFs the AI has not finished are read one after another, each from where it stopped.
   It uses the same queue and red bar as reading a PDF by hand. It stops by itself when Gemini says the free limit is reached,
   and tries again the next time the app is opened. Switch: More > AI helper. */
(function () {
  const LU = window.LU;
  const PAUSE_KEY = 'levelup.aiAutoPause', PAUSE_MS = 6 * 3600e3, POLL_MS = 45000;
  const skip = new Set();          // PDFs that failed or that you stopped, left alone until the app is opened again
  let running = false, announced = false, netStop = false;

  const enabled = () => (LU.state.settings || {}).aiAuto !== false;
  const paused = () => { try { return +localStorage.getItem(PAUSE_KEY) > Date.now(); } catch (e) { return false; } };
  const setPause = () => { try { localStorage.setItem(PAUSE_KEY, String(Date.now() + PAUSE_MS)); } catch (e) {} };

  /* where reading should start for a PDF, or 0 when there is nothing left to read */
  const startPage = (d) => {
    if (!d.pages) return 0;
    const st = LU.aiStatus(d);
    if (st.k === 'full') return 0;
    if (d.cnext && d.cnext > 1 && d.cnext <= d.pages) return d.cnext;
    const R = (Array.isArray(d.aiR) ? d.aiR : []).slice().sort((a, b) => a[0] - b[0]);
    let p = 1; R.forEach((r) => { if (r[0] <= p && r[1] >= p) p = r[1] + 1; });
    return p <= d.pages ? p : 0;
  };
  LU.aiPending = () => LU.docs().filter((d) => startPage(d)).length;

  const pick = () => LU.docs().filter((d) => !skip.has(d.id) && startPage(d)).sort((a, b) => (b.opened || 0) - (a.opened || 0) || (a.added || 0) - (b.added || 0))[0];

  const runOne = (d) => new Promise((res) => {
    if ((!Array.isArray(d.aiR) || !d.aiR.length) && d.cnext && d.cnext > 1 && d.cnext <= d.pages) d.aiR = [[1, d.cnext - 1]];   /* a part-read PDF from before this was recorded */
    const from = startPage(d); LU._aiLast = null;
    if (!from || LU.bgBusy(d.id)) { res(); return; }
    LU.bgEnqueue(d.id, async () => { try { await LU.runCollect(d.id, from, d.pages, true, true); } finally { res(); } }, true);
  });

  const tick = async () => {
    if (running) return;
    if (!enabled() || !LU.aiKey || !LU.aiKey() || netStop || paused() || document.hidden || navigator.onLine === false) return;
    if (!LU.bgIdle || !LU.bgIdle() || !LU.runCollect || !LU.aiStatus) return;
    running = true;
    try {
      for (let n = 0; n < 200; n++) {
        if (!enabled() || paused() || document.hidden || navigator.onLine === false) break;
        const d = pick(); if (!d) break;
        if (!announced) { announced = true; LU.toast('AI is reading ' + LU.aiPending() + ' PDF' + (LU.aiPending() === 1 ? '' : 's') + ' in the background. You can keep using the app.', { ms: 4500, sys: false }); }
        await runOne(d);
        const r = LU._aiLast;
        if (!r) { skip.add(d.id); }
        else if (r.err) {
          if (r.err.code === 'limit') { setPause(); LU.toast('AI free limit reached. It will carry on later when you open the app.', { ms: 5000, sys: false }); break; }
          if (r.err.code === 'nokey') break;
          if (/internet|reach/i.test(r.err.message || '')) { netStop = true; break; }
          skip.add(d.id);
        } else if (r.stopped) skip.add(d.id);
        await new Promise((x) => setTimeout(x, 3000));
        if (!LU.bgIdle()) break;   /* you started something by hand: let it finish, the next check carries on */
      }
    } finally { running = false; }
  };

  /* the lists show the new status without you doing anything, but never while a sheet is open or the reader is on screen */
  LU.aiRefresh = () => {
    try { if (document.querySelector('.sheet') || (LU.readerOpen && LU.readerOpen())) return; if (document.querySelector('.dgrid')) LU.render(true); } catch (e) {}
  };

  const start = () => { setTimeout(tick, 6000); setInterval(tick, POLL_MS); document.addEventListener('visibilitychange', () => { if (!document.hidden) { netStop = false; setTimeout(tick, 2500); } }); window.addEventListener('online', () => { netStop = false; setTimeout(tick, 2500); }); };
  if (document.readyState === 'complete') start(); else window.addEventListener('load', start);

  /* the switch, at the bottom of More > AI helper */
  const baseRender = LU.views.ai && LU.views.ai.render;
  if (baseRender) LU.views.ai.render = function () {
    const on = enabled(), n = LU.aiPending ? LU.aiPending() : 0;
    return baseRender.apply(this, arguments) + `<div class="sec-title">Automatic reading</div>
      <div class="list"><div class="li" data-act="aiAutoToggle"><span class="lic">${LU.icon('loop')}</span><div class="grow"><div class="lt">Read my PDFs with AI by itself</div><div class="ls">${on ? 'On' : 'Off'} · ${n ? n + ' PDF' + (n === 1 ? '' : 's') + ' not finished' : 'every PDF is done'}. Works while the app is open and carries on from where it stopped.</div></div><b>${on ? 'ON' : 'OFF'}</b></div></div>`;
  };
  LU.actions.aiAutoToggle = () => {
    LU.state.settings.aiAuto = !enabled(); LU.save(true);
    if (enabled()) { announced = false; skip.clear(); netStop = false; try { localStorage.removeItem(PAUSE_KEY); } catch (e) {} setTimeout(tick, 800); }
    LU.render(false);
  };
})();
