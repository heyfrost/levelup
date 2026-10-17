/* Boot */
(function () {
  const LU = window.LU;

  LU.updateBadges = () => {
    const btn = LU.$('nav.tabs button[data-tab="quests"]'); if (!btn) return;
    const k = LU.todayKey(), n = LU.nowMin();
    const due = LU.questsFor(k).filter((q) => q.src === 'block' && !q.info && !q.done && !q.skipped && LU.toMin(q.start) <= n).length;
    let b = btn.querySelector('.badge');
    if (due) { if (!b) { b = document.createElement('span'); b.className = 'badge'; btn.appendChild(b); } b.textContent = due; }
    else if (b) b.remove();
  };

  const autoBackup = () => {
    const s = LU.state, k = LU.todayKey();
    if (!LU.native || s.autoBackupOn === k) return;
    LU.exportAll().then((txt) => {
      try {
        const r = window.Android.saveText('LevelUp-autobackup.json', txt);
        if (r && String(r).indexOf('Error') !== 0) { s.autoBackupOn = k; s.autoBackupAt = Date.now(); }
        /* one extra copy per week, rotating over 4 files, so a bad day never overwrites everything */
        const wk = LU.weekKey(k);
        if (s.autoBackupWeek !== wk) {
          const slot = (Math.floor(LU.parseKey(wk).getTime() / 6048e5) % 4) + 1;
          const r2 = window.Android.saveText('LevelUp-weekly-' + slot + '.json', txt);
          if (r2 && String(r2).indexOf('Error') !== 0) s.autoBackupWeek = wk;
        }
        LU.save();
      } catch (e) {}
    });
  };

  const busy = () => document.querySelector('.sheet, .ov, .reader, .dedit, .dlock') || (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName));

  const maybeMorning = () => {
    const s = LU.state, d = LU.day(LU.todayKey()), h = new Date().getHours();
    if (s.settings.morning && !d.morning && h >= 3 && h < 13) { LU.showMorning(false); }
  };

  const boot = () => {
    LU.load(); LU.migrate(); LU.indexSyllabus(); LU.rollover(); if (LU.theme) LU.theme.boot();
    if (LU.appLockBoot) LU.appLockBoot();
    LU.shell(); LU.render(false);
    maybeMorning();
    setTimeout(autoBackup, 4000);
    setTimeout(() => LU.applyWidgetTicks && LU.applyWidgetTicks(), 700);
    /* ask for notification permission once on first launch (Android 13+ never shows reminders until allowed) */
    setTimeout(() => { try { const A = window.Android; if (A && A.askNotif && !LU.perms().notif && !LU.state.settings.askedNotif) { LU.state.settings.askedNotif = true; LU.save(); A.askNotif(); } } catch (e) {} }, 2500);
    setTimeout(() => { LU.startTracking && LU.startTracking(); LU.checkAch && LU.checkAch(); }, 900);
    setTimeout(() => LU.checkIncoming && LU.checkIncoming(), 600);
    let lastMin = LU.nowMin();
    setInterval(() => {
      if (LU.state.processed !== LU.todayKey()) { LU.rollover(); LU.questsGoToday(); if (!busy()) LU.render(); maybeMorning(); return; }
      const m = LU.nowMin();
      if (m !== lastMin) { lastMin = m; if (!busy() && LU.currentTab() !== 'study' && !LU.top()) LU.render(); else LU.updateBadges(); }
    }, 15000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { if (LU.state.processed !== LU.todayKey()) { LU.rollover(); LU.questsGoToday(); } if (!busy()) LU.render(); maybeMorning(); } });
  };
  // called by Android when the app returns to the foreground
  window.LU_resume = () => { if (LU.applyWidgetTicks) LU.applyWidgetTicks(); if (LU.appLockWake) LU.appLockWake(); if (LU.focusCheck) LU.focusCheck(); if (LU.syncSensors) { LU.syncSensors(); LU.syncReminders(true); LU.pushWidget(); } if (!busy()) LU.render(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();


/* Keyboard fix: a field focused by code (not by a finger) can be left "focused" without the keyboard.
   Tapping it again then does nothing. So the first real tap on such a field blurs and refocuses it,
   which makes Android open the keyboard. */
(function () {
  let lastTouch = 0;
  const isField = (e) => e && e.tagName && (e.tagName === 'TEXTAREA' || (e.tagName === 'INPUT' && !/^(checkbox|radio|button|file|range|color|submit)$/.test(e.type)));
  let downEl = null;
  document.addEventListener('pointerdown', (e) => { downEl = e.target; lastTouch = Date.now(); }, true);
  document.addEventListener('touchstart', (e) => { downEl = e.target; lastTouch = Date.now(); }, true);
  /* focus that did not come from a finger on that very field = focus set by code */
  document.addEventListener('focusin', (e) => { if (isField(e.target) && !(downEl && (downEl === e.target || (downEl.closest && downEl.closest('label') && downEl.closest('label').contains(e.target))))) e.target._pf = true; }, true);
  document.addEventListener('focusout', (e) => { if (e.target) e.target._pf = false; }, true);
  const fix = (e) => {
    const t = e.target;
    if (isField(t) && t._pf && document.activeElement === t) {
      t._pf = false;
      const a = t.selectionStart, b = t.selectionEnd;
      t.blur(); t.focus();
      try { t.setSelectionRange(a, b); } catch (x) {}
    }
  };
  document.addEventListener('click', fix, true);
  /* also ask the phone to show the keyboard when code focuses a field */
  LU.focusField = (el) => { if (!el) return; el.focus(); if (window.Android && Android.showKeyboard) { try { Android.showKeyboard(); } catch (x) {} } };
})();
