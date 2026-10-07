/* Achievements and titles */
(function () {
  const LU = window.LU, esc = LU.esc, I = LU.icon;

  /* counters collected from everything you have done */
  LU.achStats = () => {
    const s = LU.state, S = { clear: 0, streak: LU.bestStreak(), done: 0, studyMin: 0, boss: Object.keys(s.boss || {}).length, level: LU.levelInfo().level,
      topics: 0, marks: 0, pdfs: (s.docs || []).length, early: 0, perfect: 0, stepDays: 0, answers: 0, workouts: 0, reviews: Object.keys(s.reviews || {}).length };
    (s.docs || []).forEach((d) => (S.marks += d.marks || 0));
    const goal = LU.trk().goal;
    Object.keys(s.days).forEach((k) => {
      const d = s.days[k], recs = Object.values(d.done || {});
      S.done += recs.length;
      S.studyMin += (d.studyMin || 0) + (d.extraMin || 0);
      S.topics += d.topics || 0; // only topics ticked one by one count, not bulk ticks of past work
      if (d.cleared) { S.clear++; const p = LU.dayProgress(k); if (p.n && p.done === p.n) S.perfect++; }
      if (d.woke && LU.toMin(d.woke) <= 345) S.early++;
      if ((d.steps || 0) >= goal) S.stepDays++;
      recs.forEach((r) => { if (r.kind === 'answer') S.answers++; if (r.kind === 'workout') S.workouts++; });
    });
    S.studyH = Math.floor(S.studyMin / 60);
    return S;
  };

  const A = (id, cat, name, desc, key, target, xp, title) => ({ id, cat, name, desc, key, target, xp, title });
  LU.ACH = [
    A('first', 'Quests', 'First step', 'Complete your first quest', 'done', 1, 10),
    A('q100', 'Quests', 'Centurion', 'Complete 100 quests', 'done', 100, 100, 'Centurion'),
    A('q500', 'Quests', 'Relentless', 'Complete 500 quests', 'done', 500, 300, 'Relentless'),
    A('q1000', 'Quests', 'Thousand deeds', 'Complete 1,000 quests', 'done', 1000, 600, 'Thousand Deeds'),
    A('perf1', 'Quests', 'Flawless day', 'Finish every quest in a day', 'perfect', 1, 100, 'Flawless'),
    A('perf7', 'Quests', 'Flawless seven', 'Seven flawless days', 'perfect', 7, 400, 'The Flawless'),
    A('s3', 'Streaks', 'Spark', 'Clear the daily quest 3 days in a row', 'streak', 3, 50, 'Spark'),
    A('s7', 'Streaks', 'Week warrior', '7-day streak', 'streak', 7, 100, 'Week Warrior'),
    A('s14', 'Streaks', 'Fortnight', '14-day streak', 'streak', 14, 200, 'Fortnight Knight'),
    A('s30', 'Streaks', 'Unbroken', '30-day streak', 'streak', 30, 500, 'The Unbroken'),
    A('s60', 'Streaks', 'Ironclad', '60-day streak', 'streak', 60, 1000, 'Ironclad'),
    A('b1', 'Boss', 'Boss slayer', 'Defeat a weekly boss', 'boss', 1, 150, 'Boss Slayer'),
    A('b4', 'Boss', 'Monthly menace', 'Defeat 4 weekly bosses', 'boss', 4, 300, 'Monthly Menace'),
    A('b12', 'Boss', 'Raid captain', 'Defeat 12 weekly bosses', 'boss', 12, 800, 'Raid Captain'),
    A('l5', 'Level', 'Awakened', 'Reach level 5', 'level', 5, 50),
    A('l10', 'Level', 'Aspirant', 'Reach level 10 (rank D)', 'level', 10, 100, 'Aspirant'),
    A('l25', 'Level', 'Scholar', 'Reach level 25 (rank C)', 'level', 25, 300, 'Scholar'),
    A('l40', 'Level', 'Strategist', 'Reach level 40 (rank B)', 'level', 40, 600, 'Strategist'),
    A('l55', 'Level', 'Officer in the making', 'Reach level 55 (rank A)', 'level', 55, 1000, 'Officer in the Making'),
    A('t50', 'Syllabus', 'Pathfinder', 'Finish 50 micro-topics', 'topics', 50, 50, 'Pathfinder'),
    A('t250', 'Syllabus', 'Cartographer', 'Finish 250 micro-topics', 'topics', 250, 150, 'Cartographer'),
    A('t1000', 'Syllabus', 'Syllabus slayer', 'Finish 1,000 micro-topics', 'topics', 1000, 400, 'Syllabus Slayer'),
    A('t2500', 'Syllabus', 'Encyclopaedia', 'Finish 2,500 micro-topics', 'topics', 2500, 800, 'Encyclopaedia'),
    A('h50', 'Study', 'Focused', 'Study for 50 hours in total', 'studyH', 50, 100, 'Focused'),
    A('h200', 'Study', 'Deep work', 'Study for 200 hours', 'studyH', 200, 300, 'Deep Worker'),
    A('h500', 'Study', 'Scholar’s grind', 'Study for 500 hours', 'studyH', 500, 700, 'Grandmaster'),
    A('ans30', 'Study', 'Pen is mighty', 'Write 30 answers', 'answers', 30, 100, 'Answer Writer'),
    A('ans100', 'Study', 'Hundred answers', 'Write 100 answers', 'answers', 100, 300, 'Wordsmith'),
    A('e7', 'Body', 'Early riser', 'Wake by 5:45 on 7 days', 'early', 7, 100, 'Early Riser'),
    A('e30', 'Body', 'Dawn patrol', 'Wake by 5:45 on 30 days', 'early', 30, 300, 'Dawn Patrol'),
    A('w30', 'Body', 'Iron habit', 'Finish 30 workouts', 'workouts', 30, 150, 'Iron Habit'),
    A('w100', 'Body', 'Forged', 'Finish 100 workouts', 'workouts', 100, 400, 'Forged'),
    A('st1', 'Body', 'Walker', 'Hit your step goal once', 'stepDays', 1, 30),
    A('st30', 'Body', 'Marathoner', 'Hit your step goal on 30 days', 'stepDays', 30, 300, 'Marathoner'),
    A('m1', 'Notes', 'First mark', 'Highlight or underline in a PDF', 'marks', 1, 20),
    A('m100', 'Notes', 'Annotator', 'Make 100 marks in your PDFs', 'marks', 100, 80, 'Annotator'),
    A('m500', 'Notes', 'Margin master', 'Make 500 marks', 'marks', 500, 200, 'Margin Master'),
    A('p10', 'Notes', 'Library', 'Keep 10 PDFs in LevelUp', 'pdfs', 10, 60),
    A('r1', 'Review', 'Reflective', 'Complete a weekly review', 'reviews', 1, 50),
    A('r4', 'Review', 'Honest mirror', 'Complete 4 weekly reviews', 'reviews', 4, 150, 'Honest Mirror'),
    A('r12', 'Review', 'Weekly ritual', 'Complete 12 weekly reviews', 'reviews', 12, 400, 'Ritualist'),
  ];
  const val = (a, S) => S[a.key] || 0;

  let checking = false;
  LU.checkAch = () => {
    if (checking || !LU.state) return;
    checking = true;
    try {
      const S = LU.achStats(), got = LU.state.ach = LU.state.ach || {}, fresh = [];
      LU.ACH.forEach((a) => { if (!got[a.id] && val(a, S) >= a.target) { got[a.id] = Date.now(); fresh.push(a); } });
      if (fresh.length) {
        fresh.forEach((a) => { LU.gainXP(a.xp); LU.log('Achievement: ' + a.name, a.xp); });
        LU.save();
        fresh.forEach((a) => LU.celebrate((done) => {
          LU.sfx('clear'); LU.vibrate(40);
          LU.overlay(`<div class="win gold"><div class="win-in"><div class="win-h">ACHIEVEMENT</div>
            <div style="display:grid;place-items:center;margin:6px 0 10px;color:var(--gold)"><span class="achic big">${I('trophy')}</span></div>
            <p class="quote" style="font-size:21px;text-align:center">${esc(a.name)}</p>
            <p class="sysline" style="text-align:center">${esc(a.desc)}. Reward: <b>+${a.xp} XP</b>.${a.title ? `<br>New title unlocked: <b>${esc(a.title)}</b>.` : ''}</p>
            <button class="btn gold block later" data-act="closeOv">Continue</button></div></div>`, done);
        }));
      }
    } finally { checking = false; }
  };

  LU.titleOf = () => {
    const s = LU.state, a = s.title && LU.ACH.find((x) => x.id === s.title && s.ach && s.ach[x.id]);
    return a ? a.title : LU.levelInfo().rank.title;
  };

  /* ---------- screen ---------- */
  LU.views.achievements = {
    render() {
      const s = LU.state, S = LU.achStats(), got = s.ach || {};
      const total = LU.ACH.length, n = LU.ACH.filter((a) => got[a.id]).length;
      const cats = [];
      LU.ACH.forEach((a) => { if (!cats.includes(a.cat)) cats.push(a.cat); });
      return `<div class="topbar"><button class="iconbtn" data-act="back">${I('back')}</button><h1>Achievements<span class="sub">${n} of ${total} unlocked</span></h1></div>
      <section class="win gold"><div class="win-in" style="padding:14px 16px"><div class="win-h">TITLE</div>
        <div class="row"><span class="bossic gold">${I('trophy')}</span><div class="grow"><div style="font:700 18px var(--fd)">${esc(LU.titleOf())}</div><div class="small muted">Shown on your Status window. Unlock more titles below.</div></div></div>
        ${s.title ? `<button class="btn ghost sm" style="margin-top:10px" data-act="achEquip" data-id="">Use my rank title</button>` : ''}</div></section>
      ${cats.map((c) => `<div class="sec-title">${c}</div><div class="list">${LU.ACH.filter((a) => a.cat === c).map((a) => {
        const v = Math.min(val(a, S), a.target), ok = !!got[a.id];
        return `<div class="li ach ${ok ? 'on' : ''}"><span class="achic">${I(ok ? 'trophy' : 'star')}</span><div class="grow"><div class="lt">${esc(a.name)}${a.title && ok ? ` <span class="pill gold" style="margin-left:6px">${esc(a.title)}</span>` : ''}</div>
          <div class="ls">${esc(a.desc)}</div>${ok ? `<div class="tiny dim" style="margin-top:3px">Unlocked ${LU.niceDate(LU.keyOf(new Date(got[a.id] - 3 * 3600e3)), false)} · +${a.xp} XP</div>` : `<div style="margin-top:6px">${LU.bar(v / a.target, 'thin')}</div><div class="tiny dim" style="margin-top:3px">${LU.fmt(v)} / ${LU.fmt(a.target)} · +${a.xp} XP</div>`}</div>
          ${ok && a.title ? `<button class="btn ghost sm" data-act="achEquip" data-id="${a.id}">${s.title === a.id ? 'In use' : 'Use'}</button>` : ''}</div>`;
      }).join('')}</div>`).join('')}
      <div style="height:16px"></div>`;
    },
  };
  LU.actions.achEquip = (el) => { LU.state.title = el.dataset.id || null; LU.save(); LU.render(); };
  LU.actions.openAch = () => LU.push('achievements');
})();
