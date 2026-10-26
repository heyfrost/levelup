/* Part 28: the study timer follows the PDF you are reading.
   Opening a PDF starts (or resumes) the timer. It pauses when the screen goes off, you switch apps, or you stop touching the page for 5 minutes.
   Closing the PDF saves the time (and its XP) if the PDF started that timer. */
(function () {
  const LU = window.LU, IDLE = 5 * 60 * 1000;
  const S = () => LU.state, T = () => S().timer;
  const clock = (sec) => { sec = Math.max(0, Math.round(sec)); const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60, p = (n) => String(n).padStart(2, '0'); return (h ? h + ':' + p(m) : m) + ':' + p(s); };
  const live = () => LU.rd && LU.rd.R;
  const saved = (res) => { if (res && res.min > 0) LU.toast('Study timer saved: ' + LU.dur(res.min) + ' · +' + res.xp + ' XP', { ms: 4500 }); };

  LU.pdfTimerOpen = (R) => {
    if (!R || !R.d) return;
    const t = T();
    if (!t) { LU.timerStart(R.d.name || 'PDF', 'pdf'); }
    else if (t.paused) { LU.timerResume(); }
    S().timerAuto = null; R.ptIdle = false; R.lastAct = Date.now();
    LU.save(true);
  };
  LU.pdfTimerClose = (r) => {
    const t = T(); if (!t) return;
    if (t.src === 'pdf') { const res = LU.timerStop(t.paused || Date.now()); saved(res); if (LU.render) setTimeout(() => LU.render(true), 50); }
    else if (!t.paused) { LU.timerPause(); LU.toast('Timer paused. Resume it on the Status screen.', { ms: 3000 }); }
  };
  /* a timer the PDF started is saved when the app finds it left over (the app was closed while reading) */
  LU.pdfTimerSettle = () => {
    const t = T(); if (!t || t.src !== 'pdf' || !t.paused || live()) return;
    saved(LU.timerStop(t.paused)); if (LU.render) LU.render(true);
  };

  /* coming back to the app with the PDF open: carry on */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    const t = T();
    if (live() && t && t.paused) { LU.timerResume(); S().timerAuto = null; const R = live(); if (R) { R.ptIdle = false; R.lastAct = Date.now(); } }
    else setTimeout(LU.pdfTimerSettle, 2200);
  });
  setTimeout(LU.pdfTimerSettle, 2800);

  /* every 2 seconds: idle pause, activity resume, and the little clock in the reader */
  setInterval(() => {
    const R = live(), t = T(), c1 = document.getElementById('rdTime'), c2 = document.getElementById('rdTime2');
    if (!R || !t) { if (c1) c1.hidden = true; if (c2) c2.hidden = true; return; }
    if (!document.hidden) {
      if (!t.paused && Date.now() - (R.lastAct || 0) > IDLE) { LU.timerPause(R.lastAct); R.ptIdle = true; }
      else if (t.paused && R.ptIdle && Date.now() - (R.lastAct || 0) < 5000) { LU.timerResume(); R.ptIdle = false; }
    }
    const txt = (t.paused ? '\u23F8 ' : '') + clock(LU.timerElapsed() * 60);
    if (c1) { c1.textContent = txt; c1.hidden = false; }
    if (c2) { c2.textContent = ' · ' + txt; c2.hidden = false; }
  }, 2000);
})();
