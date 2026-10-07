/* Part 12a: study time by subject, rest day, reward shop, monthly report, money chart + CSV, privacy. */
(function () {
  const LU = window.LU, esc = LU.esc, I = LU.icon;
  const today = () => LU.todayKey();
  const MN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const li = (act, icon, title, sub, extra) => `<div class="li" data-act="${act}"><span class="lic">${I(icon)}</span><div class="grow"><div class="lt">${title}</div>${sub ? `<div class="ls">${sub}</div>` : ''}</div>${extra || `<span class="chev">${I('chev')}</span>`}</div>`;
  const head = (t, sub) => `<div class="topbar"><button class="iconbtn" data-act="back" aria-label="Back">${I('back')}</button><h1>${t}${sub ? `<span class="sub">${sub}</span>` : ''}</h1></div>`;
  const addMonth = (m, n) => { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  const monthDays = (m) => { const [y, mo] = m.split('-').map(Number), n = new Date(y, mo, 0).getDate(); return Array.from({ length: n }, (_, i) => m + '-' + String(i + 1).padStart(2, '0')); };
  const hrs = (min) => LU.dur(Math.round(min));
  const rs = (n) => '₹' + LU.fmt(Math.round((+n || 0) * 100) / 100);

  /* ================= study minutes by subject ================= */
  const SM = (d) => (d.subjMin = d.subjMin || {});
  const baseComplete = LU.complete;
  LU.complete = (k, q) => {
    const rec = baseComplete(k, q);
    if (rec && rec.min) { const sj = q.subjectId || '_'; rec.subj = sj; const m = SM(LU.day(k)); m[sj] = (m[sj] || 0) + rec.min; LU.save(); }
    return rec;
  };
  const baseUn = LU.uncomplete;
  LU.uncomplete = (k, q) => {
    const d = LU.day(k), rec = d.done[q.id], sj = rec && rec.subj, mn = rec && rec.min;
    baseUn(k, q);
    if (sj && mn) { const m = SM(d); m[sj] = Math.max(0, (m[sj] || 0) - mn); LU.save(); }
  };
  /* minutes per subject between two day keys */
  LU.subjMinutes = (from, to) => {
    const out = {};
    Object.keys(LU.state.days).forEach((k) => {
      if ((from && k < from) || (to && k > to)) return;
      const m = LU.state.days[k].subjMin; if (m) Object.keys(m).forEach((s) => { out[s] = (out[s] || 0) + m[s]; });
    });
    return out;
  };
  const lastStudied = (sid) => {
    const ks = Object.keys(LU.state.days).sort().reverse();
    for (const k of ks) { const m = LU.state.days[k].subjMin; if (m && m[sid] > 0) return k; }
    return null;
  };
  let stRange = 7;
  LU.views.studytime = {
    render() {
      const t = today(), from = stRange ? LU.addDays(t, -(stRange - 1)) : null, m = LU.subjMinutes(from, t);
      const subs = LU.syllabus.filter((s) => s.id !== 'csat' && s.id !== 'essay' || m[s.id]);
      const rows = subs.map((s) => ({ s, min: m[s.id] || 0, last: lastStudied(s.id) }));
      const total = rows.reduce((a, r) => a + r.min, 0) + (m._ || 0), top = Math.max(1, ...rows.map((r) => r.min), m._ || 0);
      const neglected = rows.filter((r) => !r.last || LU.diffDays(r.last, t) >= 7).sort((a, b) => (a.last || '') < (b.last || '') ? -1 : 1);
      return head('Study time', 'Hours by subject') + `
        <div class="chips">${[[7, '7 days'], [30, '30 days'], [0, 'All time']].map(([n, l]) => `<button class="chip ${stRange === n ? 'on' : ''}" data-act="stRange" data-n="${n}">${l}</button>`).join('')}</div>
        <div class="card"><div class="small muted">Total counted by subject</div><div style="font:800 28px var(--fd)">${hrs(total)}</div></div>
        <div class="list" style="margin-top:12px">${rows.filter((r) => r.min).sort((a, b) => b.min - a.min).map((r) => `<div class="li"><span class="sw" style="width:8px;height:28px;border-radius:3px;background:${r.s.color}"></span><div class="grow"><div class="lt">${esc(r.s.name)}</div>${LU.bar(r.min / top)}</div><b class="num">${hrs(r.min)}</b></div>`).join('') || `<div class="li"><div class="grow small muted">Nothing yet. Study blocks tied to a subject, and the Focus timer with a subject chosen, are counted here.</div></div>`}
          ${m._ ? `<div class="li"><div class="grow"><div class="lt">No subject</div>${LU.bar(m._ / top)}</div><b class="num">${hrs(m._)}</b></div>` : ''}</div>
        ${neglected.length ? `<div class="sec-title">Neglected (not studied for 7+ days)</div><div class="list">${neglected.map((r) => `<div class="li"><span class="sw" style="width:8px;height:28px;border-radius:3px;background:${r.s.color}"></span><div class="grow"><div class="lt">${esc(r.s.name)}</div><div class="ls">${r.last ? 'Last studied ' + LU.diffDays(r.last, t) + ' days ago' : 'Not tracked yet'}</div></div></div>`).join('')}</div>` : ''}
        <div class="card small muted" style="margin-top:12px">Counting starts from this update. Older study time is not split by subject.</div><div style="height:20px"></div>`;
    },
  };
  LU.actions.openStudyTime = () => LU.push('studytime');
  LU.actions.stRange = (el) => { stRange = +el.dataset.n; LU.render(); };

  /* ================= rest day: one free pass a month ================= */
  const RS = () => (LU.state.rest = LU.state.rest || {});
  LU.restUsedBy = (k) => RS()[k.slice(0, 7)];
  LU.actions.toggleRest = () => {
    const k = today(), d = LU.day(k), used = LU.restUsedBy(k);
    if (d.rest) { d.rest = 0; delete RS()[k.slice(0, 7)]; LU.save(); LU.toast('Rest day cancelled. Your pass is back.', { sys: false }); LU.render(); return; }
    if (used && used !== k) { LU.toast('You already used this month’s rest day on ' + LU.niceDate(used) + '.'); return; }
    LU.confirm('Take a rest day today?', 'Your streak is kept and no penalty is taken for today. You get one rest day a month.', 'Rest today', () => { d.rest = 1; RS()[k.slice(0, 7)] = k; LU.save(); LU.render(); LU.toast('Rest day. Your streak is safe.', { sys: false }); });
  };
  const baseExtras = LU.questExtras;
  LU.questExtras = (k) => {
    const base = baseExtras ? baseExtras(k) : '';
    if (k !== today()) return base;
    const d = LU.peekDay(k) || {}, used = LU.restUsedBy(k), on = !!d.rest;
    const sub = on ? 'On: streak safe, no penalty today' : used ? 'Used this month (' + LU.niceDate(used) + ')' : 'One free pass a month. Keeps your streak.';
    return base + `<div class="card tap" data-act="toggleRest" style="display:flex;align-items:center;gap:12px"><span class="lic">${I('moon')}</span><div class="grow"><div class="lt">Rest day</div><div class="small muted">${sub}</div></div><span class="switch ${on ? 'on' : ''}"></span></div>`;
  };

  /* ================= reward shop ================= */
  const SH = () => { const s = LU.state; if (!s.shop) s.shop = {}; const o = s.shop; if (!Array.isArray(o.items)) o.items = []; if (!Array.isArray(o.bought)) o.bought = []; if (typeof o.spent !== 'number') o.spent = 0; return o; };
  LU.wallet = () => (LU.state.xp || 0) - SH().spent;
  const DEFAULT_ITEMS = [{ name: 'Favourite snack', cost: 150 }, { name: 'One episode of a show', cost: 250 }, { name: 'Order food', cost: 800 }];
  LU.views.shop = {
    render() {
      const sh = SH(), w = LU.wallet();
      return head('Reward shop', 'Spend XP on your own rewards') + `
        <div class="card" style="text-align:center"><div class="small muted">Spendable XP</div><div style="font:800 34px var(--fd);${w < 0 ? 'color:var(--red)' : ''}">${LU.fmt(w)}</div><div class="small muted">Spending does not lower your level. It only uses your XP balance.</div></div>
        <div class="sec-title">Rewards <a class="link" data-act="shAdd">Add</a></div>
        <div class="list">${sh.items.map((it) => `<div class="li" data-act="shBuy" data-id="${it.id}"><span class="lic">${I('star')}</span><div class="grow"><div class="lt">${esc(it.name)}</div><div class="ls">${it.cost} XP · tap to claim</div></div><button class="btn ghost sm" data-act="shEdit" data-id="${it.id}">Edit</button></div>`).join('') || `<div class="li"><div class="grow small muted">No rewards yet. Add things you would like, like a movie night or a treat.</div></div>`}</div>
        ${sh.items.length ? '' : `<button class="btn ghost block" style="margin-top:12px" data-act="shStarter">Add 3 example rewards</button>`}
        <div class="sec-title">Claimed</div>
        <div class="list">${sh.bought.slice(0, 20).map((b) => `<div class="li"><div class="grow"><div class="lt">${esc(b.name)}</div><div class="ls">${LU.niceDate(b.k)}</div></div><b class="num" style="color:var(--red)">−${b.cost}</b></div>`).join('') || `<div class="li"><div class="grow small muted">Nothing claimed yet.</div></div>`}</div><div style="height:20px"></div>`;
    },
  };
  LU.actions.openShop = () => LU.push('shop');
  LU.actions.shStarter = () => { DEFAULT_ITEMS.forEach((x) => SH().items.push({ id: LU.uid(), name: x.name, cost: x.cost })); LU.save(); LU.render(); };
  LU.actions.shBuy = (el) => {
    const sh = SH(), it = sh.items.find((x) => x.id === el.dataset.id); if (!it) return;
    if (LU.wallet() < it.cost) { LU.toast('Not enough XP. You need ' + (it.cost - LU.wallet()) + ' more.'); return; }
    LU.confirm('Claim “' + it.name + '”?', it.cost + ' XP will be spent. Your level stays the same.', 'Claim', () => {
      sh.spent += it.cost; sh.bought.unshift({ id: LU.uid(), name: it.name, cost: it.cost, k: today(), at: Date.now() }); if (sh.bought.length > 100) sh.bought.length = 100;
      LU.log('Reward: ' + it.name, 0); LU.save(); LU.sfx && LU.sfx('clear'); LU.render(); LU.toast('Enjoy! ' + it.name, { sys: false });
    });
  };
  const itemSheet = (it) => {
    const isNew = !it.id;
    LU.sheet({
      title: isNew ? 'New reward' : 'Edit reward',
      body: `<div class="field"><label>Reward</label><input class="inp" id="shN" maxlength="50" value="${esc(it.name || '')}" placeholder="e.g. Movie night"></div><div class="field"><label>Cost in XP</label><input class="inp" id="shC" type="number" inputmode="numeric" min="1" max="100000" value="${it.cost || 200}"></div>`,
      foot: `${isNew ? `<button class="btn ghost" data-act="closeSheet">Cancel</button>` : `<button class="btn danger" id="shD">Delete</button>`}<button class="btn" id="shOk">Save</button>`,
      mount: (s) => {
        LU.$('#shOk', s).onclick = () => {
          const name = LU.$('#shN', s).value.trim(), cost = LU.clamp(parseInt(LU.$('#shC', s).value, 10) || 0, 1, 100000);
          if (!name) { LU.toast('Give the reward a name.'); return; }
          if (isNew) SH().items.push({ id: LU.uid(), name, cost }); else Object.assign(SH().items.find((x) => x.id === it.id) || {}, { name, cost });
          LU.save(); LU.closeSheet(); LU.render();
        };
        const dl = LU.$('#shD', s); if (dl) dl.onclick = () => { SH().items = SH().items.filter((x) => x.id !== it.id); LU.save(); LU.closeSheet(); LU.render(); };
      },
    });
  };
  LU.actions.shAdd = () => itemSheet({});
  LU.actions.shEdit = (el) => { const it = SH().items.find((x) => x.id === el.dataset.id); if (it) itemSheet(it); };

  /* ================= monthly report ================= */
  let repMonth = null;
  LU.reportData = (m) => {
    const s = LU.state, ds = monthDays(m), first = ds[0], last = ds[ds.length - 1], t = today();
    const upto = ds.filter((k) => k <= t);
    let xp = 0, study = 0, cleared = 0, rest = 0, focusN = 0, topics = 0, steps = [], extra = 0;
    upto.forEach((k) => { const d = s.days[k]; if (!d) return; xp += d.xp || 0; study += (d.studyMin || 0) + (d.extraMin || 0); if (d.cleared) cleared++; if (d.rest) rest++; focusN += d.focusN || 0; topics += d.topics || 0; if (d.steps) steps.push(d.steps); });
    const subj = LU.subjMinutes(first, last);
    const pen = (s.penLog || []).filter((e) => e.k >= first && e.k <= last).reduce((a, e) => a + e.xp, 0);
    const missed = LU.missedList(first, last).length;
    const mq = ((s.mcq || {}).log || []).filter((e) => e.k >= first && e.k <= last), mqN = mq.reduce((a, e) => a + e.n, 0), mqOk = mq.reduce((a, e) => a + e.ok, 0);
    const mocks = (s.mocks || []).filter((x) => x.d >= first && x.d <= last), mockAvg = mocks.length ? mocks.reduce((a, x) => a + (x.score / x.max) * 100, 0) / mocks.length : null;
    const aw = Object.keys((s.aw || {}).log || {}).filter((k) => k >= first && k <= last).reduce((a, k) => a + s.aw.log[k], 0);
    const money = ((s.money || {}).entries || []).filter((e) => e.d >= first && e.d <= last), spent = money.reduce((a, e) => a + e.a, 0), spentN = money.filter((e) => e.c === 'n').reduce((a, e) => a + e.a, 0);
    return { m, days: upto.length, xp, study, cleared, rest, focusN, topics, subj, pen, missed, mqN, mqOk, mocks: mocks.length, mockAvg, aw, spent, spentN, steps: steps.length ? Math.round(steps.reduce((a, b) => a + b, 0) / steps.length) : 0, level: LU.levelInfo().level, totalXp: s.xp };
  };
  LU.reportText = (m) => {
    const r = LU.reportData(m), [y, mo] = m.split('-').map(Number), name = (LU.state.settings.name || 'Aspirant');
    const subs = Object.keys(r.subj).filter((k) => r.subj[k] > 0).sort((a, b) => r.subj[b] - r.subj[a]).map((k) => '  ' + (k === '_' ? 'No subject' : (LU.subject(k) || { name: k }).name) + ': ' + hrs(r.subj[k]));
    const L = [`LevelUp monthly report`, `${MN[mo - 1]} ${y} · ${name}`, '',
      `Days cleared: ${r.cleared} of ${r.days}` + (r.rest ? ` (+${r.rest} rest day)` : ''),
      `Study time: ${hrs(r.study)} · Focus sessions: ${r.focusN} · Topics finished: ${r.topics}`,
      `XP this month: ${r.xp >= 0 ? '+' : ''}${LU.fmt(r.xp)} · Penalties: −${LU.fmt(r.pen)} · Missed quests: ${r.missed}`,
      `Level now: ${r.level} (${LU.fmt(r.totalXp)} XP)`];
    if (subs.length) L.push('', 'Study by subject:', ...subs);
    if (r.mqN) L.push('', `MCQs: ${r.mqOk}/${r.mqN} correct (${Math.round((r.mqOk / r.mqN) * 100)}%)`);
    if (r.mocks) L.push(`Mock tests: ${r.mocks}, average ${Math.round(r.mockAvg)}%`);
    if (r.aw) L.push(`Answers written: ${r.aw}`);
    if (r.steps) L.push(`Average steps: ${LU.fmt(r.steps)}`);
    if (r.spent) L.push('', `Spent: ${rs(r.spent)} (necessities ${rs(r.spentN)}, extra ${rs(r.spent - r.spentN)})`);
    return L.join('\n');
  };
  LU.views.report = {
    render() {
      if (!repMonth) repMonth = today().slice(0, 7);
      const r = LU.reportData(repMonth), [y, mo] = repMonth.split('-').map(Number);
      const stat = (v, l, red) => `<div><b class="num" ${red ? 'style="color:var(--red)"' : ''}>${v}</b><span>${l}</span></div>`;
      const subs = Object.keys(r.subj).filter((k) => r.subj[k] > 0).sort((a, b) => r.subj[b] - r.subj[a]), top = Math.max(1, ...subs.map((k) => r.subj[k]));
      return head('Monthly report', 'One page summary') + `
        <div class="card" style="display:flex;align-items:center;justify-content:space-between"><button class="iconbtn" data-act="rpMonth" data-n="-1">${I('left')}</button><div class="lt">${MN[mo - 1]} ${y}</div><button class="iconbtn" data-act="rpMonth" data-n="1">${I('right')}</button></div>
        <div class="card" style="margin-top:12px"><div class="hsum">${stat(r.cleared + '/' + r.days, 'Days cleared')}${stat(hrs(r.study), 'Studied')}${stat((r.xp >= 0 ? '+' : '') + LU.fmt(r.xp), 'Net XP', r.xp < 0)}${stat(r.missed, 'Missed', r.missed > 0)}</div></div>
        <div class="list" style="margin-top:12px">
          <div class="li"><div class="grow lt">Penalties</div><b class="num" style="color:var(--red)">−${LU.fmt(r.pen)} XP</b></div>
          <div class="li"><div class="grow lt">Focus sessions</div><b class="num">${r.focusN}</b></div>
          <div class="li"><div class="grow lt">Topics finished</div><b class="num">${r.topics}</b></div>
          <div class="li"><div class="grow lt">MCQ accuracy</div><b class="num">${r.mqN ? Math.round((r.mqOk / r.mqN) * 100) + '% (' + r.mqN + ')' : '–'}</b></div>
          <div class="li"><div class="grow lt">Mock tests</div><b class="num">${r.mocks ? r.mocks + ' · avg ' + Math.round(r.mockAvg) + '%' : '–'}</b></div>
          <div class="li"><div class="grow lt">Answers written</div><b class="num">${r.aw}</b></div>
          <div class="li"><div class="grow lt">Rest days used</div><b class="num">${r.rest}</b></div>
          <div class="li"><div class="grow lt">Money spent</div><b class="num">${rs(r.spent)}</b></div></div>
        ${subs.length ? `<div class="sec-title">Study by subject</div><div class="list">${subs.map((k) => `<div class="li"><div class="grow"><div class="lt">${k === '_' ? 'No subject' : esc((LU.subject(k) || { name: k }).name)}</div>${LU.bar(r.subj[k] / top)}</div><b class="num">${hrs(r.subj[k])}</b></div>`).join('')}</div>` : ''}
        <div style="display:flex;gap:10px;margin-top:14px"><button class="btn block" data-act="rpCopy">Copy as text</button><button class="btn ghost block" data-act="rpSave">${I('save')}Save file</button></div>
        <button class="btn ghost block" style="margin-top:10px" data-act="aiReview">${I('star')}AI review of this month</button>
        <div class="small muted" style="margin-top:8px">Paste the text into WhatsApp or notes to share it. The file goes to Download/LevelUp.</div><div style="height:20px"></div>`;
    },
  };
  LU.actions.openReport = () => { repMonth = today().slice(0, 7); LU.push('report'); };
  LU.actions.rpMonth = (el) => { repMonth = addMonth(repMonth, +el.dataset.n); LU.render(); };
  LU.actions.rpCopy = async () => LU.toast((await LU.copyText(LU.reportText(repMonth))) ? 'Report copied.' : 'Could not copy.');
  LU.actions.rpSave = () => { const w = LU.saveFileAs('LevelUp-report-' + repMonth + '.txt', 'text/plain', LU.reportText(repMonth)); LU.toast(/^Error/.test(w) ? w : 'Saved: ' + w, { ms: 4000 }); };

  /* ================= money: chart and CSV ================= */
  const MON = () => (LU.state.money && LU.state.money.entries) || [];
  LU.moneyChart = (m) => {
    const ds = monthDays(m), ent = MON().filter((e) => e.d.slice(0, 7) === m);
    if (!ent.length) return '';
    const per = ds.map((k) => { const l = ent.filter((e) => e.d === k); return { k, n: l.filter((e) => e.c === 'n').reduce((a, e) => a + e.a, 0), x: l.filter((e) => e.c === 'x').reduce((a, e) => a + e.a, 0) }; });
    const top = Math.max(1, ...per.map((p) => p.n + p.x)), W = 320, H = 120, bw = W / ds.length;
    const bars = per.map((p, i) => { const hn = (p.n / top) * (H - 14), hx = (p.x / top) * (H - 14), x = i * bw + 1; return `<rect x="${x.toFixed(1)}" y="${(H - 14 - hn).toFixed(1)}" width="${Math.max(1, bw - 2).toFixed(1)}" height="${hn.toFixed(1)}" fill="var(--cyan,#3fd0e0)"/><rect x="${x.toFixed(1)}" y="${(H - 14 - hn - hx).toFixed(1)}" width="${Math.max(1, bw - 2).toFixed(1)}" height="${hx.toFixed(1)}" fill="var(--gold,#f5c451)"/>`; }).join('');
    const tn = per.reduce((a, p) => a + p.n, 0), tx = per.reduce((a, p) => a + p.x, 0), tt = tn + tx || 1;
    return `<div class="sec-title">Spending chart</div><div class="card"><svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Spending per day">${bars}<text x="0" y="${H - 2}" font-size="9" fill="currentColor" opacity=".6">1</text><text x="${W}" y="${H - 2}" font-size="9" text-anchor="end" fill="currentColor" opacity=".6">${ds.length}</text></svg>
      <div class="small muted" style="margin:6px 0">Busiest day: ${rs(top)} · Blue: necessities · Gold: extra</div>
      <div style="display:flex;height:12px;border-radius:6px;overflow:hidden"><i style="width:${(tn / tt) * 100}%;background:var(--cyan,#3fd0e0)"></i><i style="width:${(tx / tt) * 100}%;background:var(--gold,#f5c451)"></i></div>
      <div style="display:flex;justify-content:space-between;margin-top:6px" class="small"><span>Necessities ${Math.round((tn / tt) * 100)}%</span><span>Extra ${Math.round((tx / tt) * 100)}%</span></div></div>`;
  };
  const csv = (list) => {
    const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    return '﻿Date,Category,Amount,Note\r\n' + list.slice().sort((a, b) => a.d < b.d ? -1 : 1).map((e) => [e.d, e.c === 'n' ? 'Daily necessities' : 'Extra', e.a, e.n || ''].map(q).join(',')).join('\r\n') + '\r\n';
  };
  LU.moneyCsv = (m) => csv(m ? MON().filter((e) => e.d.slice(0, 7) === m) : MON());
  LU.actions.monCsv = (el) => {
    const m = el.dataset.m || '';
    if (!MON().length) { LU.toast('No entries to export.'); return; }
    const w = LU.saveFileAs('LevelUp-money-' + (m || 'all') + '.csv', 'text/csv', LU.moneyCsv(m));
    LU.toast(/^Error/.test(w) ? w : 'Saved: ' + w + '. Open it in any spreadsheet app.', { ms: 5000 });
  };
  LU.moneyExtras = (m) => LU.moneyChart(m) + `<div style="display:flex;gap:10px;margin-top:12px"><button class="btn ghost block" data-act="monCsv" data-m="${m}">${I('save')}This month (CSV)</button><button class="btn ghost block" data-act="monCsv" data-m="">${I('save')}All (CSV)</button></div>`;

  /* ================= privacy ================= */
  const PRIVACY = `LevelUp stores everything on your phone only.
- Your tasks, XP, notes, PDFs, diary, recordings, money entries and settings stay on this device.
- LevelUp has no account, no ads and no analytics. It sends nothing to any server of its own.
- Internet is used only for map tiles when you open the map, and for the optional AI helper.
- AI helper (optional): if you add your own Google Gemini key, the text or page picture you choose to send goes to Google's Gemini service. Your diary, money entries and recordings are never sent. Without a key nothing is sent.
- Notifications, alarms, usage access and exact alarms are used only for your reminders, sleep and screen time tracking.
- Camera and microphone are used only when you scan a page or record audio, and the files stay on your phone.
- Backups are files you save to your Download folder. You decide where they go.
- Erase everything in More removes all LevelUp data from this phone.
Contact: gameandchill619@gmail.com`;
  LU.privacyText = () => PRIVACY;
  LU.views.privacy = {
    render() {
      return head('Privacy', 'Your data stays on this phone') + `<div class="card" style="white-space:pre-wrap;line-height:1.5">${esc(PRIVACY)}</div>
        <button class="btn ghost block" style="margin-top:12px" data-act="pvSave">${I('save')}Save as text file</button><div style="height:20px"></div>`;
    },
  };
  LU.actions.openPrivacy = () => LU.push('privacy');
  LU.actions.pvSave = () => { const w = LU.saveFileAs('LevelUp-privacy-policy.txt', 'text/plain', 'LevelUp privacy policy\n\n' + PRIVACY); LU.toast(/^Error/.test(w) ? w : 'Saved: ' + w); };

  /* ================= screen rotation ================= */
  /* 'reader' = rotates only while a PDF is open (default), 'always', or 'off'. Follows the phone's auto-rotate switch. */
  const rotMode = () => (LU.state.settings.rotate || 'reader');
  let inReader = false;
  LU.orient = (reader) => {
    if (reader !== undefined) inReader = !!reader;
    const m = rotMode(), want = m === 'always' || (m === 'reader' && inReader);
    try { if (window.Android && Android.setOrientation) Android.setOrientation(want ? 'auto' : 'portrait'); } catch (e) {}
  };
  setTimeout(() => LU.orient(), 400);
  LU.actions.rotPick = () => LU.sheet({
    title: 'Screen rotation',
    body: `<p class="small muted" style="margin:0 0 8px">Rotation also needs auto-rotate switched on in your phone's quick settings.</p><div class="list">${[['reader', 'Only while reading a PDF', 'Everything else stays upright'], ['always', 'Everywhere', 'The whole app rotates'], ['off', 'Never', 'Always upright']].map(([k, t, sub]) => `<div class="li" data-rot="${k}"><div class="grow"><div class="lt">${t}</div><div class="ls">${sub}</div></div>${rotMode() === k ? I('check') : ''}</div>`).join('')}</div>`,
    mount: (s) => LU.$$('[data-rot]', s).forEach((r) => (r.onclick = () => { LU.state.settings.rotate = r.dataset.rot; LU.save(); LU.orient(); LU.closeSheet(); LU.render(); })),
  });

  /* ================= More page ================= */
  const prev = LU.more3;
  LU.more3 = () => `
      <div class="sec-title">Progress and rewards</div>
      <div class="list">
        ${li('openStudyTime', 'clock', 'Study time', 'Hours by subject, neglected subjects')}
        ${li('openReport', 'chart', 'Monthly report', 'One page summary you can copy or save')}
        ${li('openShop', 'star', 'Reward shop', LU.fmt(LU.wallet()) + ' XP to spend')}
        ${li('rotPick', 'phone', 'Screen rotation', { reader: 'Only while reading a PDF', always: 'Everywhere', off: 'Never' }[rotMode()])}
        ${li('openRefs', 'book', 'Reference books', 'Constitution and other printed books, searchable')}
        ${li('openPrivacy', 'lock', 'Privacy', 'Everything stays on this phone')}
      </div>` + prev();
})();
