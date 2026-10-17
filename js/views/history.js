/* History and graphs: simple SVG charts, no libraries */
(function () {
  const LU = window.LU, esc = LU.esc, I = LU.icon;
  let range = 14;
  const COL = { cyan: 'var(--cyan)', gold: 'var(--gold)', red: 'var(--red)', green: 'var(--green)', muted: 'var(--muted)' };

  /* XP per day: use the stored value, else rebuild it from the activity log */
  const logXP = () => { const m = {}; (LU.state.log || []).forEach((e) => { const k = LU.keyOf(new Date(e.t - 3 * 3600e3)); m[k] = (m[k] || 0) + (e.xp || 0); }); return m; };
  LU.dayStats = (k, lx) => {
    const d = LU.peekDay(k) || {};
    const done = Object.keys(d.done || {}).length, miss = Object.keys(d.miss || {}).filter((id) => !(d.done || {})[id]).length;
    const sl = LU.sleepOf(k);
    return { k, xp: d.xp != null ? d.xp : ((lx || {})[k] || 0), study: ((d.studyMin || 0) + (d.extraMin || 0)) / 60, done, miss, steps: d.steps, sleep: sl ? sl.min / 60 : null, screen: d.screenMin != null ? d.screenMin / 60 : null };
  };

  /* bars (optionally stacked with a second series) and an optional goal line */
  const bars = (rows, o) => {
    const W = 320, H = 132, padL = 30, padB = 20, padT = 8, n = rows.length, bw = (W - padL - 6) / n;
    const tot = rows.map((r) => (r.a || 0) + (r.b || 0));
    let max = Math.max(o.goal || 0, ...tot, o.minMax || 1) * 1.1;
    const y = (v) => padT + (H - padT - padB) * (1 - v / max);
    const ticks = [0, max / 2 / 1.1, max / 1.1].map((v) => Math.round(v * 10) / 10);
    let g = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label)}">`;
    ticks.forEach((t) => { g += `<line x1="${padL}" x2="${W}" y1="${y(t)}" y2="${y(t)}" stroke="rgba(142,164,198,.16)"/><text x="${padL - 4}" y="${y(t) + 3}" text-anchor="end" fill="${COL.muted}" font-size="9">${o.fmt ? o.fmt(t) : t}</text>`; });
    rows.forEach((r, i) => {
      const x = padL + i * bw + bw * 0.16, w = bw * 0.68;
      if (r.a) g += `<rect x="${x}" y="${y(r.a)}" width="${w}" height="${Math.max(1, y(0) - y(r.a))}" rx="2.5" fill="${o.color}"/>`;
      if (r.b) g += `<rect x="${x}" y="${y(r.a + r.b)}" width="${w}" height="${Math.max(1, y(r.a) - y(r.a + r.b))}" rx="2.5" fill="${o.color2 || COL.red}"/>`;
      if (n <= 14 || i % 5 === 0 || i === n - 1) g += `<text x="${x + w / 2}" y="${H - 5}" text-anchor="middle" fill="${COL.muted}" font-size="9">${n <= 8 ? LU.dayName(r.k).slice(0, 1) : LU.parseKey(r.k).getDate()}</text>`;
    });
    if (o.goal) g += `<line x1="${padL}" x2="${W}" y1="${y(o.goal)}" y2="${y(o.goal)}" stroke="${COL.gold}" stroke-dasharray="4 3" stroke-width="1.2"/>`;
    return g + '</svg>';
  };

  const card = (title, sum, svg, note) => `<div class="card"><div class="row" style="align-items:baseline"><div class="grow" style="font:700 15px var(--fd)">${title}</div><div class="small muted">${sum}</div></div><div class="chart">${svg}</div>${note ? `<div class="tiny dim" style="margin-top:2px">${note}</div>` : ''}</div>`;
  const avg = (a) => { const v = a.filter((x) => x != null && x > 0); return v.length ? v.reduce((p, c) => p + c, 0) / v.length : 0; };

  LU.views.history = {
    render() {
      const today = LU.todayKey(), lx = logXP(), s = LU.state;
      const days = []; for (let i = range - 1; i >= 0; i--) days.push(LU.dayStats(LU.addDays(today, -i), lx));
      const trk = LU.trk(), hasSteps = days.some((d) => d.steps != null), hasSleep = days.some((d) => d.sleep), hasScreen = days.some((d) => d.screen != null);
      const sumXP = days.reduce((a, d) => a + d.xp, 0), sumStudy = days.reduce((a, d) => a + d.study, 0);
      const done = days.reduce((a, d) => a + d.done, 0), miss = days.reduce((a, d) => a + d.miss, 0);
      const cleared = days.filter((d) => (LU.peekDay(d.k) || {}).cleared).length;
      return `<div class="topbar"><button class="iconbtn" data-act="back">${I('back')}</button><h1>History<span class="sub">Last ${range} days</span></h1></div>
      <div class="chips">${[7, 14, 30].map((n) => `<button class="chip ${range === n ? 'on' : ''}" data-act="hRange" data-n="${n}">${n} days</button>`).join('')}</div>
      <div class="card"><div class="hsum"><div><b class="num">${LU.fmt(sumXP)}</b><span>XP gained</span></div><div><b class="num">${LU.dur(sumStudy * 60)}</b><span>Studied</span></div><div><b class="num">${cleared}</b><span>Days cleared</span></div><div><b class="num" style="color:${miss ? 'var(--red)' : 'inherit'}">${miss}</b><span>Missed</span></div></div></div>
      ${card('Study hours', LU.dur(sumStudy * 60 / range) + ' a day', bars(days.map((d) => ({ k: d.k, a: d.study })), { color: COL.cyan, goal: s.settings.bossHours / 7, label: 'Study hours per day', fmt: (v) => v + 'h' }), `Dashed line: ${s.settings.bossHours / 7 > 0 ? (s.settings.bossHours / 7).toFixed(1) : 0}h a day, what the weekly boss needs.`)}
      ${card('XP per day', LU.fmt(Math.round(sumXP / range)) + ' avg', bars(days.map((d) => ({ k: d.k, a: Math.max(0, d.xp) })), { color: COL.gold, label: 'XP per day', fmt: (v) => Math.round(v) }))}
      ${card('Quests: done and missed', `${done} done · ${miss} missed`, bars(days.map((d) => ({ k: d.k, a: d.done, b: d.miss })), { color: COL.cyan, color2: COL.red, label: 'Quests done and missed per day', fmt: (v) => Math.round(v) }), 'Blue: done. Red: marked missed with the cross.')}
      ${hasSteps ? card('Steps', LU.fmt(Math.round(avg(days.map((d) => d.steps)))) + ' avg', bars(days.map((d) => ({ k: d.k, a: d.steps || 0 })), { color: COL.green, goal: trk.goal, label: 'Steps per day', fmt: (v) => (v >= 1000 ? Math.round(v / 100) / 10 + 'k' : Math.round(v)) }), 'Dashed line: your step goal.') : ''}
      ${hasSleep ? card('Sleep', LU.dur(avg(days.map((d) => d.sleep)) * 60) + ' avg', bars(days.map((d) => ({ k: d.k, a: d.sleep || 0 })), { color: '#9B8CFF', goal: 6, label: 'Sleep hours per night', fmt: (v) => v + 'h' }), 'From your Sleep and Wake quests, or estimated from screen-off time.') : ''}
      ${hasScreen ? card('Screen time', LU.dur(avg(days.map((d) => d.screen)) * 60) + ' avg', bars(days.map((d) => ({ k: d.k, a: d.screen || 0 })), { color: COL.muted, label: 'Screen time per day', fmt: (v) => v + 'h' })) : ''}
      ${!hasSteps && !hasSleep && !hasScreen ? `<div class="card small muted">Steps, sleep and screen time charts appear here once tracking is on. Open <b>More › Steps, sleep and screen time</b>.</div>` : ''}
      <div style="height:16px"></div>`;
    },
  };
  LU.actions.hRange = (el) => { range = +el.dataset.n; LU.render(); };
})();
