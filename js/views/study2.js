/* Part 10: study tools. Spaced revision, coverage map, mock-test log, answer-writing tracker, current-affairs notebook. */
(function () {
  const LU = window.LU, esc = LU.esc, I = LU.icon;
  const S = () => LU.state;
  const today = () => LU.todayKey();
  const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const shortDate = (k) => { const d = LU.parseKey(k); return d.getDate() + ' ' + MN[d.getMonth()]; };
  const dayXp = (key, n, cap) => { const d = LU.day(today()); const got = d[key] || 0; const give = Math.max(0, Math.min(n, cap - got)); if (give > 0) { d[key] = got + give; LU.gainXP(give); } return give; };

  /* =========================================================
     1. Spaced revision: 1, 7, 30 and 90 days after a topic is ticked
     ========================================================= */
  const STAGES = [1, 7, 30, 90];
  const R = () => { const s = S(); if (!s.rev || !s.rev.items) s.rev = { items: {} }; return s.rev; };
  LU.revDue = (k) => { k = k || today(); const o = R().items; return Object.keys(o).filter((id) => !o[id].fin && o[id].due <= k && LU.node(id)).sort((a, b) => o[a].due.localeCompare(o[b].due)); };
  const schedule = (id) => { const it = R().items; if (!it[id]) it[id] = { s: today(), st: 0, due: LU.addDays(today(), STAGES[0]) }; };
  /* every time a single topic is ticked or unticked, keep its revision plan in step */
  const origToggle = LU.toggleTopic;
  LU.toggleTopic = (id) => {
    const r = origToggle(id);
    if (r && r.count === 1) { if (r.done) schedule(id); else delete R().items[id]; LU.save(); }
    return r;
  };
  LU.revCard = () => {
    const n = LU.revDue().length;
    if (!n) return '';
    return `<div class="card tap" data-act="openRevDue" style="display:flex;align-items:center;gap:12px"><span class="lic">${I('loop')}</span><div class="grow"><div class="lt">Revision due: ${n} topic${n > 1 ? 's' : ''}</div><div class="small muted">Tap to revise and tick them off</div></div><span class="chev">${I('chev')}</span></div>`;
  };

  const stageTxt = (it) => 'Revision ' + (it.st + 1) + ' of ' + STAGES.length;
  LU.views.revdue = {
    render() {
      const due = LU.revDue(), o = R().items, k = today();
      const up = Object.keys(o).filter((id) => !o[id].fin && o[id].due > k).length;
      const total = Object.keys(o).length, fin = Object.keys(o).filter((id) => o[id].fin).length;
      const row = (id) => {
        const it = o[id], sub = LU.subjOf(id), late = LU.diffDays(it.due, k);
        return `<div class="li"><span class="lic">${I('loop')}</span><div class="grow"><div class="lt">${esc(LU.node(id).t)}</div><div class="ls">${esc(sub ? sub.name : '')} · ${stageTxt(it)}${late > 0 ? ' · ' + late + ' day' + (late > 1 ? 's' : '') + ' late' : ''}</div></div>
          <button class="btn sm" data-act="revDone" data-id="${id}">Revised</button><button class="btn ghost sm" data-act="revLater" data-id="${id}" style="margin-left:6px">Later</button></div>`;
      };
      return `<div class="topbar"><button class="iconbtn" data-act="back">${I('back')}</button><h1>Revision<span class="sub">1, 7, 30 and 90 days after you finish a topic</span></h1></div>
        <div class="list"><div class="li"><div class="grow lt">Due now</div><b class="num">${due.length}</b></div><div class="li"><div class="grow lt">Coming up</div><b class="num">${up}</b></div><div class="li"><div class="grow lt">Fully revised</div><b class="num">${fin} / ${total}</b></div></div>
        <div class="sec-title">Due now</div>
        <div class="list">${due.slice(0, 60).map(row).join('') || `<div class="li"><div class="grow small muted">Nothing to revise today. Topics you tick in the syllabus appear here the next day.</div></div>`}</div>
        ${due.length > 60 ? `<div class="small muted" style="padding:8px 2px">Showing 60 of ${due.length}. Finish these first.</div>` : ''}
        <div class="card small muted" style="margin-top:14px"><b>Already finished topics?</b><br>Topics you ticked before this feature are not scheduled. Spread them over the next three weeks so you revise them gradually.<div style="margin-top:10px"><button class="btn ghost sm" data-act="revImport">${I('loop')}Schedule my finished topics</button></div></div>
        <div style="height:20px"></div>`;
    },
  };
  LU.actions.openRevDue = () => LU.push('revdue');
  LU.actions.revDone = (el) => {
    const it = R().items[el.dataset.id]; if (!it) return;
    it.st++; LU.gainXP(5); LU.log('Revised: ' + (LU.node(el.dataset.id) || {}).t, 5);
    const d = LU.day(today()); d.revs = (d.revs || 0) + 1;
    if (it.st >= STAGES.length) { it.fin = true; delete it.due; } else it.due = LU.addDays(today(), STAGES[it.st]);
    LU.vibrate && LU.vibrate(15); LU.save(); LU.render();
  };
  LU.actions.revLater = (el) => { const it = R().items[el.dataset.id]; if (!it) return; it.due = LU.addDays(today(), 1); LU.save(); LU.render(); };
  LU.actions.revImport = () => {
    const o = R().items; let n = 0;
    const ids = [];
    LU.syllabus.forEach((s) => LU.subjLeaves(s).forEach((l) => { if (LU.isDone(l.i) && !o[l.i]) ids.push(l.i); }));
    ids.forEach((id, i) => { o[id] = { s: today(), st: 1, due: LU.addDays(today(), 1 + Math.floor(i / Math.max(8, Math.ceil(ids.length / 21)))) }; n++; });
    LU.save(); LU.toast(n ? n + ' topics scheduled over the next three weeks.' : 'No unscheduled finished topics found.'); LU.render();
  };

  /* =========================================================
     2. Coverage map
     ========================================================= */
  const covStatus = (id) => {
    if (!LU.isDone(id)) return 0;
    const it = R().items[id];
    if (!it) return 1;
    return it.fin || it.st >= 3 ? 3 : it.st >= 1 ? 2 : 1;
  };
  LU.views.coverage = {
    render() {
      const subs = LU.syllabus.filter((s) => LU.subjLeaves(s).length);
      const all = { 0: 0, 1: 0, 2: 0, 3: 0 };
      const rows = subs.map((s) => {
        const ls = LU.subjLeaves(s), c = { 0: 0, 1: 0, 2: 0, 3: 0 };
        const cells = ls.map((l) => { const st = covStatus(l.i); c[st]++; all[st]++; return `<i class="cov c${st}"></i>`; }).join('');
        return `<div class="card covc" data-act="openSubj" data-id="${s.id}"><div style="display:flex;justify-content:space-between;gap:8px"><div class="lt">${esc(s.name)}</div><div class="small muted">${Math.round(((ls.length - c[0]) / ls.length) * 100)}% learned</div></div>
          <div class="covg">${cells}</div><div class="small muted" style="margin-top:6px">${c[3]} strong · ${c[2]} revised · ${c[1]} learned · ${c[0]} not started</div></div>`;
      }).join('');
      return `<div class="topbar"><button class="iconbtn" data-act="back">${I('back')}</button><h1>Coverage map<span class="sub">Every topic as one square</span></h1></div>
        <div class="card"><div class="covleg"><span><i class="cov c0"></i>Not started ${all[0]}</span><span><i class="cov c1"></i>Learned ${all[1]}</span><span><i class="cov c2"></i>Revised ${all[2]}</span><span><i class="cov c3"></i>Strong ${all[3]}</span></div>
        <div class="small muted" style="margin-top:8px">Learned = ticked. Revised = one revision done. Strong = revised three times (up to 30 days apart).</div></div>${rows}<div style="height:20px"></div>`;
    },
  };
  LU.actions.openCoverage = () => LU.push('coverage');

  /* =========================================================
     3. Mock test log
     ========================================================= */
  const MK = () => { const s = S(); if (!Array.isArray(s.mocks)) s.mocks = []; return s.mocks; };
  const MAXES = { 'Prelims GS': 200, CSAT: 200, Mains: 250, Other: 100 };
  const pctOf = (m) => (m.max ? Math.round((m.score / m.max) * 1000) / 10 : 0);
  const parseSecs = (t) => String(t || '').split('\n').map((l) => { const m = l.match(/^(.*?)[\s:,-]+(-?[\d.]+)\s*\/\s*([\d.]+)\s*$/); return m ? { n: m[1].trim(), s: +m[2], m: +m[3] } : null; }).filter((x) => x && x.n && x.m > 0);
  const lineChart = (rows) => {
    if (rows.length < 2) return `<div class="small muted" style="padding:10px 2px">Add at least two tests to see the graph.</div>`;
    const W = 320, H = 140, pl = 30, pb = 20, pt = 10, ys = rows.map((r) => r.p), lo = Math.max(0, Math.floor(Math.min(...ys) / 10) * 10 - 10), hi = Math.min(100, Math.ceil(Math.max(...ys) / 10) * 10 + 10);
    const x = (i) => pl + ((W - pl - 8) * i) / (rows.length - 1), y = (v) => pt + (H - pt - pb) * (1 - (v - lo) / (hi - lo || 1));
    let g = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Mock test scores">`;
    [lo, (lo + hi) / 2, hi].forEach((t) => { g += `<line x1="${pl}" x2="${W}" y1="${y(t)}" y2="${y(t)}" stroke="rgba(142,164,198,.16)"/><text x="${pl - 4}" y="${y(t) + 3}" text-anchor="end" fill="var(--muted)" font-size="9">${Math.round(t)}%</text>`; });
    g += `<polyline fill="none" stroke="var(--cyan)" stroke-width="2.2" stroke-linejoin="round" points="${rows.map((r, i) => x(i) + ',' + y(r.p)).join(' ')}"/>`;
    rows.forEach((r, i) => { g += `<circle cx="${x(i)}" cy="${y(r.p)}" r="3.2" fill="var(--gold)"/>`; });
    return g + `</svg>`;
  };
  LU.views.mocks = {
    render() {
      const ms = MK().slice().sort((a, b) => a.d.localeCompare(b.d) || (a.at || 0) - (b.at || 0));
      const rows = ms.map((m) => ({ p: pctOf(m) }));
      const avg = ms.length ? Math.round((rows.reduce((a, r) => a + r.p, 0) / ms.length) * 10) / 10 : 0;
      const last3 = rows.slice(-3), best = ms.length ? Math.max(...rows.map((r) => r.p)) : 0;
      const sec = {};
      ms.forEach((m) => (m.secs || []).forEach((x) => { const e = (sec[x.n.toLowerCase()] = sec[x.n.toLowerCase()] || { n: x.n, s: 0, m: 0, c: 0 }); e.s += x.s; e.m += x.m; e.c++; }));
      const secRows = Object.values(sec).map((e) => ({ n: e.n, p: Math.round((e.s / e.m) * 100), c: e.c })).sort((a, b) => a.p - b.p);
      return `<div class="topbar"><button class="iconbtn" data-act="back">${I('back')}</button><h1>Mock tests<span class="sub">Scores and weak subjects</span></h1><button class="btn sm" data-act="mkAdd" style="margin-left:auto">${I('plus')}Add</button></div>
        <div class="card"><div class="small muted">Score over time (%)</div>${lineChart(rows)}</div>
        <div class="list" style="margin-top:12px"><div class="li"><div class="grow lt">Tests taken</div><b class="num">${ms.length}</b></div><div class="li"><div class="grow lt">Average</div><b class="num">${avg}%</b></div><div class="li"><div class="grow lt">Best</div><b class="num">${best}%</b></div><div class="li"><div class="grow lt">Last three average</div><b class="num">${last3.length ? Math.round((last3.reduce((a, r) => a + r.p, 0) / last3.length) * 10) / 10 : 0}%</b></div></div>
        ${secRows.length ? `<div class="sec-title">By subject (weakest first)</div><div class="card">${secRows.map((r) => `<div style="margin:6px 0"><div style="display:flex;justify-content:space-between"><span class="small">${esc(r.n)} <span class="muted">· ${r.c} test${r.c > 1 ? 's' : ''}</span></span><b class="num">${r.p}%</b></div>${LU.bar(r.p / 100, r.p < 50 ? 'red' : r.p < 70 ? 'gold' : 'thin')}</div>`).join('')}</div>` : ''}
        <div class="sec-title">All tests</div>
        <div class="list">${ms.slice().reverse().map((m) => `<div class="li" data-act="mkEdit" data-id="${m.id}"><div class="grow"><div class="lt">${esc(m.name || m.kind)}</div><div class="ls">${shortDate(m.d)} · ${esc(m.kind)}</div></div><b class="num">${m.score}/${m.max}</b><span class="pill">${pctOf(m)}%</span><span class="chev">${I('chev')}</span></div>`).join('') || `<div class="li"><div class="grow small muted">No tests yet. Add your first score after a mock.</div></div>`}</div>
        <div style="height:20px"></div>`;
    },
  };
  LU.actions.openMocks = () => LU.push('mocks');
  const mkSheet = (m) => {
    const isNew = !m.id; let kind = m.kind;
    LU.sheet({
      title: isNew ? 'Add a mock test' : 'Edit mock test',
      body: `<div class="field"><label>Name</label><input class="inp" id="mkN" maxlength="50" placeholder="e.g. Vision Test 4" value="${esc(m.name || '')}"></div>
        <div class="field"><label>Type</label><div class="seg" id="mkK">${Object.keys(MAXES).map((k) => `<button type="button" data-k="${k}" class="${kind === k ? 'on' : ''}">${k}</button>`).join('')}</div></div>
        <div class="field"><label>Date</label><input class="inp" id="mkD" type="date" value="${m.d}"></div>
        <div style="display:flex;gap:10px"><div class="field" style="flex:1"><label>Score</label><input class="inp" id="mkS" type="number" inputmode="decimal" step="any" value="${m.score === '' ? '' : m.score}"></div><div class="field" style="flex:1"><label>Out of</label><input class="inp" id="mkM" type="number" inputmode="decimal" step="any" value="${m.max}"></div></div>
        <div class="field"><label>Subject scores (optional, one per line)</label><textarea class="inp" id="mkX" placeholder="Polity 12/20&#10;History 8/20">${esc((m.secs || []).map((x) => x.n + ' ' + x.s + '/' + x.m).join('\n'))}</textarea></div>`,
      foot: `${isNew ? `<button class="btn ghost" data-act="closeSheet">Cancel</button>` : `<button class="btn danger" id="mkDel">Delete</button>`}<button class="btn" id="mkOk">Save</button>`,
      mount: (s) => {
        LU.$$('#mkK button', s).forEach((b) => (b.onclick = () => { kind = b.dataset.k; LU.$$('#mkK button', s).forEach((x) => x.classList.toggle('on', x === b)); if (isNew) LU.$('#mkM', s).value = MAXES[kind]; }));
        LU.$('#mkOk', s).onclick = () => {
          const score = parseFloat(LU.$('#mkS', s).value), max = parseFloat(LU.$('#mkM', s).value), d = LU.$('#mkD', s).value;
          if (isNaN(score) || !(max > 0) || !d) { LU.toast('Fill in the date, score and total.'); return; }
          const rec = { name: LU.$('#mkN', s).value.trim(), kind, d, score, max, secs: parseSecs(LU.$('#mkX', s).value) };
          if (isNew) { MK().push(Object.assign({ id: LU.uid(), at: Date.now(), xp: 30 }, rec)); LU.gainXP(30); LU.log('Mock test logged', 30); }
          else Object.assign(MK().find((x) => x.id === m.id) || {}, rec);
          LU.save(); LU.closeSheet(); LU.render();
        };
        const dl = LU.$('#mkDel', s);
        if (dl) dl.onclick = () => { const o = MK().find((x) => x.id === m.id); if (o && o.xp) LU.gainXP(-o.xp); S().mocks = MK().filter((x) => x.id !== m.id); LU.save(); LU.closeSheet(); LU.render(); };
      },
    });
  };
  LU.actions.mkAdd = () => mkSheet({ kind: 'Prelims GS', d: today(), score: '', max: MAXES['Prelims GS'], name: '', secs: [] });
  LU.actions.mkEdit = (el) => { const m = MK().find((x) => x.id === el.dataset.id); if (m) mkSheet(Object.assign({}, m)); };

  /* =========================================================
     4. Answer-writing tracker
     ========================================================= */
  const AW = () => { const s = S(); s.aw = Object.assign({ target: 1, log: {} }, s.aw || {}); return s.aw; };
  const awHit = (k) => (AW().log[k] || 0) >= AW().target;
  const awStreak = () => { let k = today(), n = 0; if (!awHit(k)) k = LU.addDays(k, -1); while (awHit(k)) { n++; k = LU.addDays(k, -1); } return n; };
  LU.views.answers = {
    render() {
      const a = AW(), k = today(), n = a.log[k] || 0, w = LU.weekKey(k);
      const days = []; for (let i = 0; i < 14; i++) days.push(LU.addDays(k, i - 13));
      const mx = Math.max(a.target, ...days.map((d) => a.log[d] || 0), 1);
      const weekN = Array.from({ length: 7 }, (_, i) => a.log[LU.addDays(w, i)] || 0).reduce((x, y) => x + y, 0);
      const total = Object.values(a.log).reduce((x, y) => x + y, 0);
      return `<div class="topbar"><button class="iconbtn" data-act="back">${I('back')}</button><h1>Answer writing<span class="sub">Practise a little every day</span></h1></div>
        <div class="card" style="text-align:center"><div class="small muted">Today</div><div style="font:800 54px var(--fd);line-height:1.1;margin:4px 0">${n}<span class="muted" style="font-size:22px"> / ${a.target}</span></div>
          ${LU.bar(Math.min(1, n / a.target), n >= a.target ? 'gold' : '')}
          <div style="display:flex;gap:10px;justify-content:center;margin-top:14px"><button class="btn ghost" data-act="awAdd" data-n="-1" ${n ? '' : 'disabled'}>−1</button><button class="btn" data-act="awAdd" data-n="1" style="min-width:150px">${I('plus')}I wrote an answer</button></div>
          <div class="small muted" style="margin-top:10px">+10 XP for each answer up to your daily target.</div></div>
        <div class="list" style="margin-top:12px"><div class="li" data-act="awTarget"><span class="lic">${I('flag')}</span><div class="grow"><div class="lt">Daily target</div><div class="ls">${a.target} answer${a.target > 1 ? 's' : ''} a day</div></div><span class="chev">${I('chev')}</span></div>
          <div class="li"><div class="grow lt">Target streak</div><b class="num">${awStreak()} day${awStreak() === 1 ? '' : 's'}</b></div><div class="li"><div class="grow lt">This week</div><b class="num">${weekN}</b></div><div class="li"><div class="grow lt">All time</div><b class="num">${total}</b></div></div>
        <div class="sec-title">Last 14 days</div><div class="card"><div class="awbars">${days.map((d) => { const c = a.log[d] || 0; return `<div class="awb"><i class="${c >= a.target ? 'ok' : ''}" style="height:${Math.round((c / mx) * 100)}%"></i><small>${LU.parseKey(d).getDate()}</small></div>`; }).join('')}</div></div>
        <div style="height:20px"></div>`;
    },
  };
  LU.actions.openAnswers = () => LU.push('answers');
  LU.actions.awAdd = (el) => {
    const a = AW(), k = today(), d = +el.dataset.n, n = a.log[k] || 0;
    if (d > 0) { a.log[k] = n + 1; if (n + 1 <= a.target) { LU.gainXP(10); LU.log('Answer written', 10); } }
    else if (n > 0) { a.log[k] = n - 1; if (n <= a.target) { LU.gainXP(-10); LU.log('Undid an answer', -10); } if (!a.log[k]) delete a.log[k]; }
    LU.vibrate && LU.vibrate(12); LU.save(); LU.render();
  };
  LU.actions.awTarget = () => LU.sheet({
    title: 'Daily answer target', body: `<div class="seg" id="awT">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-n="${n}" class="${AW().target === n ? 'on' : ''}">${n}</button>`).join('')}</div><p class="small muted" style="margin-top:12px">Mains needs steady practice. One answer a day is a good start.</p>`,
    mount: (s) => LU.$$('#awT button', s).forEach((b) => (b.onclick = () => { AW().target = +b.dataset.n; LU.save(); LU.closeSheet(); LU.render(); })),
  });

  /* =========================================================
     5. Current-affairs notebook
     ========================================================= */
  const CA = () => { const s = S(); if (!Array.isArray(s.ca)) s.ca = []; return s.ca; };
  let caQ = '', caSubj = 'all';
  const caListHtml = () => {
    const all = CA().slice().sort((x, y) => y.t - x.t), q = caQ.trim().toLowerCase();
    const list = all.filter((n) => (caSubj === 'all' || n.subj === caSubj) && (!q || n.text.toLowerCase().includes(q)));
    let lastM = '';
    const body = list.slice(0, 150).map((n) => {
      const dk = LU.keyOf(new Date(n.t - 3 * 3600e3)), m = dk.slice(0, 7);
      const head = m !== lastM ? ((lastM = m), `<div class="sec-title">${MN[+m.slice(5) - 1]} ${m.slice(0, 4)}</div>`) : '';
      const sub = n.subj ? LU.subject(n.subj) : null;
      return head + `<div class="card tap" data-act="caEdit" data-id="${n.id}"><div class="small muted" style="margin-bottom:4px">${shortDate(dk)}${sub ? ' · ' + esc(sub.name) : ''}</div><div style="white-space:pre-wrap;line-height:1.45">${esc(n.text)}</div></div>`;
    }).join('');
    return body || `<div class="empty">${I('news')}${all.length ? 'No notes match.' : 'No notes yet. Tap Add to save a news point.'}</div>`;
  };
  LU.views.ca = {
    render() {
      const all = CA();
      const used = []; all.forEach((n) => { if (n.subj && !used.includes(n.subj)) used.push(n.subj); });
      return `<div class="topbar"><button class="iconbtn" data-act="back">${I('back')}</button><h1>Current affairs<span class="sub">${all.length} note${all.length === 1 ? '' : 's'}</span></h1><button class="btn sm" data-act="caAdd" style="margin-left:auto">${I('plus')}Add</button></div>
        <input class="inp" id="caQ" placeholder="Search notes" value="${esc(caQ)}" style="margin-bottom:10px">
        <div class="chips"><button class="chip ${caSubj === 'all' ? 'on' : ''}" data-act="caFilter" data-s="all">All</button>${used.map((id) => `<button class="chip ${caSubj === id ? 'on' : ''}" data-act="caFilter" data-s="${id}">${esc((LU.subject(id) || { name: id }).name)}</button>`).join('')}</div>
        <div id="caList">${caListHtml()}</div><div style="height:20px"></div>`;
    },
    mount(el) {
      const inp = LU.$('#caQ', el); if (!inp) return;
      inp.oninput = () => { caQ = inp.value; const l = LU.$('#caList', el); if (l) l.innerHTML = caListHtml(); };
    },
  };
  LU.actions.openCA = () => { caQ = ''; caSubj = 'all'; LU.push('ca'); };
  LU.actions.caFilter = (el) => { caSubj = el.dataset.s; LU.render(); };
  const caSheet = (n) => {
    const isNew = !n.id; let subj = n.subj || '';
    const subs = LU.syllabus.filter((s) => LU.subjLeaves(s).length);
    LU.sheet({
      title: isNew ? 'New current-affairs note' : 'Edit note',
      body: `<div class="field"><label>What happened / what to remember</label><textarea class="inp" id="caT" maxlength="1500" placeholder="Type the news point, the fact or the link to a topic">${esc(n.text || '')}</textarea></div>
        <div class="field"><label>Subject (optional)</label><div class="chips" id="caS" style="margin:0 -2px;padding-left:2px">${subs.map((s) => `<button type="button" class="chip ${subj === s.id ? 'on' : ''}" data-id="${s.id}">${esc(s.name)}</button>`).join('')}</div></div>`,
      foot: `${isNew ? `<button class="btn ghost" data-act="closeSheet">Cancel</button>` : `<button class="btn danger" id="caDel">Delete</button>`}<button class="btn" id="caOk">Save</button>`,
      mount: (s) => {
        LU.$$('#caS .chip', s).forEach((b) => (b.onclick = () => { subj = subj === b.dataset.id ? '' : b.dataset.id; LU.$$('#caS .chip', s).forEach((x) => x.classList.toggle('on', x.dataset.id === subj)); }));
        LU.$('#caOk', s).onclick = () => {
          const text = LU.$('#caT', s).value.trim(); if (!text) { LU.toast('Type something first.'); return; }
          if (isNew) { CA().push({ id: LU.uid(), t: Date.now(), text, subj }); if (dayXp('caXp', 3, 15)) LU.log('Current-affairs note', 3); }
          else Object.assign(CA().find((x) => x.id === n.id) || {}, { text, subj });
          LU.save(); LU.closeSheet(); LU.render();
        };
        const dl = LU.$('#caDel', s); if (dl) dl.onclick = () => { S().ca = CA().filter((x) => x.id !== n.id); LU.save(); LU.closeSheet(); LU.render(); };
        if (isNew) setTimeout(() => LU.focusField && LU.focusField(LU.$('#caT', s)), 350);
      },
    });
  };
  LU.actions.caAdd = () => caSheet({ text: '', subj: caSubj === 'all' ? '' : caSubj });
  LU.actions.caEdit = (el) => { const n = CA().find((x) => x.id === el.dataset.id); if (n) caSheet(Object.assign({}, n)); };
})();
