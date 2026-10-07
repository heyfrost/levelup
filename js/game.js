/* Game rules: quests, XP, levels, stats, streaks, weekly boss, catch-up, syllabus progress */
(function () {
  const LU = window.LU;

  /* ---------- events ---------- */
  const handlers = {};
  LU.on = (ev, fn) => (handlers[ev] = handlers[ev] || []).push(fn);
  LU.emit = (ev, data) => (handlers[ev] || []).forEach((f) => f(data));

  /* ---------- catalogue ---------- */
  LU.STATS = {
    str: { name: 'Strength', short: 'STR', hint: 'Workouts' },
    int: { name: 'Intelligence', short: 'INT', hint: 'Study, answers, tests' },
    vit: { name: 'Vitality', short: 'VIT', hint: 'Sleep and hygiene' },
    dsc: { name: 'Discipline', short: 'DSC', hint: 'Routine done on time' },
    hlt: { name: 'Health', short: 'HLT', hint: 'Meals and water' },
  };
  LU.KINDS = {
    wake: { name: 'Wake up', icon: 'sun' },
    workout: { name: 'Workout', icon: 'dumbbell' },
    hygiene: { name: 'Hygiene', icon: 'drop' },
    study: { name: 'Study', icon: 'book', study: true },
    answer: { name: 'Answer writing', icon: 'pen', study: true },
    revision: { name: 'Revision', icon: 'loop', study: true },
    ca: { name: 'Current affairs', icon: 'news', study: true },
    csat: { name: 'CSAT', icon: 'calc', study: true },
    essay: { name: 'Essay', icon: 'pen', study: true },
    mock: { name: 'Mock test', icon: 'target', study: true },
    buffer: { name: 'Catch-up', icon: 'loop', study: true },
    meal: { name: 'Meal', icon: 'bowl' },
    routine: { name: 'Routine', icon: 'clock' },
    office: { name: 'Office', icon: 'brief' },
    plan: { name: 'Planning', icon: 'list' },
    sleep: { name: 'Sleep', icon: 'moon' },
    task: { name: 'My task', icon: 'star' },
    check: { name: 'Checklist', icon: 'check' },
  };
  LU.RANKS = [
    { r: 'E', from: 1, title: 'Awakened' },
    { r: 'D', from: 10, title: 'Aspirant' },
    { r: 'C', from: 25, title: 'Scholar' },
    { r: 'B', from: 40, title: 'Strategist' },
    { r: 'A', from: 55, title: 'Officer in the making' },
    { r: 'S', from: 70, title: 'Civil Servant' },
  ];

  /* ---------- levels ---------- */
  LU.xpFor = (L) => 30 * L * L + 70 * L - 100; // total XP needed to reach level L (level 1 = 0)
  LU.levelOf = (xp) => { let L = 1; while (LU.xpFor(L + 1) <= xp) L++; return L; };
  LU.rankOf = (L) => { let r = LU.RANKS[0]; LU.RANKS.forEach((x) => { if (L >= x.from) r = x; }); return r; };
  LU.levelInfo = () => {
    const xp = LU.state.xp, L = LU.levelOf(xp), a = LU.xpFor(L), b = LU.xpFor(L + 1);
    return { xp, level: L, into: xp - a, need: b - a, pct: Math.max(0, Math.min(1, (xp - a) / (b - a))), neg: xp < 0, rank: LU.rankOf(L) };
  };
  LU.statVal = (k) => 10 + (LU.state.stats[k] || 0);

  /* ---------- days ---------- */
  LU.day = (k) => {
    const s = LU.state;
    if (!s.days[k]) s.days[k] = { done: {}, tasks: [], skip: {}, miss: {}, studyMin: 0, extraMin: 0 };
    const d = s.days[k];
    d.done = d.done || {}; d.tasks = d.tasks || []; d.skip = d.skip || {}; d.miss = d.miss || {};
    return d;
  };
  LU.peekDay = (k) => LU.state.days[k];

  const blockMin = (b) => { let a = LU.toMin(b.start), e = LU.toMin(b.end); if (e <= a) e += 1440; return e - a; };
  LU.blockMin = blockMin;
  const ANSWER = () => LU.state.settings.answerPlan || ['Mixed GS', 'GS1', 'Anthropology', 'GS2', 'GS3', 'Anthropology', 'GS4'];

  /* Build today's quest list for a date key */
  LU.questsFor = (k) => {
    const s = LU.state, d = LU.peekDay(k) || { done: {}, tasks: [], skip: {}, miss: {} };
    const miss = d.miss || {};
    const wd = LU.parseKey(k).getDay();
    const blocks = (s.schedule[LU.dayType(k)] || []).slice().sort((a, b) => LU.toMin(a.start) - LU.toMin(b.start));
    const out = [];
    blocks.forEach((b) => {
      const q = Object.assign({}, b, { src: 'block', min: blockMin(b) });
      if (b.kind === 'workout') { const w = s.workout[wd]; q.sub = w ? w.name + ' day' : ''; q.list = w ? w.list : []; }
      if (b.kind === 'answer') q.sub = 'Today: ' + ANSWER()[wd];
      if (b.focus) { const n = LU.nextTopic(s.syl.focus[b.focus]); const subj = LU.subject(s.syl.focus[b.focus]); q.sub = subj ? subj.name + (n ? ': ' + n.t : ': all topics done') : ''; q.subjectId = subj && subj.id; }
      if (b.kind === 'buffer') { const n = s.backlog.filter((x) => !x.done).length; q.sub = n ? `${n} missed item${n > 1 ? 's' : ''} waiting in catch-up` : 'Nothing missed this week. Revise Anthropology.'; }
      q.skipped = !!d.skip[b.id];
      q.info = b.kind === 'office' || !b.xp;
      out.push(q);
    });
    s.checklist.forEach((c) => out.push(Object.assign({ kind: 'check', src: 'check' }, c, { skipped: !!d.skip[c.id] })));
    d.tasks.forEach((t) => out.push(Object.assign({ kind: 'task', src: 'task', stat: t.stat || 'dsc', xp: t.xp || 20 }, t)));
    out.forEach((q) => { q.done = !!d.done[q.id]; q.missed = !q.done && !!miss[q.id]; });
    return out;
  };
  const counts = (q) => !q.info && !q.skipped;
  LU.dayProgress = (k) => {
    const qs = LU.questsFor(k).filter(counts);
    const tot = qs.reduce((a, q) => a + q.xp, 0), got = qs.filter((q) => q.done).reduce((a, q) => a + q.xp, 0);
    return { n: qs.length, done: qs.filter((q) => q.done).length, tot, got, pct: tot ? got / tot : 0 };
  };

  /* ---------- XP ---------- */
  LU.log = (text, xp) => { const s = LU.state; s.log.unshift({ t: Date.now(), text, xp: xp || 0 }); if (s.log.length > 400) s.log.length = 400; };
  LU.gainXP = (xp) => {
    const s = LU.state, before = LU.levelOf(s.xp);
    s.xp = (s.xp || 0) + xp;   // XP may go below zero
    { const dd = LU.day(LU.todayKey()); dd.xp = (dd.xp || 0) + xp; }
    const after = LU.levelOf(s.xp);
    if (after > before) {
      const rb = LU.rankOf(before), ra = LU.rankOf(after);
      LU.log(`Reached level ${after}`, 0);
      LU.emit('levelup', { from: before, to: after, rankFrom: rb, rankTo: ra });
    }
  };
  const addStat = (k, n) => { LU.state.stats[k] = Math.max(0, (LU.state.stats[k] || 0) + n); };

  /* Complete a quest. Returns the record (xp etc.) */
  LU.complete = (k, q) => {
    const d = LU.day(k);
    if (d.done[q.id]) return null;
    delete d.miss[q.id];
    const isToday = k === LU.todayKey();
    let xp = q.xp || 0, onTime = false;
    if (q.src === 'block' && isToday) {
      const n = LU.nowMin(), a = LU.toMin(q.start), e = a + (q.min || 0);
      onTime = n >= a - 30 && n <= e + 30;
      if (onTime) xp = Math.round(xp * 1.2);
    }
    const rec = { at: Date.now(), xp, stat: q.stat, kind: q.kind, pts: 1 + (onTime ? 1 : 0), onTime, min: 0 };
    if (LU.KINDS[q.kind] && LU.KINDS[q.kind].study && q.min) { rec.min = q.min; d.studyMin = (d.studyMin || 0) + q.min; }
    if (q.kind === 'wake' && isToday) d.woke = LU.fromMin(LU.nowMin());
    if (q.kind === 'sleep' && isToday) d.slept = LU.fromMin(LU.nowMin());
    d.done[q.id] = rec;
    addStat(q.stat || 'dsc', 1);
    if (onTime) addStat('dsc', 1);
    LU.gainXP(xp);
    LU.log(q.title, xp);
    LU.checkDay(k);
    LU.checkBoss(k);
    LU.save();
    return rec;
  };
  LU.uncomplete = (k, q) => {
    const d = LU.day(k), rec = d.done[q.id];
    if (!rec) return;
    delete d.done[q.id];
    addStat(rec.stat || 'dsc', -1);
    if (rec.onTime) addStat('dsc', -1);
    if (rec.min) d.studyMin = Math.max(0, (d.studyMin || 0) - rec.min);
    if (q.kind === 'wake') delete d.woke;
    if (q.kind === 'sleep') delete d.slept;
    LU.gainXP(-rec.xp);
    LU.log('Undid: ' + q.title, -rec.xp);
    LU.save();
  };
  LU.toggleSkip = (k, q) => { const d = LU.day(k); if (d.skip[q.id]) delete d.skip[q.id]; else { d.skip[q.id] = 1; delete d.miss[q.id]; } LU.save(); };

  /* Missed: the cross button. No XP, no penalty, but it is counted and listed. */
  LU.toggleMiss = (k, q) => {
    const d = LU.day(k);
    if (d.miss[q.id]) { delete d.miss[q.id]; LU.save(); return false; }
    if (d.done[q.id]) LU.uncomplete(k, q);
    delete d.skip[q.id];
    d.miss[q.id] = { t: q.title, kind: q.kind, xp: q.xp || 0, at: Date.now() };
    LU.log('Missed: ' + q.title, 0);
    LU.save(); return true;
  };
  /* List of missed quests between two day keys (inclusive), newest first */
  LU.missedList = (from, to) => {
    const out = [];
    Object.keys(LU.state.days).sort().reverse().forEach((k) => {
      if ((from && k < from) || (to && k > to)) return;
      const d = LU.state.days[k];
      Object.keys(d.miss || {}).forEach((id) => { if (!(d.done || {})[id]) out.push(Object.assign({ k, id }, d.miss[id])); });
    });
    return out;
  };
  LU.missedCounts = () => {
    const t = LU.todayKey(), w = LU.weekKey(t), m = t.slice(0, 7) + '-01';
    return { week: LU.missedList(w, t).length, month: LU.missedList(m, t).length, all: LU.missedList().length, xpLost: LU.missedList(w, t).reduce((a, x) => a + (x.xp || 0), 0) };
  };

  /* Day cleared bonus */
  LU.checkDay = (k) => {
    const d = LU.day(k), p = LU.dayProgress(k);
    if (!d.cleared && p.pct * 100 >= LU.state.settings.clearAt) {
      d.cleared = true; LU.gainXP(100); LU.log('Daily quest cleared', 100);
      LU.emit('clear', { k, streak: LU.streak() });
    }
  };
  /* a rest day (one free pass a month) bridges the streak: it neither adds to it nor breaks it */
  LU.streak = () => {
    const s = LU.state; let k = LU.todayKey(), n = 0;
    if (!(s.days[k] && s.days[k].cleared)) k = LU.addDays(k, -1);
    while (s.days[k] && (s.days[k].cleared || s.days[k].rest)) { if (s.days[k].cleared) n++; k = LU.addDays(k, -1); }
    return n;
  };
  LU.bestStreak = () => {
    const keys = Object.keys(LU.state.days).sort(); let best = 0, cur = 0, prev = null;
    keys.forEach((k) => {
      const d = LU.state.days[k];
      if (d.cleared) { cur = prev && LU.diffDays(prev, k) === 1 ? cur + 1 : 1; prev = k; best = Math.max(best, cur); }
      else if (d.rest) { if (prev && LU.diffDays(prev, k) === 1) prev = k; }
    });
    return best;
  };

  /* ---------- weekly boss ---------- */
  LU.weekStudy = (k) => {
    const w = LU.weekKey(k || LU.todayKey()); let m = 0;
    for (let i = 0; i < 7; i++) { const d = LU.state.days[LU.addDays(w, i)]; if (d) m += (d.studyMin || 0) + (d.extraMin || 0); }
    return m;
  };
  LU.checkBoss = (k) => {
    const s = LU.state, w = LU.weekKey(k || LU.todayKey());
    if (s.boss[w]) return;
    if (LU.weekStudy(k) >= s.settings.bossHours * 60) {
      s.boss[w] = Date.now(); LU.gainXP(500); LU.log('Weekly boss defeated', 500);
      LU.emit('boss', { hours: s.settings.bossHours });
    }
  };

  /* ---------- study timer (office gaps or extra study) ---------- */
  LU.inOffice = () => {
    const k = LU.todayKey(), t = LU.dayType(k);
    const off = (LU.state.schedule[t] || []).find((b) => b.kind === 'office');
    if (!off) return false;
    const n = LU.nowMin(); return n >= LU.toMin(off.start) && n < LU.toMin(off.end);
  };
  /* t.start is the "effective" start: pausing keeps t.paused = when it paused, resuming moves start forward by the pause length */
  LU.timerStart = (label) => { LU.state.timer = { start: Date.now(), seen: Date.now(), paused: null, office: LU.inOffice(), label: label || '' }; LU.save(); };
  LU.timerElapsed = () => { const t = LU.state.timer; return t ? ((t.paused || Date.now()) - t.start) / 60000 : 0; };
  LU.timerPause = (at) => { const t = LU.state.timer; if (!t || t.paused) return; t.paused = Math.max(t.start, at || Date.now()); LU.save(true); };
  LU.timerResume = () => { const t = LU.state.timer; if (!t || !t.paused) return; t.start += Date.now() - t.paused; t.paused = null; t.seen = Date.now(); LU.save(true); };
  LU.timerReset = () => { LU.state.timer = null; LU.save(true); };
  LU.timerStop = (at) => {
    const t = LU.state.timer; if (!t) return null;
    const min = Math.max(0, Math.min(Math.round(((at || t.paused || Date.now()) - t.start) / 60000), 600));
    LU.state.timer = null;
    if (min < 1) { LU.save(); return { min: 0, xp: 0 }; }
    const k = LU.keyOf(new Date(t.start - 3 * 3600e3)), d = LU.day(k);
    d.extraMin = (d.extraMin || 0) + min;
    if (t.office) d.officeMin = (d.officeMin || 0) + min;
    const xp = Math.round(min * (t.office ? 1.5 : 1));
    addStat('int', Math.floor(min / 30));
    LU.gainXP(xp);
    LU.log((t.office ? 'Office study' : 'Extra study') + ' · ' + LU.dur(min), xp);
    LU.checkBoss(k); LU.save();
    return { min, xp, office: t.office };
  };

  /* the timer pauses by itself when you leave the app (it never starts or resumes by itself) */
  const autoPause = (at) => { const t = LU.state.timer; if (!t || t.paused) return; LU.timerPause(at); LU.state.timerAuto = Date.now(); LU.save(true); };
  const beat = () => { const t = LU.state.timer; if (t && !t.paused && !document.hidden) { t.seen = Date.now(); try { LU.save(true); } catch (e) {} } };
  setInterval(beat, 20000);
  const left = () => autoPause(Date.now());
  const back = () => {
    const t = LU.state.timer;
    if (t && !t.paused && t.seen && Date.now() - t.seen > 45000) autoPause(t.seen);   /* app was frozen or killed before it could pause */
    if (LU.state.timerAuto) { LU.state.timerAuto = null; LU.save(); if (LU.state.timer) setTimeout(() => { LU.toast('Timer paused while you were away. Tap Resume to carry on.', { ms: 4500 }); if (LU.render) LU.render(); }, 300); }
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) left(); else back(); });
  window.addEventListener('pagehide', left);
  setTimeout(back, 1500);

  /* ---------- catch-up (missed study items roll over) ---------- */
  LU.rollover = () => {
    const s = LU.state, today = LU.todayKey();
    let k = s.processed || today;
    let guard = 0;
    while (k < today && guard++ < 60) {
      const d = s.days[k];
      if (d && Object.keys(d.done).length) {
        LU.questsFor(k).forEach((q) => {
          if (q.done || q.skipped || q.info) return;
          const study = LU.KINDS[q.kind] && LU.KINDS[q.kind].study && q.kind !== 'buffer';
          if (study || q.kind === 'task') {
            s.backlog.push({ id: 'k' + LU.uid(), title: q.title, sub: q.sub || '', from: k, kind: q.kind, stat: q.stat || 'int', xp: Math.round((q.xp || 20) * 0.6), min: q.min || 0, done: false });
          }
        });
      }
      k = LU.addDays(k, 1);
    }
    s.processed = today;
    // drop finished catch-up items older than 14 days
    s.backlog = s.backlog.filter((b) => !b.done || LU.diffDays(b.doneOn || b.from, today) <= 14);
    LU.save();
  };
  LU.completeBacklog = (b) => {
    if (b.done) return;
    const k = LU.todayKey(), d = LU.day(k);
    b.done = true; b.doneOn = k;
    if (b.min) d.studyMin = (d.studyMin || 0) + b.min;
    addStat(b.stat || 'int', 1); LU.gainXP(b.xp); LU.log('Caught up: ' + b.title, b.xp);
    LU.checkBoss(k); LU.save();
  };
  LU.undoBacklog = (b) => {
    if (!b.done) return; const d = LU.day(LU.todayKey());
    b.done = false; if (b.min) d.studyMin = Math.max(0, (d.studyMin || 0) - b.min);
    addStat(b.stat || 'int', -1); LU.gainXP(-b.xp); LU.save();
  };

  /* ---------- syllabus ---------- */
  let IDX = null;
  LU.indexSyllabus = () => {
    IDX = { node: {}, parent: {}, subj: {} };
    const walk = (n, p, sid) => { IDX.node[n.i] = n; IDX.parent[n.i] = p; IDX.subj[n.i] = sid; (n.c || []).forEach((c) => walk(c, n.i, sid)); };
    LU.syllabus.forEach((s) => (s.c || []).forEach((c) => walk(c, null, s.id)));
  };
  LU.node = (id) => IDX.node[id];
  LU.subject = (id) => LU.syllabus.find((s) => s.id === id);
  LU.leaves = (n, out = []) => { if (!n.c || !n.c.length) out.push(n); else n.c.forEach((c) => LU.leaves(c, out)); return out; };
  LU.subjLeaves = (s) => (s.c || []).flatMap((c) => (c.c && c.c.length ? LU.leaves(c) : []));
  LU.isDone = (id) => !!LU.state.syl.done[id];
  LU.nodeProgress = (n) => { const l = LU.leaves(n); const d = l.filter((x) => LU.isDone(x.i)).length; return { d, t: l.length }; };
  LU.subjProgress = (s) => { const l = LU.subjLeaves(s); const d = l.filter((x) => LU.isDone(x.i)).length; return { d, t: l.length, pct: l.length ? d / l.length : 0 }; };
  LU.pathOf = (id) => { const p = []; let c = id; while (c) { p.unshift(IDX.node[c]); c = IDX.parent[c]; } return p; };
  LU.subjOf = (id) => LU.subject(IDX.subj[id]);
  LU.nextTopic = (sid) => { const s = LU.subject(sid); if (!s) return null; return LU.subjLeaves(s).find((x) => !LU.isDone(x.i)) || null; };
  LU.toggleTopic = (id) => {
    const n = IDX.node[id]; if (!n) return;
    const leaves = LU.leaves(n), all = leaves.every((x) => LU.isDone(x.i));
    const done = LU.state.syl.done;
    if (all) leaves.forEach((x) => delete done[x.i]);
    else leaves.forEach((x) => (done[x.i] = Date.now()));
    // XP only for single micro-topics ticked one by one (bulk ticks of past work give no XP)
    if (leaves.length === 1) {
      if (all) { LU.gainXP(-5); } else { LU.gainXP(5); LU.log('Topic done: ' + n.t, 5); const d = LU.day(LU.todayKey()); d.topics = (d.topics || 0) + 1; }
    }
    LU.save();
    return { count: leaves.length, done: !all };
  };
  LU.PACE_SUBJECTS = (s) => s.paper !== 'Mains' && s.id !== 'csat';
  LU.pace = () => {
    const s = LU.state, subs = LU.syllabus.filter(LU.PACE_SUBJECTS);
    let d = 0, t = 0; subs.forEach((x) => { const p = LU.subjProgress(x); d += p.d; t += p.t; });
    const start = s.created, end = s.settings.syllabusTarget, today = LU.todayKey();
    const span = Math.max(1, LU.diffDays(start, end)), gone = LU.clamp(LU.diffDays(start, today), 0, span);
    const expected = Math.round((t * gone) / span);
    const daysLeft = Math.max(1, LU.diffDays(today, end));
    return { d, t, pct: t ? d / t : 0, expected, diff: d - expected, perDay: Math.ceil(Math.max(0, t - d) / daysLeft), daysLeft: LU.diffDays(today, end) };
  };

  /* ---------- phase plan ---------- */
  LU.phase = (k) => {
    const s = LU.state.settings, exam = s.examDate, y = exam.slice(0, 4);
    k = k || LU.todayKey();
    if (k > exam) return { name: 'Exam done', desc: 'Prelims is over. Update your exam date in Settings.' };
    if (k <= s.syllabusTarget) return { name: 'Foundation', desc: 'Finish GS and Anthropology with daily answer writing', until: s.syllabusTarget };
    if (k < `${y}-04-01`) return { name: 'Prelims shift', desc: 'MCQ practice and 2–3 mock tests a week', until: `${y}-03-31` };
    return { name: 'Final revision', desc: 'Full revision and Prelims mocks only', until: exam };
  };
  LU.daysToExam = () => LU.diffDays(LU.todayKey(), LU.state.settings.examDate);

  /* migrate old saves */
  LU.migrate = () => {
    const s = LU.state;
    s.settings.answerPlan = s.settings.answerPlan || ['Mixed GS', 'GS1', 'Anthropology', 'GS2', 'GS3', 'Anthropology', 'GS4'];
    s.backlog = s.backlog || []; s.boss = s.boss || {}; s.log = s.log || []; s.ach = s.ach || {}; s.reviews = s.reviews || {};
    /* one-time: add the quotes from the 1001 Motivational Quotes pack, keeping yours */
    if (!s.quotePack1 && window.QUOTE_PACK1) {
      s.quotes = s.quotes || [];
      const key = (t) => String(t).toLowerCase().replace(/[^a-z]/g, '').slice(0, 60), have = new Set(s.quotes.map((x) => key(x.q)));
      window.QUOTE_PACK1.forEach((x, i) => { const k = key(x.q); if (!have.has(k)) { have.add(k); s.quotes.push({ id: 'qp1_' + i, q: x.q, a: x.a || 'Unknown' }); } });
      s.quotePack1 = true;
    }
    s.syl = s.syl || { done: {}, focus: { gs: 'pol', opt: 'an1' } };
  };
})();
