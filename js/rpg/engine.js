/* RPG engine (plain JS, no UI). Everything the RPG look and the daily goals need:
   - device settings for the look (theme, animations, sound)
   - daily goals, and how work done in the app is counted against them
   - coverage: extra work fills the oldest missed days first, then up to "credit ahead" coming days
   - auto-tick of real quests (study blocks, answer writing) when the work was done
   - the backlog, the daily report, weight log, and the numbers the graphs draw
   Game rules (XP, penalties, levels) are untouched: this file only calls the existing LU.complete / LU.gainXP etc. */
(function () {
  const LU = window.LU;
  const R = (LU.rpg = LU.rpg || {});

  /* ---------- device settings (not synced: the iPad keeps Classic) ---------- */
  const UIKEY = 'levelup.rpg.ui';
  const UI0 = { look: 'classic', theme: 'crimsongold', anim: 'full', sfx: true, vib: true, scale: 'smart', gstyle: 'detailed', ambient: true, range: 'auto', gtype: {}, ghide: {}, proj: true, intro: true, report: true, weightPrompt: true };
  let ui = null;
  R.ui = () => {
    if (!ui) { try { ui = Object.assign({}, UI0, JSON.parse(localStorage.getItem(UIKEY) || '{}')); } catch (e) { ui = Object.assign({}, UI0); } ui.gtype = ui.gtype || {}; ui.ghide = ui.ghide || {}; }
    return ui;
  };
  R.setUI = (p) => { Object.assign(R.ui(), p); try { localStorage.setItem(UIKEY, JSON.stringify(ui)); } catch (e) {} R.paint(); if (R.onUI) R.onUI(); };
  R.on = () => R.ui().look === 'rpg';

  /* ---------- themes ---------- */
  /* a: main accent, b: second accent, up/down: the two graph lines (completed above, missed below) */
  const T = (n, bg, p, p2, ln, a, b, up, down, tx, mu, dg) => ({ n, bg, p, p2, ln, a, b, up, down, tx, mu, dg: dg || '#FF5D7A' });
  R.THEMES = {
    crimsongold: T('Crimson & Gold', '#0A0707', '#151010', '#1D1515', '#4A1A1A', '#DC143C', '#D4A24C', '#D4A24C', '#DC143C', '#F4EDE4', '#9A8F86', '#FF3B5C'),
    violet: T('Void Violet', '#08060D', '#120E1C', '#1A1428', '#2A1F45', '#8B5CF6', '#F472B6', '#A78BFA', '#F472B6', '#EEEAF7', '#8C86A3'),
    emerald: T('Toxic Emerald', '#050A08', '#0C1512', '#11201B', '#17382B', '#10B981', '#BEF264', '#BEF264', '#10B981', '#E6F4EE', '#7E9A8E', '#F43F5E'),
    steel: T('Arctic Steel', '#0A0D12', '#12171F', '#1A212C', '#232C3A', '#60A5FA', '#E2E8F0', '#E2E8F0', '#60A5FA', '#F1F5F9', '#8493A8', '#FB7185'),
    teal: T('Ocean Teal', '#041012', '#0A1C20', '#102A30', '#164048', '#2DD4BF', '#38BDF8', '#5EEAD4', '#38BDF8', '#E6FAF8', '#80A8A8'),
    amber: T('Sunset Amber', '#0C0704', '#181008', '#22160B', '#4A2E12', '#F59E0B', '#FB923C', '#FBBF24', '#F97316', '#FFF3E0', '#B79A7A', '#FF5D5D'),
    rose: T('Rose Neon', '#0D0610', '#180C1C', '#221128', '#4A1F55', '#F472B6', '#22D3EE', '#22D3EE', '#F472B6', '#FCEBFF', '#A98BB5'),
    mono: T('Mono Ghost', '#060606', '#101010', '#181818', '#2A2A2A', '#E5E5E5', '#9CA3AF', '#F5F5F5', '#737373', '#F2F2F2', '#8A8A8A'),
  };
  const h2r = (h) => { h = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
  const mixc = (a, b, t) => { const x = h2r(a), y = h2r(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const lumc = (h) => { const [r, g, b] = h2r(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
  R.theme = () => R.THEMES[R.ui().theme] || R.THEMES.crimsongold;

  /* map the RPG theme onto the app's existing colour variables, so every old screen follows it too */
  R.paint = () => {
    const root = document.documentElement, on = R.on();
    root.setAttribute('data-look', on ? 'rpg' : 'classic');
    if (document.body) document.body.classList.toggle('rpg', on);
    root.setAttribute('data-ranim', R.ui().anim);
    root.setAttribute('data-rtheme', on ? R.ui().theme : '');
    if (!on) return;
    const t = R.theme(), V = {};
    V['--abyss'] = t.bg; V['--deep'] = mixc(t.bg, t.p, 0.5); V['--panel'] = t.p; V['--panel2'] = t.p2; V['--raise'] = mixc(t.p2, t.a, 0.12);
    V['--text'] = t.tx; V['--muted'] = t.mu; V['--dim'] = mixc(t.mu, t.bg, 0.45);
    V['--cyan'] = t.a; V['--blue'] = t.b; V['--gold'] = t.up; V['--violet'] = t.b; V['--red'] = t.dg; V['--green'] = t.up;
    const rgb = (h) => h2r(h).join(', ');
    V['--ac-rgb'] = rgb(t.a); V['--bl-rgb'] = rgb(t.b); V['--gd-rgb'] = rgb(t.up); V['--vi-rgb'] = rgb(t.b); V['--rd-rgb'] = rgb(t.dg); V['--gn-rgb'] = rgb(t.up); V['--mu-rgb'] = rgb(t.mu);
    V['--ln-rgb'] = rgb(mixc(t.ln, t.tx, 0.35)); V['--line'] = t.ln; V['--line2'] = mixc(t.ln, t.a, 0.35);
    V['--ab-rgb'] = rgb(t.bg); V['--dp-rgb'] = rgb(mixc(t.bg, t.p, 0.5)); V['--sh-rgb'] = rgb(mixc(t.bg, t.p, 0.75));
    V['--ac2'] = mixc(t.a, '#ffffff', 0.35); V['--on-ac'] = lumc(t.a) > 0.55 ? '#08080a' : '#ffffff'; V['--gd2'] = mixc(t.up, '#ffffff', 0.4); V['--stage'] = t.p;
    V['--glow'] = R.ui().anim === 'off' ? '0' : '0.5';
    V['--up'] = t.up; V['--down'] = t.down; V['--up-rgb'] = rgb(t.up); V['--down-rgb'] = rgb(t.down);
    Object.keys(V).forEach((k) => root.style.setProperty(k, V[k]));
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = t.bg;
  };
  R.hookTheme = () => {
    if (!LU.theme || LU.theme._rpgHooked) return;
    const a = LU.theme.apply; LU.theme._rpgHooked = true;
    LU.theme.apply = function () { const r = a.apply(this, arguments); if (R.on()) R.paint(); return r; };
  };

  /* ---------- sound and haptics (own switches, on top of the app's own) ---------- */
  let actx;
  const tone = (f, at, len, type, vol) => {
    const o = actx.createOscillator(), g = actx.createGain(), n = actx.currentTime + at;
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, n);
    g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(vol || 0.1, n + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, n + len);
    o.connect(g).connect(actx.destination); o.start(n); o.stop(n + len + 0.05);
  };
  R.sfx = (kind) => {
    if (!R.ui().sfx || !LU.state || !LU.state.settings.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      if (kind === 'boot') { tone(110, 0, 0.7, 'sawtooth', 0.04); tone(220, 0.1, 0.6, 'sine', 0.06); tone(880, 0.35, 0.3, 'triangle', 0.05); tone(1320, 0.5, 0.35, 'sine', 0.05); }
      else if (kind === 'ping') { tone(1046, 0, 0.14, 'sine', 0.08); tone(1568, 0.09, 0.3, 'sine', 0.07); }
      else if (kind === 'fail') { tone(196, 0, 0.35, 'sawtooth', 0.07); tone(147, 0.18, 0.5, 'sawtooth', 0.07); tone(98, 0.38, 0.7, 'square', 0.05); }
      else if (kind === 'alarm') { for (let i = 0; i < 3; i++) { tone(440, i * 0.22, 0.12, 'square', 0.05); tone(330, i * 0.22 + 0.11, 0.12, 'square', 0.05); } }
      else if (kind === 'tick') { tone(1400, 0, 0.04, 'triangle', 0.04); }
      else if (kind === 'swoosh') { tone(300, 0, 0.18, 'sine', 0.03); tone(600, 0.06, 0.2, 'sine', 0.025); }
    } catch (e) {}
  };
  R.vib = (ms) => { if (R.ui().vib && LU.vibrate) LU.vibrate(ms); };

  /* ---------- data kept in the saved state (synced with the iPad too) ---------- */
  const D0 = () => ({ v: 1, since: '', ahead: 7, goals: {}, hist: {}, last: {}, amt: { mcq: {}, cards: {}, diary: {}, rs: {}, tp: {}, est: {}, mcqok: {} }, auto: {}, man: {}, tgt: { pushups: 100000, situps: 50000 }, w: { on: true, day: 0, log: {}, asked: '', goal: 0 }, rep: {}, bf: 0 });
  R.data = () => {
    const s = LU.state, r = (s.rpg = s.rpg || {}), d = D0();
    Object.keys(d).forEach((k) => {
      if (r[k] === undefined) r[k] = d[k];
      else if (d[k] && typeof d[k] === 'object' && !Array.isArray(d[k])) Object.keys(d[k]).forEach((j) => { if (r[k][j] === undefined) r[k][j] = d[k][j]; });
    });
    return r;
  };
  const ST = () => LU.state.settings;
  const AW = () => { const s = LU.state; s.aw = Object.assign({ target: 1, log: {} }, s.aw || {}); return s.aw; };
  const num = (v, d) => { v = Math.round(+v); return v > 0 ? v : d; };

  /* ---------- the goals ---------- */
  /* amt(k): what was done on day k. get/set: the daily number. grp: which graph group it belongs to. */
  R.GOALS = {
    pushups: { name: 'Push-ups', unit: 'reps', grp: 'body', def: 100, step: 10, min: 10, max: 1000, icon: 'dumbbell', open: 'pushups', quest: true,
      get: () => num(ST().pushGoal, 100), set: (v) => { ST().pushGoal = v; }, amt: (k) => ((LU.state.pushups || {})[k] || {}).n || 0 },
    situps: { name: 'Sit-ups', unit: 'reps', grp: 'body', def: 50, step: 10, min: 10, max: 1000, icon: 'dumbbell', open: 'situps', quest: true,
      get: () => num(ST().sitGoal, 50), set: (v) => { ST().sitGoal = v; }, amt: (k) => ((LU.state.situps || {})[k] || {}).n || 0 },
    mcq: { name: 'MCQs', unit: 'questions', grp: 'exam', def: 25, step: 5, min: 5, max: 500, icon: 'target', open: 'mcq', quest: true,
      get: () => num(R.data().goals.mcq, 25), set: (v) => { R.data().goals.mcq = v; }, amt: (k) => R.data().amt.mcq[k] || 0 },
    readGs: { name: 'GS reading', unit: 'min', grp: 'study', def: 60, step: 10, min: 10, max: 600, icon: 'book', open: 'reader:gs',
      get: () => num(R.data().goals.readGs, 60), set: (v) => { R.data().goals.readGs = v; }, amt: (k) => slotMin('gs', k) },
    readOpt: { name: 'Optional reading', unit: 'min', grp: 'study', def: 60, step: 10, min: 10, max: 600, icon: 'book', open: 'reader:opt',
      get: () => num(R.data().goals.readOpt, 60), set: (v) => { R.data().goals.readOpt = v; }, amt: (k) => slotMin('opt', k) },
    answers: { name: 'Answers', unit: 'answers', grp: 'exam', def: 1, step: 1, min: 1, max: 10, icon: 'pen', open: 'answers',
      get: () => num(AW().target, 1), set: (v) => { AW().target = v; }, amt: (k) => AW().log[k] || 0 },
    cards: { name: 'Flashcards', unit: 'cards', grp: 'exam', def: 20, step: 5, min: 5, max: 300, icon: 'loop', open: 'cards', quest: true,
      get: () => num(R.data().goals.cards, 20), set: (v) => { R.data().goals.cards = v; }, amt: (k) => R.data().amt.cards[k] || 0 },
    diary: { name: 'Diary', unit: 'entries', grp: 'overall', def: 1, step: 1, min: 1, max: 5, icon: 'notes', open: 'diary', quest: true,
      get: () => num(R.data().goals.diary, 1), set: (v) => { R.data().goals.diary = v; }, amt: (k) => R.data().amt.diary[k] || 0 },
  };
  R.SERIES = Object.keys(R.GOALS);
  /* topics per block: ticking this many topics counts as a full reading goal */
  R.topicsPer = () => num(R.data().goals.topicsPer, 2);
  R.setTopicsPer = (v) => { R.data().goals.topicsPer = Math.max(1, Math.min(20, v)); LU.save(); R.after(); };
  const slotMin = (slot, k) => {
    const D = R.data(), sec = ((D.amt.rs[k] || {})[slot]) || 0, tp = ((D.amt.tp[k] || {})[slot]) || 0;
    const per = (slot === 'gs' ? R.GOALS.readGs.get() : R.GOALS.readOpt.get()) / R.topicsPer();
    return sec / 60 + tp * per;
  };
  R.slotOf = (doc) => { const s = doc && doc.subj && LU.subject && LU.subject(doc.subj); return s && s.paper === 'Optional' ? 'opt' : 'gs'; };
  R.slotOfSubj = (s) => (s && s.paper === 'Optional' ? 'opt' : 'gs');

  /* a goal changed: from that day on the new number applies; earlier days keep the old one */
  R.snap = () => {
    const D = R.data(), today = LU.todayKey();
    R.SERIES.forEach((id) => {
      const g = R.GOALS[id], v = g.get(), h = (D.hist[id] = D.hist[id] || []);
      if (D.last[id] === undefined) { D.last[id] = v; if (!h.length) h.push([D.since || today, v]); return; }
      if (D.last[id] !== v) { if (!h.length) h.push([D.since || today, D.last[id]]); h.push([today, v]); D.last[id] = v; }
    });
  };
  R.need = (id, k) => {
    const h = R.data().hist[id] || []; let v = null;
    for (let i = 0; i < h.length; i++) { if (h[i][0] <= k) v = h[i][1]; }
    return v == null ? (h.length ? h[0][1] : R.GOALS[id].get()) : v;
  };
  R.setGoal = (id, v) => {
    const g = R.GOALS[id]; v = Math.max(g.min, Math.min(g.max, Math.round(v)));
    R.snap(); g.set(v); R.snap();
    if (LU['settle_' + id]) { try { const m = LU['settle_' + id](); if (m) LU.toast(m, { sys: false, ms: 3200 }); } catch (e) {} }
    LU.save(true); R.after();
  };

  /* ---------- coverage ---------- */
  /* Each day since the first day has a need (the goal) and what was done. Surplus from any day fills the oldest missing days first
     (with no time limit), then up to "credit ahead" coming days. A partly filled day keeps its part. */
  R.cov = (id) => {
    const D = R.data(), g = R.GOALS[id], today = LU.todayKey(); R.snap();
    const since = D.since || today, end = LU.addDays(today, Math.max(0, D.ahead || 0));
    const man = D.man[id] || {}, days = [];
    for (let k = since; k <= end; k = LU.addDays(k, 1)) {
      const need = R.need(id, k); let own = k <= today ? g.amt(k) : 0;
      const m = !!man[k]; if (m && own < need) own = need;
      days.push({ k, need, own, fill: 0, man: m, future: k > today });
    }
    let pool = 0;
    days.forEach((x) => { if (!x.future && x.own > x.need) pool += x.own - x.need; });
    days.forEach((x) => { if (x.own < x.need && pool > 0) { const take = Math.min(pool, x.need - x.own); x.fill = take; pool -= take; } });
    days.forEach((x) => {
      x.have = x.own + x.fill; x.short = Math.max(0, x.need - x.have);
      x.state = x.short === 0 ? (x.own >= x.need ? 'ok' : x.future ? 'ahead' : 'filled') : (x.have > 0 ? 'part' : 'miss');
    });
    return { id, days, pool, since };
  };
  R.covDay = (id, k) => { const c = R.cov(id); return c.days.find((x) => x.k === k) || null; };
  /* days before today that are still short */
  R.pending = (id) => R.cov(id).days.filter((x) => !x.future && x.k < LU.todayKey() && x.short > 0);

  /* ---------- counting what you do ---------- */
  let saveT;
  const soon = () => { clearTimeout(saveT); saveT = setTimeout(() => { LU.save(); R.after(); }, 800); };
  R.add = (id, n, k) => {
    if (!LU.state) return; const D = R.data(); k = k || LU.todayKey();
    const m = D.amt[id]; if (!m) return; m[k] = Math.max(0, (m[k] || 0) + n);
    if (n > 0) R.vibOK = true;
    soon();
  };
  R.read = (doc, sec) => {
    if (!LU.state) return; const D = R.data(), k = LU.todayKey(), slot = R.slotOf(doc);
    const o = (D.amt.rs[k] = D.amt.rs[k] || {}); o[slot] = (o[slot] || 0) + sec;
    soon();
  };
  /* ticking a single topic counts as part of a reading block */
  R.topic = (subj, delta) => {
    if (!LU.state) return; const D = R.data(), k = LU.todayKey(), slot = R.slotOfSubj(subj);
    const o = (D.amt.tp[k] = D.amt.tp[k] || {}); o[slot] = Math.max(0, (o[slot] || 0) + delta);
    soon();
  };
  const _toggle = LU.toggleTopic;
  if (_toggle && !_toggle._rpg) {
    LU.toggleTopic = function (id) {
      const r = _toggle.apply(this, arguments);
      try { if (r && r.count === 1) R.topic(LU.subjOf(id), r.done ? 1 : -1); } catch (e) {}
      return r;
    };
    LU.toggleTopic._rpg = true;
  }

  /* ---------- manual tick of a goal quest (counts the day as done without numbers) ---------- */
  R.manual = (id, k, on) => { const D = R.data(); const m = (D.man[id] = D.man[id] || {}); if (on) m[k] = 1; else delete m[k]; LU.save(true); R.after(); };

  /* ---------- goal quests shown on the RPG home (only the ones with no real quest of their own) ---------- */
  R.goalQuests = (k) => {
    k = k || LU.todayKey(); const out = [];
    R.SERIES.forEach((id) => {
      const g = R.GOALS[id]; if (!g.quest) return;
      const x = R.covDay(id, k); if (!x) return;
      out.push({ id: 'g_' + id, sid: id, name: g.name, unit: g.unit, icon: g.icon, open: g.open, need: x.need, have: Math.round(x.have), own: Math.round(x.own), state: x.state, done: x.short === 0, ahead: x.state === 'ahead', filled: x.state === 'filled', man: x.man });
    });
    return out;
  };

  /* ---------- auto-tick of real quests ---------- */
  const completeLate = (k, q) => {
    const d = LU.day(k); if (d.done[q.id]) return null;
    if (d.miss && d.miss[q.id]) LU.refundMiss(d, q.id);
    const xp = Math.round((q.xp || 0) * 0.6);   /* same catch-up rate as the old backlog */
    const rec = { at: Date.now(), xp, stat: q.stat, kind: q.kind, pts: 1, onTime: false, min: 0, late: 1, auto: 1 };
    if (LU.KINDS[q.kind] && LU.KINDS[q.kind].study && q.min) { rec.min = q.min; d.studyMin = (d.studyMin || 0) + q.min; }
    d.done[q.id] = rec;
    const st = LU.state.stats; st[q.stat || 'dsc'] = (st[q.stat || 'dsc'] || 0) + 1;
    LU.gainXP(xp); LU.log('Caught up: ' + q.title, xp);
    LU.checkDay(k); LU.checkBoss(k);
    (LU.state.backlog || []).forEach((b) => { if (!b.done && b.from === k && b.title === q.title) { b.done = true; b.doneOn = LU.todayKey(); } });
    return rec;
  };
  R.autoTick = () => {
    if (!LU.state || R._busy) return 0; R._busy = true; let n = 0;
    try {
      const D = R.data(), today = LU.todayKey(); if (!D.since) return 0;
      const jobs = [['readGs', (q) => q.kind === 'study' && q.focus === 'gs'], ['readOpt', (q) => q.kind === 'study' && q.focus === 'opt'], ['answers', (q) => q.kind === 'answer']];
      jobs.forEach(([id, match]) => {
        if (D.auto[id] === false) return;
        R.cov(id).days.forEach((x) => {
          if (x.future || x.short > 0) return;
          const qs = LU.questsFor(x.k).filter((q) => !q.done && !q.skipped && !q.info && q.src === 'block' && match(q));
          qs.forEach((q) => {
            let rec;
            if (x.k === today) { rec = LU.complete(x.k, q); if (rec) rec.auto = 1; }
            else rec = completeLate(x.k, q);
            if (rec) { n++; R._ticked = (R._ticked || []).concat([{ k: x.k, id: q.id, title: q.title, xp: rec.xp, late: x.k !== today }]); }
          });
        });
      });
    } catch (e) { console.error(e); } finally { R._busy = false; }
    if (n) {
      LU.save(true);
      const last = R._ticked.slice(-n);
      LU.toast(n === 1 ? last[0].title + ' ticked automatically' + (last[0].xp ? ' (+' + last[0].xp + ' XP)' : '') : n + ' quests ticked automatically', {
        sys: false, ms: 4200,
        undo: () => { last.forEach((t) => { const q = LU.questsFor(t.k).find((x) => x.id === t.id); if (q && q.done) LU.uncomplete(t.k, q); }); LU.save(true); LU.render(false); },
      });
      R.sfx('ping'); R.vib(20);
      if (R.onTick) R.onTick(last);
      if (LU.render && !document.querySelector('.reader')) LU.render(true);
    }
    return n;
  };
  R.after = () => { R.autoTick(); if (R.onData) R.onData(); };

  /* ---------- the backlog ---------- */
  R.backlog = () => {
    const out = [];
    R.SERIES.forEach((id) => {
      const g = R.GOALS[id], p = R.pending(id); if (!p.length) return;
      out.push({ id, name: g.name, unit: g.unit, icon: g.icon, open: g.open, days: p.map((x) => ({ k: x.k, need: x.need, have: Math.round(x.have), short: Math.ceil(x.short) })), total: Math.ceil(p.reduce((a, x) => a + x.short, 0)) });
    });
    return out;
  };
  /* the old catch-up list (missed tasks and other items), without the study / answer items that the groups above already cover */
  R.catchup = () => (LU.state.backlog || []).filter((b) => !b.done && b.kind !== 'study' && b.kind !== 'answer');
  R.backlogCount = () => R.backlog().reduce((a, g) => a + g.days.length, 0) + R.catchup().length;

  /* ---------- weight ---------- */
  R.weights = () => { const w = R.data().w.log; return Object.keys(w).sort().map((k) => [k, w[k]]); };
  R.setWeight = (v) => { const D = R.data(); v = Math.round(+v * 10) / 10; if (!(v > 20 && v < 300)) return false; D.w.log[LU.todayKey()] = v; D.w.asked = LU.weekKey(LU.todayKey()); LU.save(true); if (R.onData) R.onData(); return true; };
  R.weightDue = () => {
    const D = R.data(); if (!D.w.on || !R.ui().weightPrompt) return false;
    const t = LU.todayKey(), wk = LU.weekKey(t); if (D.w.asked === wk) return false;
    return LU.parseKey(t).getDay() === (D.w.day || 0);
  };
  R.skipWeight = () => { const D = R.data(); D.w.asked = LU.weekKey(LU.todayKey()); LU.save(true); };

  /* ---------- daily report: what you missed yesterday, what is on today ---------- */
  R.missedYesterday = () => {
    const y = LU.addDays(LU.todayKey(), -1), out = [];
    if (y < (R.data().since || LU.todayKey())) return { k: y, quests: [], goals: [] };
    LU.questsFor(y).forEach((q) => {
      if (q.info || q.skipped || q.done || q.src === 'check' && false) return;
      out.push({ k: y, id: q.id, title: q.title, sub: q.sub || '', kind: q.kind, xp: q.xp || 0, lost: ((LU.peekDay(y) || {}).miss || {})[q.id] ? ((LU.peekDay(y).miss[q.id].lost) || 0) : 0, crossed: !!q.missed, subjectId: q.subjectId });
    });
    const goals = [];
    ['pushups', 'situps', 'mcq', 'cards', 'diary'].forEach((id) => { const x = R.covDay(id, y); if (x && x.short > 0) goals.push({ id, name: R.GOALS[id].name, unit: R.GOALS[id].unit, short: Math.ceil(x.short), need: x.need, have: Math.round(x.have), open: R.GOALS[id].open }); });
    return { k: y, quests: out, goals };
  };
  R.reportDue = () => {
    const D = R.data(), t = LU.todayKey();
    if (!R.on() || !R.ui().report) return false;
    if (D.rep.last === t) return false;
    return true;
  };
  R.reportSeen = () => { const D = R.data(); D.rep.last = LU.todayKey(); LU.save(true); };

  /* ---------- helpers for the graphs ---------- */
  const NICE = [5, 10, 25, 50, 100, 250, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000];
  R.nice = (v, min) => { v = Math.max(v, min || 0); for (let i = 0; i < NICE.length; i++) if (NICE[i] >= v * 1.02) return NICE[i]; return Math.ceil(v); };
  R.firstDay = () => {
    const keys = Object.keys(LU.state.days || {}).sort(); const D = R.data();
    let f = keys.length ? keys[0] : LU.todayKey();
    [(LU.state.pushups || {}), (LU.state.situps || {}), D.amt.mcq, D.amt.rs, D.w.log, D.amt.est].forEach((m) => { const ks = Object.keys(m).sort(); if (ks.length && ks[0] < f) f = ks[0]; });
    return f;
  };
  /* the days the X axis shows: from the first day with data until today, growing with your history */
  R.axis = (first) => {
    const today = LU.todayKey(), r = R.ui().range; first = first || R.firstDay();
    let span = LU.diffDays(first, today) + 1;
    let n = span;
    if (r === 'auto') n = Math.min(span, 120); else if (r !== 'all') n = Math.min(span, +r);
    n = Math.max(3, n);
    const out = []; for (let i = n - 1; i >= 0; i--) out.push(LU.addDays(today, -i));
    return out;
  };
  /* per-day numbers for the two-sided graphs: done above the line, missed below */
  R.dual = (id, days) => {
    const g = R.GOALS[id], c = R.cov(id), today = LU.todayKey(), by = {}; c.days.forEach((x) => (by[x.k] = x));
    return days.map((k) => { const x = by[k]; const own = g.amt(k); if (!x) return { k, up: own, down: 0, need: R.need(id, k) }; return { k, up: own, down: k < today ? Math.ceil(x.short) : 0, need: x.need, state: x.state }; });
  };


  /* ---------- open the right PDF (last one you read for a subject, else the first in its list) ---------- */
  R.bestPdf = (list) => {
    const opened = list.filter((d) => d.opened).sort((a, b) => b.opened - a.opened);
    if (opened.length) return opened[0];
    return list.slice().sort((a, b) => LU.docOrd(a) - LU.docOrd(b))[0] || null;
  };
  R.openSubject = (sid, fallback) => {
    const d = R.bestPdf((LU.docs ? LU.docs() : []).filter((x) => x.subj === sid));
    if (d) { LU.openReader(d.id); return true; }
    if (fallback !== false) LU.push('subject', { id: sid });
    return false;
  };
  R.openSlot = (slot, sid) => {
    if (sid && R.openSubject(sid, false)) return true;
    const d = R.bestPdf((LU.docs ? LU.docs() : []).filter((x) => x.subj && x.subj !== 'qp' && R.slotOf(x) === slot));
    if (d) { LU.openReader(d.id); return true; }
    if (sid) LU.push('subject', { id: sid }); else LU.go('notes');
    return false;
  };

  /* ---------- first run: start counting from today, and place the old data on the right days ---------- */
  R.boot = () => {
    if (!LU.state) return;
    const D = R.data(), today = LU.todayKey();
    if (!D.since) {
      D.since = today;
      if (ST().pushGoal === undefined) ST().pushGoal = 100;
      if (ST().sitGoal === undefined) ST().sitGoal = 50;
      R.snap();
    }
    if (!D.bf) {
      D.bf = 1;
      /* MCQ practice runs saved so far (the log keeps the most recent ones) */
      try { ((LU.state.mcq || {}).log || []).forEach((r) => { if (r && r.k) { D.amt.mcq[r.k] = (D.amt.mcq[r.k] || 0) + (r.n || 0); D.amt.mcqok[r.k] = (D.amt.mcqok[r.k] || 0) + (r.ok || 0); } }); } catch (e) {}
      /* PDF reading: the app only kept a total per PDF and the day it was last opened, so those minutes go on that day (for the graphs only; they never count against a goal) */
      try {
        (LU.docs ? LU.docs() : []).forEach((d) => {
          if (!(d.mins > 0) || !d.opened) return;
          const k = LU.keyOf(new Date(d.opened - 3 * 3600e3)), slot = R.slotOf(d), e = (D.amt.est[k] = D.amt.est[k] || {});
          e[slot] = (e[slot] || 0) + d.mins * 60;
        });
      } catch (e) {}
      LU.save(true);
    }
    R.snap();
  };
  R.reset = () => { const s = LU.state; s.rpg = null; LU.save(true); R.boot(); };

  /* total minutes per day for the study graph: what the quests and the timer recorded, plus (for old days) the reading estimate */
  R.studyMin = (k) => {
    const d = LU.peekDay(k) || {}, D = R.data(); let m = (d.studyMin || 0) + (d.extraMin || 0);
    const rs = D.amt.rs[k] || {}, es = D.amt.est[k] || {};
    const live = ((rs.gs || 0) + (rs.opt || 0)) / 60, old = ((es.gs || 0) + (es.opt || 0)) / 60;
    return Math.round(Math.max(m, live > 0 ? live : old));
  };
})();
