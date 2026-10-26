/* Daily sit-up counter. Add reps through the day (also at the office). Reps give XP, reaching the goal gives a bonus and +1 Strength.
   Data: LU.state.situps[dayKey] = { n: reps today, xp: XP paid so far, str: 1 if today's Strength point was given, log: [{ t, n }] } */
(function () {
  const LU = window.LU, I = LU.icon;
  const DEF_GOAL = 50, PER10 = 5, BONUS = 20;

  const store = () => (LU.state.situps = LU.state.situps || {});
  const goal = () => Math.max(1, Math.round(+(LU.state.settings || {}).sitGoal) || DEF_GOAL);
  const rec = (k) => { const s = store(); return (s[k] = s[k] || { n: 0, xp: 0, str: 0, log: [] }); };
  const peek = (k) => store()[k] || { n: 0, xp: 0, str: 0, log: [] };
  const reward = (n) => Math.floor(n / 10) * PER10 + (n >= goal() ? BONUS : 0);

  /* pay (or take back) exactly the XP and Strength point that today's total is worth */
  const settle = (k) => {
    const r = rec(k), want = reward(r.n), delta = want - (r.xp || 0);
    let msg = '';
    if (delta) { LU.gainXP(delta); r.xp = want; LU.log('Sit-ups: ' + r.n + ' today', delta); }
    const hit = r.n >= goal();
    if (hit && !r.str) { r.str = 1; LU.state.stats.str = (LU.state.stats.str || 0) + 1; msg = 'Sit-up goal reached! +' + BONUS + ' bonus XP and +1 Strength'; }
    else if (!hit && r.str) { r.str = 0; LU.state.stats.str = Math.max(0, (LU.state.stats.str || 0) - 1); }
    return msg;
  };

  LU.sitAdd = (n) => {
    n = Math.round(+n); if (!n || n < 1 || n > 1000) return;
    const k = LU.todayKey(), r = rec(k);
    r.n += n; r.log.push({ t: Date.now(), n });
    if (r.log.length > 300) r.log = r.log.slice(-300);
    const msg = settle(k);
    LU.save(true);
    LU.toast(msg || ('+' + n + ' sit-ups. ' + r.n + ' today'), { sys: false, ms: msg ? 3200 : 1400 });
    LU.render(false);
  };
  LU.sitUndo = () => {
    const k = LU.todayKey(), r = rec(k), last = r.log.pop();
    if (!last) { LU.toast('Nothing to undo today.', { sys: false }); return; }
    r.n = Math.max(0, r.n - last.n);
    settle(k); LU.save(true); LU.toast('Removed ' + last.n + ' sit-ups. ' + r.n + ' today', { sys: false, ms: 1600 }); LU.render(false);
  };

  /* ---------- stats ---------- */
  const goalStreak = () => {
    const t = LU.todayKey(); let k = peek(t).n >= goal() ? t : LU.addDays(t, -1), n = 0;
    while (peek(k).n >= goal()) { n++; k = LU.addDays(k, -1); }
    return n;
  };
  const totals = () => {
    const s = store(); let all = 0, best = 0, bestK = '', days = 0;
    Object.keys(s).forEach((k) => { const v = s[k].n || 0; all += v; if (v > 0) days++; if (v > best) { best = v; bestK = k; } });
    const w = LU.weekKey(LU.todayKey()); let week = 0;
    for (let i = 0; i < 7; i++) week += peek(LU.addDays(w, i)).n || 0;
    return { all, best, bestK, days, week };
  };

  const buttons = () => `<div class="su-btns" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
    <button class="btn sm" data-act="sitAdd" data-n="5">+5</button><button class="btn sm" data-act="sitAdd" data-n="10">+10</button><button class="btn sm" data-act="sitAdd" data-n="20">+20</button>
    <button class="btn ghost sm" data-act="sitOther">${I('plus')}Other</button><button class="btn ghost sm" data-act="sitUndo">${I('left')}Undo</button></div>`;

  /* ---------- the card on today's quests screen ---------- */
  const prevExtras = LU.questExtras;
  LU.questExtras = (k) => {
    const base = prevExtras ? prevExtras(k) : '';
    if (k !== LU.todayKey()) return base;
    const n = peek(k).n, g = goal(), pct = Math.min(1, n / g), done = n >= g;
    return base + `<div class="card" id="suCard"><div class="row" data-act="sitOpen" style="cursor:pointer">${LU.ring(pct, done ? 'var(--gold)' : 'var(--cyan)', String(n))}
      <div class="grow"><div style="font:700 16px var(--fd)">Sit-ups today</div><div class="small muted">${n} of ${g}${done ? ' · goal reached' : ' · ' + (g - n) + ' to go'}. Counts even if you skip the workout.</div></div><span class="dim">${I('right')}</span></div>${buttons()}</div>`;
  };

  /* ---------- the full screen ---------- */
  LU.views.situps = {
    render() {
      const t = LU.todayKey(), n = peek(t).n, g = goal(), T = totals(), st = goalStreak();
      const days = []; for (let i = 0; i < 14; i++) days.push(LU.addDays(t, -i));
      const mx = Math.max(g, ...days.map((k) => peek(k).n || 0));
      return `<div class="topbar"><button class="iconbtn" data-act="back" aria-label="Back">${I('back')}</button><h1>Sit-ups<span class="sub">Daily counter</span></h1></div>
      <div class="card"><div class="row">${LU.ring(Math.min(1, n / g), n >= g ? 'var(--gold)' : 'var(--cyan)', String(n))}
        <div class="grow"><div style="font:700 18px var(--fd)">${n} today</div><div class="small muted">Goal ${g}${n >= g ? ' · reached' : ' · ' + (g - n) + ' to go'}</div>
        <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">${st ? `<span class="pill gold">${I('fire')}${st}-day goal streak</span>` : ''}</div></div></div>${buttons()}
        <div class="small muted" style="margin-top:10px">Every 10 sit-ups gives ${PER10} XP. Reaching the goal gives ${BONUS} bonus XP and +1 Strength, once a day.</div></div>
      <div class="card tap" data-act="sitGoal"><div class="row"><div class="grow"><div class="tiny muted">Daily goal</div><div style="font:700 17px var(--fd)">${g} sit-ups</div></div><span class="dim">${I('edit')}</span></div></div>
      <div class="sec-title">Totals</div>
      <div class="list">
        <div class="li"><div class="grow"><div class="lt">This week</div></div><b>${LU.fmt(T.week)}</b></div>
        <div class="li"><div class="grow"><div class="lt">All time</div><div class="ls">${T.days} days with sit-ups</div></div><b>${LU.fmt(T.all)}</b></div>
        <div class="li"><div class="grow"><div class="lt">Best day</div><div class="ls">${T.bestK ? LU.niceDate(T.bestK) : 'None yet'}</div></div><b>${LU.fmt(T.best)}</b></div>
      </div>
      <div class="sec-title">Last 14 days</div>
      <div class="list">${days.map((k) => { const v = peek(k).n || 0; return `<div class="li"><div class="grow"><div class="lt">${k === t ? 'Today' : LU.niceDate(k)}</div><div class="bar thin ${v >= g ? 'gold' : ''}" style="margin-top:6px"><i style="width:${Math.round((v / mx) * 100)}%"></i></div></div><b>${v}</b></div>`; }).join('')}</div>
      <div style="height:16px"></div>`;
    },
  };

  LU.settle_situps = () => settle(LU.todayKey());
  LU.actions.sitAdd = (el) => LU.sitAdd(+el.dataset.n);
  LU.actions.sitUndo = () => LU.sitUndo();
  LU.actions.sitOpen = () => LU.push('situps');
  LU.actions.sitOther = () => {
    LU.sheet({
      title: 'Add sit-ups', body: `<div class="field"><label>How many did you just do?</label><input class="inp" id="suN" type="number" min="1" max="1000" inputmode="numeric" placeholder="e.g. 15"></div>`,
      foot: `<button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn" id="suOk">Add</button>`,
      mount: (sh) => {
        const go = () => { const v = Math.round(+LU.$('#suN', sh).value); if (!v || v < 1) return; LU.closeSheet(true); LU.sitAdd(v); };
        LU.$('#suOk', sh).onclick = go; LU.$('#suN', sh).onkeydown = (e) => { if (e.key === 'Enter') go(); };
        setTimeout(() => LU.$('#suN', sh) && LU.$('#suN', sh).focus(), 250);
      },
    });
  };
  LU.actions.sitGoal = () => {
    LU.sheet({
      title: 'Daily goal', body: `<div class="field"><label>Sit-ups per day</label><input class="inp" id="sgN" type="number" min="1" max="1000" inputmode="numeric" value="${goal()}"></div>`,
      foot: `<button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn" id="sgOk">Save</button>`,
      mount: (sh) => {
        LU.$('#sgOk', sh).onclick = () => {
          const v = Math.round(+LU.$('#sgN', sh).value); if (!v || v < 1 || v > 1000) return;
          LU.state.settings.sitGoal = v;
          const msg = settle(LU.todayKey());          /* today may now be over or under the goal */
          LU.save(true); LU.closeSheet(true); if (msg) LU.toast(msg, { sys: false, ms: 3200 }); LU.render(false);
        };
      },
    });
  };
})();
