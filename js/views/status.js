/* Status (home) + morning screen */
(function () {
  const LU = window.LU, esc = LU.esc, I = LU.icon;

  const nowQuest = () => {
    const k = LU.todayKey(), n = LU.nowMin();
    const qs = LU.questsFor(k).filter((q) => q.src === 'block' && !q.skipped);
    const timed = qs.filter((q) => q.kind !== 'office');
    let cur = timed.find((q) => !q.done && n >= LU.toMin(q.start) && n < LU.toMin(q.start) + q.min);
    const office = qs.find((q) => q.kind === 'office' && n >= LU.toMin(q.start) && n < LU.toMin(q.start) + q.min);
    if (!cur && !office) cur = timed.find((q) => !q.done && LU.toMin(q.start) + q.min <= n); // overdue
    const next = timed.find((q) => !q.done && LU.toMin(q.start) > n && q !== cur);
    return { cur, next, office };
  };

  const timerCard = () => {
    const t = LU.state.timer, run = !!t, paused = !!(t && t.paused), office = run ? t.office : LU.inOffice();
    const label = office ? 'Office study' : 'Extra study';
    const sub = paused ? 'Paused. Tap Resume to carry on.' : run ? 'Running. Pause if you step away, Stop when you finish.' : office ? 'Read notes or current affairs in office gaps. 1.5× XP.' : 'Studied outside the plan? Time it here.';
    return `<div class="card"><div class="timer ${run ? 'run' : ''}">
      <div class="grow"><div class="small muted">${label}</div><div class="t num" id="timerT">${run ? clock(LU.timerElapsed()) : '0:00:00'}</div><div class="tiny dim" style="margin-top:4px">${sub}</div></div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:stretch">${run ? `<button class="btn ghost sm" data-act="timerPause">${I(paused ? 'play' : 'pause')}${paused ? 'Resume' : 'Pause'}</button><div style="display:flex;gap:6px"><button class="btn gold sm" data-act="timer" style="flex:1">${I('stop')}Stop</button><button class="btn ghost sm" data-act="timerReset" aria-label="Reset the timer">${I('reset')}</button></div>` : `<button class="btn ghost sm" data-act="timer">${I('play')}Start</button>`}</div></div></div>`;
  };
  const clock = (min) => { const s = Math.floor(min * 60); return `${Math.floor(s / 3600)}:${LU.pad(Math.floor((s % 3600) / 60))}:${LU.pad(s % 60)}`; };

  const reviewCard = () => {
    const w = LU.reviewWeek && LU.reviewWeek(); if (!w) return '';
    return `<div class="card tap" data-act="openReviewWeek" data-w="${w}" style="border-color:rgba(245,196,81,.5)"><div class="row"><span class="bossic gold">${I('review')}</span><div class="grow"><b>Weekly review is ready</b><div class="small muted">Look back at ${w === LU.weekKey(LU.todayKey()) ? 'this week' : 'last week'} and set one fix. +50 XP.</div></div><span class="chev">${I('chev')}</span></div></div>`;
  };
  const trackCard = (d) => {
    if (!LU.native) return '';
    const t = LU.trk(), p = LU.perms(), cells = [];
    if (t.steps && p.sensor && p.activity) cells.push(['steps', d.steps != null ? LU.fmt(d.steps) : '–', 'Steps']);
    if (t.screen && p.usage) cells.push(['phone', d.screenMin != null ? LU.dur(d.screenMin) : '–', 'Screen']);
    if (t.sleep && p.usage) { const sl = LU.sleepOf(LU.todayKey()); cells.push(['moon', sl ? LU.dur(sl.min) : '–', 'Sleep']); }
    if (!cells.length) return `<div class="card tap" data-act="openTrack"><div class="row"><span class="lic">${I('steps')}</span><div class="grow"><b>Track steps and sleep automatically</b><div class="small muted">Takes a minute to switch on. Nothing to type.</div></div><span class="chev">${I('chev')}</span></div></div>`;
    return `<div class="card tap" data-act="openTrack"><div class="trk">${cells.map(([ic, v, l]) => `<div><span class="ti">${I(ic)}</span><b class="num">${v}</b><small>${l}</small></div>`).join('')}</div>${t.steps && p.activity && p.sensor && d.steps != null ? `<div style="margin-top:10px">${LU.bar(d.steps / t.goal, 'thin')}</div><div class="tiny dim" style="margin-top:4px">Goal ${LU.fmt(t.goal)} steps</div>` : ''}</div>`;
  };
  LU.actions.openTrack = () => LU.push('track');
  LU.actions.openReviewWeek = (el) => LU.push('review', { w: el.dataset.w });

  /* live countdown to the first paper */
  LU.examAt = () => { const st = LU.state.settings, [y, m, d] = st.examDate.split('-').map(Number), [h, mi] = (st.examTime || '09:30').split(':').map(Number); return new Date(y, m - 1, d, h, mi, 0).getTime(); };
  const cdParts = () => { let ms = LU.examAt() - Date.now(); if (ms < 0) ms = 0; const t = Math.floor(ms / 1000); return { d: Math.floor(t / 86400), h: Math.floor((t % 86400) / 3600), m: Math.floor((t % 3600) / 60), s: t % 60, over: ms === 0 }; };
  const cdHtml = () => { const c = cdParts(); if (c.over) return '<div class="cdover">Exam day has arrived. Give it everything.</div>'; return [[c.d, 'days'], [c.h, 'hours'], [c.m, 'min'], [c.s, 'sec']].map(([v, l], i) => `<div><b class="num" data-cd="${i}">${i ? LU.pad(v) : v}</b><span>${l}</span></div>`).join(''); };

  LU.views.status = {
    render() {
      const s = LU.state, k = LU.todayKey(), L = LU.levelInfo(), d = LU.peekDay(k) || {};
      const vals = {}; Object.keys(LU.STATS).forEach((x) => (vals[x] = LU.statVal(x)));
      const maxV = Math.max(...Object.values(vals));
      const p = LU.dayProgress(k), streak = LU.streak();
      const yd = LU.peekDay(LU.addDays(k, -1)) || {};
      let sleep = '–';
      if (yd.slept && d.woke) { let m = LU.toMin(d.woke) - LU.toMin(yd.slept); if (m <= 0) m += 1440; if (m > 0 && m < 900) sleep = LU.dur(m); }
      if (sleep === '–') { const as = LU.sleepOf(k); if (as) sleep = LU.dur(as.min); }
      const days = LU.daysToExam(), ph = LU.phase();
      const span = Math.max(1, LU.diffDays(s.created, s.settings.examDate));
      const { cur, next, office } = nowQuest();
      const pace = LU.pace();
      const wk = LU.weekStudy(), bossMin = s.settings.bossHours * 60, beaten = !!s.boss[LU.weekKey(k)];
      const toApply = LU.diffDays(k, s.settings.applyDate);

      let nowHtml = '';
      const q = cur;
      if (q || office) {
        const showQ = q || office;
        const st = LU.toMin(showQ.start), pct = LU.clamp((LU.nowMin() - st) / Math.max(1, showQ.min), 0, 1);
        const overdue = q && LU.nowMin() >= st + q.min;
        nowHtml = `<div class="card"><div class="now"><div class="ic">${LU.kindIcon(showQ.kind)}</div>
          <div class="grow"><div class="row" style="gap:8px"><span class="pill ${overdue ? 'red' : 'gold'}">${overdue ? 'Overdue' : 'Now'}</span><span class="tiny muted">${LU.t12(showQ.start)} – ${LU.t12(showQ.end)}</span></div>
          <h3 style="margin-top:6px">${esc(showQ.title)}</h3>${showQ.sub ? `<div class="qs ell">${esc(showQ.sub)}</div>` : ''}</div>
          ${q && !q.info ? `<button class="chk" data-act="nowDone" data-id="${q.id}" aria-label="Complete">${I('check')}</button>` : ''}</div>
          ${!overdue ? `<div style="margin-top:12px">${LU.bar(pct, 'thin')}</div>` : ''}
          ${next ? `<div class="tiny muted" style="margin-top:10px">Next at ${LU.t12(next.start)}: ${esc(next.title)}</div>` : ''}</div>`;
      } else if (next) {
        nowHtml = `<div class="card"><div class="now"><div class="ic">${LU.kindIcon(next.kind)}</div><div class="grow"><span class="pill dim">Up next at ${LU.t12(next.start)}</span><h3 style="margin-top:6px">${esc(next.title)}</h3>${next.sub ? `<div class="qs ell">${esc(next.sub)}</div>` : ''}</div></div></div>`;
      }

      return `
      <div class="topbar"><h1>${esc(s.settings.name)}<span class="sub">${LU.niceDate(k)} · ${LU.dayTypeName[LU.dayType(k)]}</span></h1>
        <span style="display:flex;gap:2px"><button class="iconbtn" data-act="openDiary" aria-label="Diary">${I('diary')}</button><button class="iconbtn" data-act="morning" aria-label="Today's quote">${I('quote')}</button></span></div>

      <section class="win cd"><div class="win-in"><div class="win-h">PRELIMS COUNTDOWN</div>
        <div class="cdg" id="cd">${cdHtml()}</div>
        <div class="small muted" style="text-align:center;margin-top:10px">${LU.niceDate(s.settings.examDate, false)} · ${LU.t12(s.settings.examTime || '09:30')}<br><b style="color:var(--text)">${esc(ph.name)} phase.</b> ${esc(ph.desc)}</div>
        <div style="margin-top:12px">${LU.bar(1 - days / span, 'thin')}</div></div></section>

      <section class="win"><div class="win-in"><div class="win-h">STATUS</div>
        <div class="st-top">
          <div class="grow"><div class="lv num"><small>Lv.</small>${L.level}</div><div class="st-name" style="margin-top:8px">${esc(LU.titleOf())}</div><div class="st-title">Rank ${L.rank.r} · ${LU.fmt(L.xp)} XP</div></div>
          ${LU.rankBadge(L.rank.r)}
        </div>
        <div class="xpbar">${LU.bar(L.pct, 'gold')}<div class="barlbl"><span>Next level</span><span><b>${LU.fmt(L.into)}</b> / ${LU.fmt(L.need)} XP</span></div></div>
        <div class="stats">${LU.radar(vals)}
          <div class="statlist">${Object.keys(LU.STATS).map((x) => `<div class="stat"><span class="k">${LU.STATS[x].short}</span>${LU.bar(vals[x] / maxV)}<span class="v">${vals[x]}</span></div>`).join('')}</div>
        </div>
        <div class="st-foot"><div><b class="num">${streak}</b><span>Day streak</span></div><div><b class="num">${Math.round(p.pct * 100)}%</b><span>Today</span></div><div><b class="num">${sleep}</b><span>Last sleep</span></div></div>
      </div></section>



      ${nowHtml}
      ${timerCard()}
      ${reviewCard()}
      ${trackCard(d)}

      ${toApply >= 0 && toApply <= 45 ? `<div class="card" style="border-color:rgba(245,196,81,.5)"><div class="row"><span class="bossic gold">${I('flag')}</span><div class="grow"><b>Apply for CSE ${s.settings.examDate.slice(0, 4)}</b><div class="small muted">Application reminder in ${toApply} day${toApply === 1 ? '' : 's'}. The window is short, about 3 weeks.</div></div></div></div>` : ''}

      <section class="win red"><div class="win-in"><div class="win-h">WEEKLY BOSS</div>
        <div class="row"><div class="grow"><div style="font:700 17px var(--fd)">${beaten ? 'Defeated' : `The ${s.settings.bossHours}-hour week`}</div><div class="small muted">${beaten ? 'Reward claimed. A new boss appears on Monday.' : 'Study hours drain its health. Defeat it by Sunday night.'}</div></div><span class="bossic">${I('sword')}</span></div>
        <div style="margin-top:12px">${LU.bar(beaten ? 0 : 1 - wk / bossMin, 'red')}</div>
        <div class="barlbl"><span>Boss health</span><span>${LU.dur(wk)} of ${s.settings.bossHours}h studied</span></div>
      </div></section>

      ${(() => { const c = LU.missedCounts(); return `<div class="card tap" data-act="missedSheet"><div class="pace"><div class="big num" style="color:${c.week ? 'var(--red)' : 'var(--green)'}">${c.week}</div><div class="grow small"><b>Missed this week</b><div class="muted">${c.month} this month · ${c.all} in total. Tap to see which quests.</div></div></div></div>`; })()}
      <div class="card tap" data-act="tab" data-tab="study"><div class="pace">
        <div class="big num" style="color:${pace.diff >= 0 ? 'var(--green)' : 'var(--red)'}">${pace.diff >= 0 ? '+' : ''}${pace.diff}</div>
        <div class="grow small"><b>${pace.diff >= 0 ? 'Topics ahead of plan' : 'Topics behind plan'}</b><div class="muted">${LU.fmt(pace.d)} of ${LU.fmt(pace.t)} micro-topics done. Finish by ${LU.niceDate(s.settings.syllabusTarget, false)} needs about ${pace.perDay} a day.</div></div></div></div>
      <div style="height:10px"></div>`;
    },
    mount() {
      clearInterval(LU._tick);
      LU._tick = setInterval(() => {
        const el = document.getElementById('timerT');
        if (el && LU.state.timer) el.textContent = clock(LU.timerElapsed());
        const cd = document.getElementById('cd');
        if (cd) { const c = cdParts(), v = [c.d, LU.pad(c.h), LU.pad(c.m), LU.pad(c.s)]; if (c.over && !cd.querySelector('.cdover')) cd.innerHTML = cdHtml(); else cd.querySelectorAll('[data-cd]').forEach((b) => { const x = String(v[+b.dataset.cd]); if (b.textContent !== x) b.textContent = x; }); }
      }, 1000);
    },
  };

  LU.actions.nowDone = (el) => {
    const k = LU.todayKey(), q = LU.questsFor(k).find((x) => x.id === el.dataset.id);
    if (!q) return;
    el.classList.add('on', 'pop');
    const rec = LU.complete(k, q);
    if (rec) { LU.sfx('done'); LU.vibrate(18); LU.floatXP(el, `+${rec.xp} XP`); }
    setTimeout(() => LU.render(), 450);
  };
  LU.actions.timerPause = () => { const t = LU.state.timer; if (!t) return; if (t.paused) { LU.timerResume(); LU.sfx('tap'); } else { LU.timerPause(); LU.sfx('tap'); } LU.render(); };
  LU.actions.timerReset = () => LU.confirm('Reset the timer?', 'The time on it will be thrown away and nothing will be saved.', 'Reset', () => { LU.timerReset(); LU.toast('Timer reset. Nothing was saved.'); LU.render(); }, true);
  LU.actions.timer = () => {
    if (LU.state.timer) {
      const r = LU.timerStop();
      if (r && r.min) { LU.sfx('done'); LU.toast(`${r.office ? 'Office study' : 'Study'} logged: ${LU.dur(r.min)}, +${r.xp} XP`); }
      else LU.toast('Timer stopped. Less than a minute, nothing logged.');
    } else { LU.timerStart(); LU.sfx('tap'); LU.toast('Timer started. It pauses by itself when you leave the app.'); }
    LU.render();
  };

  /* ---------- morning screen ---------- */
  LU.pickQuote = () => {
    const qs = LU.state.quotes; if (!qs.length) return { q: 'Add your favourite quotes in More → Quotes.', a: 'LevelUp' };
    const n = LU.diffDays('2026-01-01', LU.todayKey());
    const i = ((n % qs.length) + qs.length) % qs.length;
    return qs[i];
  };
  LU.showMorning = (forced) => {
    const s = LU.state, k = LU.todayKey(), d = LU.day(k);
    let quote = LU.pickQuote();
    const dayNo = LU.diffDays(s.created, k) + 1, days = LU.daysToExam();
    const qs = LU.questsFor(k).filter((q) => q.src === 'block' && !q.info && !q.skipped);
    const wake = qs.find((q) => q.kind === 'wake');
    const tasks = (d.tasks || []).length;
    const draw = () => `
      <div class="win"><div class="win-in"><div class="win-h">SYSTEM</div>
        <p class="sysline">Day <b>${dayNo}</b> of your preparation begins. <b>${days}</b> days remain until Prelims.</p>
        <p class="quote" id="mq">“${esc(quote.q)}”</p><div class="qauth">${esc(quote.a)}</div>
        <div class="hr"></div>
        <div class="preview later">${qs.slice(0, 6).map((q) => `<div class="mini"><span>${LU.t12(q.start)}</span><span class="grow">${esc(q.title)}</span></div>`).join('')}
          ${tasks ? `<div class="mini"><span>+${tasks}</span><span class="grow">task${tasks > 1 ? 's' : ''} you planned last night</span></div>` : ''}</div>
        <div class="later2" style="display:grid;gap:10px;margin-top:16px">
          ${wake && !wake.done && !forced ? `<button class="btn block" data-act="mAwake">${I('sun')}I'm awake, start the day</button>` : `<button class="btn block" data-act="mGo">Show today's quests</button>`}
          <button class="btn ghost block sm" data-act="mQuote">Another quote</button>
        </div></div></div>`;
    LU.sfx('system');
    LU.overlay(draw(), () => { d.morning = true; LU.save(); });
    LU.actions.mQuote = () => {
      const all = s.quotes; if (all.length < 2) return;
      let nq; do { nq = all[Math.floor(Math.random() * all.length)]; } while (nq === quote);
      quote = nq; const el = document.getElementById('mq'); el.textContent = `“${quote.q}”`; el.nextElementSibling.textContent = quote.a;
    };
    LU.actions.mAwake = (el) => {
      const rec = LU.complete(k, wake);
      if (rec) { LU.sfx('done'); LU.vibrate(20); LU.floatXP(el, `+${rec.xp} XP`); }
      setTimeout(() => { LU.closeOverlay(); LU.go('quests'); LU.render(); }, 500);
    };
    LU.actions.mGo = () => { LU.closeOverlay(); LU.go('quests'); };
  };
  LU.actions.morning = () => LU.showMorning(true);
})();
