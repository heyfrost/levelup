/* Weekly review: a look back, one thing to fix, +50 XP when completed */
(function () {
  const LU = window.LU, esc = LU.esc, I = LU.icon;
  let wk = null;

  LU.weekStats = (w) => {
    const today = LU.todayKey(), days = [];
    for (let i = 0; i < 7; i++) { const k = LU.addDays(w, i); if (k <= today) days.push(k); }
    const st = { w, days: days.length, studyMin: LU.weekStudy(w), xp: 0, cleared: 0, done: 0, total: 0, miss: 0, topics: 0, steps: [], sleep: [], screen: [], best: null, worst: null, missKinds: {}, missed: [] };
    const lx = {}; (LU.state.log || []).forEach((e) => { const k = LU.keyOf(new Date(e.t - 3 * 3600e3)); lx[k] = (lx[k] || 0) + (e.xp || 0); });
    days.forEach((k) => {
      const d = LU.peekDay(k) || {}, p = LU.dayProgress(k);
      st.xp += d.xp != null ? d.xp : (lx[k] || 0);
      if (d.cleared) st.cleared++;
      st.done += p.done; st.total += p.n; st.topics += d.topics || 0;
      Object.keys(d.miss || {}).forEach((id) => { if (!(d.done || {})[id]) { const m = d.miss[id]; st.miss++; st.missKinds[m.kind] = (st.missKinds[m.kind] || 0) + 1; st.missed.push(Object.assign({ k }, m)); } });
      if (d.steps != null) st.steps.push(d.steps);
      const sl = LU.sleepOf(k); if (sl) st.sleep.push(sl.min);
      if (d.screenMin != null) st.screen.push(d.screenMin);
      if (p.n && (k < today || p.done)) { if (!st.best || p.pct > st.best.pct) st.best = { k, pct: p.pct }; if (!st.worst || p.pct < st.worst.pct) st.worst = { k, pct: p.pct }; }
    });
    st.boss = !!LU.state.boss[w];
    return st;
  };
  /* which week is waiting for a review right now (or null) */
  LU.reviewWeek = () => {
    const t = LU.todayKey(), w = LU.weekKey(t), pw = LU.addDays(w, -7), R = LU.state.reviews || {}, dow = LU.parseKey(t).getDay(), h = new Date().getHours();
    if (dow === 0 && (h >= 18 || h < 3) && !R[w]) return w;
    if (dow >= 1 && dow <= 3 && !R[pw] && LU.peekDay(pw)) return pw;
    return null;
  };
  const avg = (a) => (a.length ? a.reduce((p, c) => p + c, 0) / a.length : 0);

  LU.views.review = {
    render(params) {
      if (params && params.w) wk = params.w;
      const cur = LU.weekKey(LU.todayKey());
      wk = wk || LU.reviewWeek() || cur;
      const R = (LU.state.reviews || {})[wk], S = LU.weekStats(wk), hours = S.studyMin / 60, bossH = LU.state.settings.bossHours;
      const topKind = Object.keys(S.missKinds).sort((a, b) => S.missKinds[b] - S.missKinds[a])[0];
      const hint = !S.total ? 'Not enough data for this week yet.' : topKind ? `You missed the most in <b>${esc((LU.KINDS[topKind] || {}).name || topKind)}</b> (${S.missKinds[topKind]}). Protect that slot next week.` : S.cleared >= 5 ? 'Strong week. Keep the same routine and raise one target a little.' : S.worst ? `Your weakest day was <b>${LU.dayName(S.worst.k)}</b> (${Math.round(S.worst.pct * 100)}%). Plan it the night before.` : '';
      const row = (ic, label, val, sub) => `<div class="li"><span class="lic">${I(ic)}</span><div class="grow"><div class="lt">${label}</div>${sub ? `<div class="ls">${sub}</div>` : ''}</div><b class="num">${val}</b></div>`;
      return `<div class="topbar"><button class="iconbtn" data-act="back">${I('back')}</button><h1>Weekly review<span class="sub">${LU.niceDate(wk, false)} to ${LU.niceDate(LU.addDays(wk, 6), false)}</span></h1>
        <div class="daynav"><button class="iconbtn" data-act="rvWeek" data-d="-7" aria-label="Previous week">${I('left')}</button><button class="iconbtn" data-act="rvWeek" data-d="7" aria-label="Next week">${I('right')}</button></div></div>
      <section class="win ${S.boss ? 'gold' : 'red'}"><div class="win-in"><div class="win-h">WEEKLY BOSS</div>
        <div class="row"><div class="grow"><div style="font:700 18px var(--fd)">${S.boss ? 'Defeated' : 'Not defeated this week'}</div><div class="small muted">${LU.dur(S.studyMin)} studied of ${bossH}h</div></div><span class="bossic ${S.boss ? 'gold' : ''}">${I('sword')}</span></div>
        <div style="margin-top:12px">${LU.bar(Math.min(1, hours / bossH), S.boss ? 'gold' : 'red')}</div></div></section>
      <div class="list">
        ${row('quests', 'Quests done', `${S.done} / ${S.total}`, S.total ? Math.round((S.done / S.total) * 100) + '% of the week’s quests' : '')}
        ${row('flag', 'Days cleared', `${S.cleared} / ${S.days}`, 'Daily bonus reached')}
        ${row('x', 'Marked missed', S.miss, S.miss ? S.missed.slice(0, 3).map((m) => esc(m.t)).join(', ') + (S.miss > 3 ? '…' : '') : 'Nothing marked missed')}
        ${row('book', 'Topics finished', S.topics, 'Micro-topics ticked this week')}
        ${row('star', 'XP gained', LU.fmt(S.xp))}
        ${S.steps.length ? row('steps', 'Steps a day', LU.fmt(Math.round(avg(S.steps)))) : ''}
        ${S.sleep.length ? row('moon', 'Sleep a night', LU.dur(avg(S.sleep))) : ''}
        ${S.screen.length ? row('phone', 'Screen time a day', LU.dur(avg(S.screen))) : ''}
        ${S.best ? row('up', 'Best day', LU.dayName(S.best.k), Math.round(S.best.pct * 100) + '% done') : ''}
        ${S.worst && S.worst.k !== (S.best || {}).k ? row('down', 'Toughest day', LU.dayName(S.worst.k), Math.round(S.worst.pct * 100) + '% done') : ''}
      </div>
      ${hint ? `<div class="card small"><span class="pill gold" style="margin-bottom:6px">${I('info')}Read-out</span><div style="margin-top:6px">${hint}</div></div>` : ''}
      <div class="sec-title">One thing to fix next week</div>
      <div class="field"><textarea class="inp" id="rvNote" rows="3" maxlength="300" placeholder="e.g. Sleep by 11:30 so the 5:30 wake-up is easy">${esc((R && R.note) || '')}</textarea></div>
      ${R ? `<div class="card small muted">Review completed ${LU.niceDate(LU.keyOf(new Date(R.at - 3 * 3600e3)), false)}. You can still edit your note.</div><button class="btn ghost block" data-act="rvSave">Save note</button>`
        : `<button class="btn gold block" data-act="rvDone">${I('check')}Complete review · +50 XP</button>`}
      <div style="height:20px"></div>`;
    },
    mount() { },
  };
  LU.actions.rvWeek = (el) => { const cur = LU.weekKey(LU.todayKey()), n = LU.addDays(wk || cur, +el.dataset.d); if (n > cur || LU.diffDays(n, cur) > 120) return; wk = n; LU.render(false); };
  const note = () => { const e = LU.$('#rvNote'); return e ? e.value.trim() : ''; };
  LU.actions.rvDone = () => {
    const S = LU.weekStats(wk), R = LU.state.reviews = LU.state.reviews || {};
    R[wk] = { at: Date.now(), note: note(), study: S.studyMin, done: S.done, total: S.total, miss: S.miss, cleared: S.cleared };
    LU.gainXP(50); LU.log('Weekly review', 50); LU.save(); LU.sfx('clear'); LU.vibrate(30);
    LU.toast('Review saved. +50 XP'); LU.syncReminders && LU.syncReminders(true); LU.render();
  };
  LU.actions.rvSave = () => { const R = LU.state.reviews[wk]; if (R) { R.note = note(); LU.save(); LU.toast('Saved', { sys: false, ms: 1200 }); } };
  LU.actions.openReview = () => { wk = null; LU.push('review'); };
})();
