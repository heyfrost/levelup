/* Part 11: penalties. Missing a target now costs XP. Checked when a day ends. XP can go negative. */
(function () {
  const LU = window.LU, esc = LU.esc, I = LU.icon;
  const DEF = { on: true, day: 50, aw: 10, boss: 200, dayOn: true, awOn: true, bossOn: true, since: null, done: null };
  const P = () => { const s = LU.state.settings; s.penalty = Object.assign({}, DEF, s.penalty || {}); return s.penalty; };
  const L = () => { const s = LU.state; if (!Array.isArray(s.penLog)) s.penLog = []; return s.penLog; };

  /* take XP away. XP may go below zero; levels can fall back to level 1 */
  const take = (k, n, text) => {
    LU.gainXP(-n);
    LU.log('Penalty: ' + text, -n);
    L().unshift({ k, text, xp: n, asked: n });
    if (L().length > 60) L().length = 60;
    return n;
  };

  /* check every finished day that has not been checked yet (at most the last 7) */
  LU.applyPenalties = () => {
    const s = LU.state, p = P(), today = LU.todayKey();
    if (!p.since) { p.since = today; p.done = LU.addDays(today, -1); LU.save(); return 0; }   // nothing is punished retroactively
    if (!p.on) { p.done = LU.addDays(today, -1); return 0; }
    let k = LU.addDays(p.done || LU.addDays(today, -1), 1), n = 0, total = 0;
    const lim = LU.addDays(today, -7);
    if (k < lim) k = lim;
    while (k < today) {
      if (k >= p.since) {
        const d = s.days[k] || {}, light = !!d.low || !!d.rest;
        const prog = LU.dayProgress(k);
        if (!light) {
          if (p.dayOn && prog.n > 0 && !d.cleared) { total += take(k, p.day, 'daily target missed (' + Math.round(prog.pct * 100) + '%) · ' + LU.niceDate(k, false)); n++; }
          const aw = s.aw;
          if (p.awOn && aw && aw.target > 0) {
            const miss = aw.target - ((aw.log || {})[k] || 0);
            if (miss > 0) { total += take(k, p.aw * miss, 'answer target missed by ' + miss + ' · ' + LU.niceDate(k, false)); n++; }
          }
        }
        /* a week ends on Sunday */
        if (p.bossOn && LU.parseKey(k).getDay() === 0) {
          const wk = LU.weekKey(k);
          if (wk >= p.since && !s.boss[wk] && LU.weekStudy(k) < s.settings.bossHours * 60) { total += take(k, p.boss, 'weekly study goal missed'); n++; }
        }
      }
      k = LU.addDays(k, 1);
    }
    p.done = LU.addDays(today, -1);
    if (n) { s.penNote = { n, xp: total, t: Date.now() }; LU.emit && LU.emit('penalty', { n, xp: total }); }
    LU.save();
    return n;
  };
  const baseRollover = LU.rollover;
  LU.rollover = () => { baseRollover(); try { LU.applyPenalties(); } catch (e) { console.error(e); } };

  /* tell the user once, the next time the app opens */
  LU.penaltyNotice = () => {
    const n = LU.state.penNote; if (!n) return;
    LU.state.penNote = null; LU.save();
    LU.toast(n.xp ? `Penalty: −${n.xp} XP for missed targets. See More > Penalties.` : 'Targets missed.', { ms: 5000 });
  };
  setTimeout(() => LU.penaltyNotice(), 2200);

  /* ---------- screen ---------- */
  const sw = (on) => `<span class="switch ${on ? 'on' : ''}"></span>`;
  const row = (act, k, title, sub, on, amt) => `<div class="li" data-act="penAmt" data-k="${k}"><span class="lic">${I('flag')}</span><div class="grow"><div class="lt">${title}</div><div class="ls">${sub}</div><div class="ls" style="color:var(--red)">Lose ${amt} XP · tap to change</div></div><span class="switch ${on ? 'on' : ''}" data-act="penTog" data-k="${k}"></span></div>`;
  LU.views.penalty = {
    render() {
      const p = P(), log = L().slice(0, 15);
      return `<div class="topbar"><button class="iconbtn" data-act="back">${I('back')}</button><h1>Penalties<span class="sub">Missing a target costs XP</span></h1></div>
        <div class="list"><div class="li" data-act="penTog" data-k="on"><span class="lic">${I('target')}</span><div class="grow"><div class="lt">Penalties</div><div class="ls">${p.on ? 'On. Checked when each day ends' : 'Off. Nothing is taken'}</div></div>${sw(p.on)}</div></div>
        <div class="sec-title">What is punished</div>
        <div class="list">
          ${row('', 'dayOn', 'Daily target missed', `Clear less than ${LU.state.settings.clearAt}% of the day's XP`, p.dayOn, p.day)}
          ${row('', 'awOn', 'Answer target missed', 'Per missing answer, if you use Answer writing', p.awOn, p.aw)}
          ${row('', 'bossOn', 'Weekly study goal missed', `Under ${LU.state.settings.bossHours} study hours by Sunday`, p.bossOn, p.boss)}
        </div>
        <div class="card small muted" style="margin-top:12px">Your streak already breaks when a day is not cleared. A Light day or Rest day is never punished. Your XP can fall below zero if you keep missing targets. Only days from ${p.since ? LU.niceDate(p.since) : 'today'} onward count.</div>
        <div class="sec-title">Recent penalties</div>
        <div class="list">${log.map((e) => `<div class="li"><div class="grow"><div class="lt">${esc(e.text)}</div></div><b class="num" style="color:var(--red)">−${e.xp}</b></div>`).join('') || `<div class="li"><div class="grow small muted">None yet.</div></div>`}</div>
        <div style="height:20px"></div>`;
    },
  };
  LU.actions.openPenalty = () => LU.push('penalty');
  LU.actions.penTog = (el) => { const p = P(), k = el.dataset.k; p[k] = !p[k]; if (k === 'on' && p.on) { p.since = p.since || LU.todayKey(); } LU.save(); LU.render(); };
  LU.actions.penAmt = (el) => {
    const k = el.dataset.k, key = k === 'dayOn' ? 'day' : k === 'awOn' ? 'aw' : 'boss', p = P();
    LU.sheet({
      title: 'XP lost', body: `<div class="field"><label>${k === 'awOn' ? 'XP lost per missing answer' : 'XP lost each time'}</label><input class="inp" id="paV" type="number" inputmode="numeric" min="0" max="2000" value="${p[key]}"></div><p class="small muted">Set 0 to make this one free.</p>`,
      foot: `<button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn" id="paOk">Save</button>`,
      mount: (s) => { LU.$('#paOk', s).onclick = () => { const v = LU.clamp(parseInt(LU.$('#paV', s).value, 10) || 0, 0, 2000); p[key] = v; LU.save(); LU.closeSheet(); LU.render(); }; },
    });
  };
  const prev = LU.more3;
  LU.more3 = () => `
      <div class="sec-title">Discipline</div>
      <div class="list"><div class="li" data-act="openPenalty"><span class="lic">${I('flag')}</span><div class="grow"><div class="lt">Penalties</div><div class="ls">${P().on ? 'On: missed targets cost XP' : 'Off'}</div></div><span class="chev">${I('chev')}</span></div></div>` + prev();
})();
