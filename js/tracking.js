/* Part 3: tracking (steps, sleep, screen time), reminders, widget data. Talks to Android through window.Android. */
(function () {
  const LU = window.LU, A = window.Android;
  const DAY_H = 3;
  const dayStart = (k) => LU.parseKey(k).getTime() + DAY_H * 3600e3;

  LU.trk = () => Object.assign({ steps: true, sleep: true, screen: true, goal: 8000 }, LU.state.settings.track || {});
  LU.ncfg = () => {
    const n = LU.state.settings.notif || {};
    return Object.assign({ on: true, lead: 5, plan: '22:00', review: '20:30', money: '21:30', custom: [] }, n, { kinds: Object.assign({ wake: true, workout: true, hygiene: false, study: true, meal: true, office: true, night: true, money: false }, n.kinds || {}) });
  };

  /* ---------- permissions ---------- */
  LU.perms = () => {
    const o = { notif: true, activity: false, usage: false, exact: true, sensor: false, sdk: 0 };
    if (!A || !A.perms) return o;
    try { String(A.perms()).split(',').forEach((p) => { const [k, v] = p.split('='); o[k] = k === 'sdk' ? +v : v === '1'; }); } catch (e) {}
    return o;
  };

  /* reminder health check from the phone (needs the installed app) */
  LU.diag = () => {
    const o = { armed: 0, next: 0, last: 0, batt: true, mi: false, synced: 0 };
    if (!A || !A.diag) return null;
    try { String(A.diag()).split(',').forEach((p) => { const [k, v] = p.split('='); if (k === 'batt') o.batt = v === '1'; else if (k === 'mi') o.mi = v === '1'; else o[k] = +v || 0; }); } catch (e) {}
    return o;
  };

  /* ---------- steps ---------- */
  const readSamples = () => {
    if (!A || !A.getSteps) return [];
    const out = [];
    String(A.getSteps() || '').split(';').forEach((p) => { const [t, v] = p.split(',').map(Number); if (t && !isNaN(v)) out.push([t, v]); });
    return out.sort((a, b) => a[0] - b[0]);
  };
  /* steps per day key, from hourly samples of the phone's counter (it resets on reboot) */
  LU.stepsByDay = (samples) => {
    samples = samples || readSamples();
    const res = {};
    for (let i = 1; i < samples.length; i++) {
      const [t1, v1] = samples[i - 1], [t2, v2] = samples[i];
      const delta = v2 >= v1 ? v2 - v1 : v2; // counter went down = phone restarted
      if (delta <= 0 || t2 <= t1 || t2 - t1 > 36 * 3600e3) continue;
      let a = t1;
      while (a < t2) {
        const k = LU.keyOf(new Date(a - DAY_H * 3600e3)), end = Math.min(t2, dayStart(LU.addDays(k, 1)));
        res[k] = (res[k] || 0) + delta * ((end - a) / (t2 - t1));
        a = end;
      }
    }
    Object.keys(res).forEach((k) => (res[k] = Math.round(res[k])));
    return res;
  };

  /* ---------- pull everything from the phone into the day records ---------- */
  LU.syncSensors = () => {
    if (!A) return false;
    const s = LU.state, t = LU.trk(), today = LU.todayKey(), pm = LU.perms();
    let changed = false;
    if (t.steps && pm.sensor && pm.activity) {
      const by = LU.stepsByDay();
      Object.keys(by).forEach((k) => { if (LU.diffDays(k, today) <= 30 && LU.diffDays(k, today) >= 0) { const d = LU.day(k); if (d.steps !== by[k]) { d.steps = by[k]; changed = true; } } });
      const d = LU.day(today);
      if ((d.steps || 0) >= t.goal && !d.stepsClaimed) {
        d.stepsClaimed = true; LU.gainXP(20); LU.state.stats.hlt = (LU.state.stats.hlt || 0) + 1;
        LU.log('Step goal reached: ' + LU.fmt(d.steps), 20); changed = true;
        LU.toast(`Step goal reached: ${LU.fmt(d.steps)} steps. +20 XP`);
      }
    }
    if (pm.usage && A.sleepEstimate && A.screenMinutes) {
      [today, LU.addDays(today, -1)].forEach((k) => {
        const d = LU.day(k), ds = dayStart(k), now = Date.now();
        if (t.sleep) {
          const from = ds - 7 * 3600e3, to = Math.min(now, ds + 11 * 3600e3);
          if (now > ds + 3 * 3600e3) {
            try {
              const r = String(A.sleepEstimate(from, to) || '');
              if (r) { const [a, b] = r.split(',').map(Number); const min = Math.round((b - a) / 60000); if (!d.autoSleep || d.autoSleep.s !== a || d.autoSleep.e !== b) { d.autoSleep = { s: a, e: b, min }; changed = true; } }
            } catch (e) {}
          }
        }
        if (t.screen) {
          try { const m = A.screenMinutes(ds, Math.min(now, dayStart(LU.addDays(k, 1)))); if (m >= 0 && d.screenMin !== m) { d.screenMin = m; changed = true; } } catch (e) {}
        }
      });
    }
    if (changed) LU.save();
    return changed;
  };
  const busy = () => document.querySelector('.sheet, .ov, .reader, .dedit, .dlock') || (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName));
  window.LU_sensors = () => { if (!LU.state) return; LU.syncSensors(); if (!busy()) LU.render(); };
  window.LU_perm = () => { LU.syncReminders(true); LU.syncSensors(); LU.render(); };
  LU.sampleNow = () => { try { A && A.sampleNow && A.sampleNow(); } catch (e) {} };

  /* what to show on Status: today's numbers */
  LU.sleepOf = (k) => {
    const d = LU.peekDay(k) || {}, y = LU.peekDay(LU.addDays(k, -1)) || {};
    if (y.slept && d.woke) { let m = LU.toMin(d.woke) - LU.toMin(y.slept); if (m <= 0) m += 1440; if (m > 0 && m < 900) return { min: m, auto: false }; }
    if (d.autoSleep) return { min: d.autoSleep.min, auto: true };
    return null;
  };

  /* ---------- reminders ---------- */
  const GROUP = { wake: 'wake', workout: 'workout', hygiene: 'hygiene', meal: 'meal', office: 'office', routine: 'office', plan: 'night', sleep: 'night' };
  LU.reminderGroup = (kind) => GROUP[kind] || (LU.KINDS[kind] && LU.KINDS[kind].study ? 'study' : null);
  const at = (k, min) => LU.parseKey(k).getTime() + min * 60000;
  LU.buildReminders = () => {
    const c = LU.ncfg(), out = [], now = Date.now(), today = LU.todayKey();
    if (!c.on) return out;
    for (let i = 0; i < 5; i++) {
      const k = LU.addDays(today, i), d = LU.peekDay(k) || { done: {}, tasks: [] };
      LU.questsFor(k).forEach((q) => {
        if (q.src !== 'block' || q.info || q.skipped || q.done) return;
        const g = LU.reminderGroup(q.kind);
        if (!g || !c.kinds[g]) return;
        const lead = q.kind === 'wake' ? 0 : c.lead;
        out.push({ at: at(k, LU.toMin(q.start) - lead), title: q.title, text: `${LU.t12(q.start)}${q.sub ? ' · ' + q.sub : ''}` });
      });
      (d.tasks || []).forEach((t) => { if (t.time && !(d.done || {})[t.id]) out.push({ at: at(k, LU.toMin(t.time)), title: t.title, text: 'Your planned task' }); });
      (c.custom || []).forEach((r) => {
        if (!r.on && r.on !== undefined) return;
        const wd = LU.parseKey(k).getDay();
        if (r.days && r.days.length && !r.days.includes(wd)) return;
        out.push({ at: at(k, LU.toMin(r.time)), title: r.title, text: 'Reminder' });
      });
      if (c.kinds.night && c.plan) {
        const nk = LU.addDays(k, 1), nd = LU.peekDay(nk);
        if (!nd || !(nd.tasks || []).length) out.push({ at: at(k, LU.toMin(c.plan)), title: 'Plan tomorrow', text: 'Write tomorrow’s tasks so the morning starts clean.' });
      }
      if (c.kinds.money && c.money && !(LU.moneyOn && LU.moneyOn(k).length)) out.push({ at: at(k, LU.toMin(c.money)), title: 'Log today’s spending', text: 'Add your daily necessities and extra in Money.' });
      if (c.review && LU.parseKey(k).getDay() === 0 && !((LU.state.reviews || {})[LU.weekKey(k)])) out.push({ at: at(k, LU.toMin(c.review)), title: 'Weekly review is ready', text: 'See your week and set one fix for the next.' });
    }
    const tr = LU.state.testRem;
    if (tr && tr > now) out.push({ at: tr, title: 'LevelUp test reminder', text: 'This one came from a scheduled alarm. Your reminders work.' }); else if (tr) delete LU.state.testRem;
    return out.filter((r) => r.at > now + 3000).sort((a, b) => a.at - b.at).slice(0, 120);
  };
  const clean = (s) => String(s).replace(/[|\n\r]+/g, ' ').trim();
  let lastRem = '';
  LU.syncReminders = (force) => {
    if (!A || !A.setReminders) return;
    const lines = LU.buildReminders().map((r, i) => `${i + 1}|${r.at}|${clean(r.title)}|${clean(r.text)}`).join('\n');
    if (!force && lines === lastRem) return;
    lastRem = lines;
    try { A.setReminders(lines); } catch (e) {}
  };
  LU.testNotify = () => { try { A && A.testNotify && A.testNotify('LevelUp reminder', 'This is how your reminders will look.'); } catch (e) {} };

  /* ---------- widget ---------- */
  /* quests ticked on the home-screen widget while the app was closed are completed now, with the time they were tapped */
  LU.applyWidgetTicks = () => {
    if (!A || !A.takeTicks) return 0;
    let n = 0, txt = '';
    try { txt = String(A.takeTicks() || ''); } catch (e) {}
    txt.split('\n').forEach((line) => {
      const [k, id, ts, kind] = line.split('|'); if (!k || !id) return;
      const q = LU.questsFor(k).find((x) => x.id === id);
      if (!q || q.done) return;
      if (kind === 'x') { if (!q.missed) { try { LU.toggleMiss(k, q); n++; } catch (e) { console.error(e); } } return; }
      LU._at = +ts || 0;
      try { LU.complete(k, q); n++; } catch (e) { console.error(e); }
      LU._at = 0;
    });
    if (n) { LU.save(); lastW = ''; LU.pushWidget(); LU.toast(n + ' quest' + (n > 1 ? 's' : '') + ' updated from the widget.', { sys: false }); LU.render(); }
    return n;
  };
  let lastW = '';
  LU.pushWidget = () => {
    if (!A || !A.setWidget) return;
    const s = LU.state, k = LU.todayKey(), L = LU.levelInfo();
    const lines = ['k=' + k, 'name=' + clean(s.settings.name), 'level=' + L.level, 'rank=' + L.rank.r, 'pct=' + Math.round(LU.dayProgress(k).pct * 100), 'streak=' + LU.streak(), 'days=' + Math.max(0, LU.daysToExam())];
    if (s.settings.examDate) lines.push('exam=' + s.settings.examDate, 'examname=' + clean(LU.niceDate(s.settings.examDate, false)));
    if (LU.theme) { const w = LU.theme.widgetTheme(); lines.push('wt=' + w.mode, 'wbg=' + w.bg, 'wtx=' + w.tx, 'wmu=' + w.mu, 'wac=' + w.ac, 'wgd=' + w.gd); }
    LU.questsFor(k).forEach((q) => { if (q.src === 'block' && !q.info && !q.skipped) { const st = LU.toMin(q.start); lines.push(`q=${st}|${st + q.min}|${q.done ? 1 : 0}|${clean(q.id)}|${clean(q.title)}`); } });
    const txt = lines.join('\n');
    if (txt === lastW) return;
    lastW = txt;
    try { A.setWidget(txt); } catch (e) {}
  };

  /* ---------- run after every save (debounced) ---------- */
  let t1;
  LU.afterSave = () => {
    clearTimeout(t1);
    t1 = setTimeout(() => {
      try { LU.pushWidget(); LU.syncReminders(); if (LU.checkAch) LU.checkAch(); } catch (e) { console.error(e); }
    }, 1500);
  };
  LU.startTracking = () => {
    if (A && A.setTracking) { try { A.setTracking(!!LU.trk().steps); } catch (e) {} }
    LU.syncSensors(); LU.syncReminders(true); LU.pushWidget();
    LU.sampleNow();
  };
})();
