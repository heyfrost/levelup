/* More: settings and editors for routine, checklist, workout, quotes, goals, backup */
(function () {
  const LU = window.LU, esc = LU.esc, I = LU.icon;
  const li = (act, icon, title, sub, extra = '', data = '') => `<div class="li" data-act="${act}" ${data}><span class="lic">${I(icon)}</span><div class="grow"><div class="lt">${title}</div>${sub ? `<div class="ls">${sub}</div>` : ''}</div>${extra || `<span class="chev">${I('chev')}</span>`}</div>`;
  const sw = (on) => `<span class="switch ${on ? 'on' : ''}"></span>`;
  const TN = { weekday: 'Weekday', sat: 'Saturday', sun: 'Sunday' };

  LU.views.more = {
    render() {
      const s = LU.state, st = s.settings, L = LU.levelInfo();
      return `<div class="topbar"><h1>More</h1></div>
      <div class="card tap" data-act="mName"><div class="row">${LU.rankBadge(L.rank.r)}<div class="grow"><div style="font:700 18px var(--fd)">${esc(st.name)}</div><div class="small muted">Level ${L.level} · ${LU.fmt(s.xp)} XP total · best streak ${LU.bestStreak()} days</div></div><span class="dim">${I('edit')}</span></div></div>

      <div class="sec-title">Routine</div>
      <div class="list">
        ${['weekday', 'sat', 'sun'].map((t) => li('openRoutine', 'clock', TN[t] + ' routine', `${(s.schedule[t] || []).length} blocks`, '', `data-t="${t}"`)).join('')}
        ${li('openPush', 'check', 'Daily checklist', `${s.checklist.length} items: hygiene, water, newspaper`, '', 'data-v="checklist"')}
        ${li('openPush', 'dumbbell', 'Workout plan', 'Exercises for each day of the week', '', 'data-v="workout"')}
        ${li('openPush', 'quote', 'Morning quotes', `${s.quotes.length} quotes`, '', 'data-v="quotes"')}
      </div>

      <div class="sec-title">Goals</div>
      <div class="list">
        ${li('goals', 'flag', 'Exam and targets', `Prelims ${LU.niceDate(st.examDate, false)} · syllabus by ${LU.niceDate(st.syllabusTarget, false)}`)}
        ${li('goals', 'sword', 'Weekly boss', `${st.bossHours} study hours a week`)}
        ${li('answerPlan', 'pen', 'Answer writing rotation', 'Which paper to write each day')}
      </div>

      ${LU.more3()}

      <div class="sec-title">App</div>
      <div class="list">
        ${li('tog', 'volume', 'Sounds', 'Chimes when you complete quests', sw(st.sound), 'data-k="sound"')}
        ${li('tog', 'phone', 'Vibration', 'Haptic feedback on actions', sw(st.haptics), 'data-k="haptics"')}
        ${li('tog', 'sun', 'Morning screen', 'Quote and day briefing on first open', sw(st.morning), 'data-k="morning"')}
        ${li('openPush', 'list', 'Activity log', 'Every XP you earned', '', 'data-v="log"')}
      </div>

      <div class="sec-title">Your data</div>
      <div class="list">
        ${li('backup', 'save', 'Back up now', s.lastBackup ? 'Progress and PDF marks. Last backup ' + new Date(s.lastBackup).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Saves a file to Download/LevelUp')}
        ${LU.native ? li('', 'save', 'Automatic backup', s.autoBackupAt ? 'Saved daily and weekly to Download/LevelUp. Last: ' + new Date(s.autoBackupAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Saved daily and weekly to Download/LevelUp once the app is open', ' ') : ''}
        ${LU.lockRows ? LU.lockRows() : ''}
        ${li('backupFull', 'save', 'Full backup with PDFs', 'One .levelup file: progress, marks and all PDFs')}
        ${li('openSync', 'send', 'Sync with another device', 'Phone and iPad on the same Wi-Fi')}
        ${li('restore', 'upload', 'Restore from backup', 'Pick a backup file (.json or .levelup)')}
        ${li('resetSyl', 'reset', 'Reset syllabus edits', 'Brings back the original topic list, keeps ticks')}
        ${li('wipe', 'trash', 'Erase everything', 'Start again from level 1')}
        ${li('storage', 'notes', 'Storage used', 'PDFs kept inside LevelUp')}
      </div>
      <p class="tiny dim" style="text-align:center;margin:18px 0 8px">LevelUp 2.0 · Part 13 · All data stays on this phone</p>
      <input type="file" id="restoreFile" hidden>`;
    },
    mount(el) {
      const f = LU.$('#restoreFile', el);
      f.onchange = () => {
        const file = f.files[0]; if (!file) return;
        f.value = ''; LU.restoreAny(file);
      };
    },
  };
  LU.actions.openRoutine = (el) => LU.push('routine', { t: el.dataset.t });
  LU.actions.openPush = (el) => LU.push(el.dataset.v);
  LU.actions.tog = (el) => { const k = el.dataset.k; LU.state.settings[k] = !LU.state.settings[k]; LU.save(); LU.render(); if (k === 'sound' && LU.state.settings.sound) LU.sfx('done'); if (k === 'haptics') LU.vibrate(30); };
  LU.actions.mName = () => LU.sheet({
    title: 'Your name', body: `<div class="field"><label>Shown on your status window</label><input class="inp" id="nmv" maxlength="30" value="${esc(LU.state.settings.name)}"></div>`,
    foot: `<button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn" id="nmOk">Save</button>`,
    mount: (s) => { LU.$('#nmOk', s).onclick = () => { const v = LU.$('#nmv', s).value.trim(); if (v) { LU.state.settings.name = v; LU.save(); } LU.closeSheet(); LU.render(); }; },
  });
  LU.actions.goals = () => {
    const st = LU.state.settings;
    LU.sheet({
      title: 'Exam and targets',
      body: `<div class="field"><label>Prelims exam date</label><input class="inp" type="date" id="gE" value="${st.examDate}"></div>
        <div class="field"><label>Exam start time (the countdown runs to this)</label><input class="inp" type="time" id="gT" value="${st.examTime || '09:30'}"></div>
        <div class="field"><label>Application reminder (notification usually in February)</label><input class="inp" type="date" id="gA" value="${st.applyDate}"></div>
        <div class="field"><label>Finish syllabus by</label><input class="inp" type="date" id="gS" value="${st.syllabusTarget}"></div>
        <div class="two"><div class="field"><label>Weekly boss: study hours</label><input class="inp" type="number" min="5" max="80" id="gB" value="${st.bossHours}"></div>
        <div class="field"><label>Daily clear at (% of XP)</label><input class="inp" type="number" min="30" max="100" id="gC" value="${st.clearAt}"></div></div>`,
      foot: `<button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn" id="gOk">Save</button>`,
      mount: (s) => {
        LU.$('#gOk', s).onclick = () => {
          const v = (id) => LU.$(id, s).value;
          if (v('#gE')) st.examDate = v('#gE'); if (v('#gT')) st.examTime = v('#gT'); if (v('#gA')) st.applyDate = v('#gA'); if (v('#gS')) st.syllabusTarget = v('#gS');
          st.bossHours = LU.clamp(+v('#gB') || 30, 5, 80); st.clearAt = LU.clamp(+v('#gC') || 70, 30, 100);
          LU.save(); LU.closeSheet(); LU.render(); LU.toast('Targets saved');
        };
      },
    });
  };
  LU.actions.answerPlan = () => {
    const ap = LU.state.settings.answerPlan, D = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    LU.sheet({
      title: 'Answer writing rotation',
      body: D.map((d, i) => `<div class="field"><label>${d}</label><input class="inp" id="ap${i}" value="${esc(ap[i])}" maxlength="40"></div>`).join(''),
      foot: `<button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn" id="apOk">Save</button>`,
      mount: (s) => { LU.$('#apOk', s).onclick = () => { D.forEach((_, i) => (ap[i] = LU.$('#ap' + i, s).value.trim() || ap[i])); LU.save(); LU.closeSheet(); LU.render(); }; },
    });
  };
  LU.actions.backup = async () => {
    const name = `LevelUp-backup-${LU.todayKey()}.json`;
    const where = LU.saveFile(name, await LU.exportAll());
    LU.state.lastBackup = Date.now(); LU.save(); LU.render();
    LU.toast(where && String(where).indexOf('Error') !== 0 ? `Saved to ${where}` : 'Backup could not be saved: ' + where, { ms: 4000 });
  };
  LU.actions.restore = () => LU.confirm('Restore a backup?', 'Your current progress on this phone will be replaced by the backup file.', 'Choose file', () => LU.$('#restoreFile').click());
  LU.actions.resetSyl = () => LU.confirm('Reset syllabus edits?', 'Renamed, added or deleted topics go back to the original list. Your ticks on original topics stay.', 'Reset', () => { LU.resetSyllabus(); LU.indexSyllabus(); LU.render(); LU.toast('Syllabus restored'); });
  LU.actions.storage = async () => {
    const ds = LU.docs(), size = ds.reduce((a, d) => a + (d.size || 0), 0);
    let est = ''; try { const e = await navigator.storage.estimate(); est = ` LevelUp is using about ${(e.usage / 1048576).toFixed(0)} MB in total.`; } catch (e) {}
    LU.sheet({ title: 'Storage used', body: `<p class="muted" style="margin:4px 0 12px">${ds.length} PDFs take ${(size / 1048576).toFixed(1)} MB.${est} PDFs are copied into LevelUp, so you can delete the downloaded originals if you need space, but keep them if you want to restore on a new phone: backups contain your marks, not the PDF files.</p>` });
  };
  LU.actions.wipe = () => LU.confirm('Erase everything?', 'All XP, levels, ticks, tasks and edits will be deleted from this phone. Make a backup first if you might want them.', 'Erase', () => { LU.wipe(); try { if (window.Android && Android.recFiles) String(Android.recFiles()).split(',').forEach((f) => f && Android.recDelete(f)); } catch (e) {} try { indexedDB.deleteDatabase('levelup-notes'); } catch (e) {} setTimeout(() => location.reload(), 300); }, true);

  /* ---------- routine editor ---------- */
  LU.views.routine = {
    render({ t }) {
      const list = (LU.state.schedule[t] || []).slice().sort((a, b) => LU.toMin(a.start) - LU.toMin(b.start));
      const study = list.filter((b) => LU.KINDS[b.kind] && LU.KINDS[b.kind].study).reduce((a, b) => a + LU.blockMin(b), 0);
      return `<div class="topbar"><button class="iconbtn" data-act="back">${I('back')}</button><h1>${TN[t]} routine<span class="sub">${list.length} blocks · ${LU.dur(study)} of planned study</span></h1></div>
        <div class="list">${list.map((b) => `<div class="blk" data-act="blkEdit" data-t="${t}" data-id="${b.id}"><span class="tm">${LU.t12(b.start)}<br><span class="dim">${LU.t12(b.end)}</span></span><span class="qi">${LU.kindIcon(b.kind)}</span><span class="bt">${esc(b.title)}<div class="tiny muted">${LU.KINDS[b.kind] ? LU.KINDS[b.kind].name : b.kind}${b.xp ? ` · ${b.xp} XP · ${LU.STATS[b.stat] ? LU.STATS[b.stat].short : ''}` : ''}</div></span><span class="dim">${I('chev')}</span></div>`).join('')}</div>
        <button class="btn block" data-act="blkAdd" data-t="${t}">${I('plus')}Add block</button>
        <div class="row" style="gap:8px;margin-top:12px">${t !== 'weekday' ? `<button class="btn ghost sm" data-act="blkCopy" data-t="${t}">Copy weekday routine</button>` : ''}<button class="btn ghost sm" data-act="blkReset" data-t="${t}">Restore default</button></div>
        <p class="tiny dim" style="margin-top:14px">Changes apply to every ${t === 'weekday' ? 'Monday to Friday' : TN[t]}. To skip a block only once, open it in Quests and choose Skip today.</p>`;
    },
  };
  LU.editBlock = (t, id) => {
    const list = LU.state.schedule[t]; const isNew = !id;
    const b = isNew ? { id: 'b' + LU.uid(), start: '18:00', end: '19:00', title: '', kind: 'study', stat: 'int', xp: 60 } : list.find((x) => x.id === id);
    if (!b) return;
    const kinds = Object.keys(LU.KINDS).filter((k) => k !== 'task' && k !== 'check');
    LU.sheet({
      title: isNew ? 'New block' : 'Edit block',
      body: `<div class="field"><label>Title</label><input class="inp" id="bT" value="${esc(b.title)}" maxlength="80" placeholder="e.g. Economy revision"></div>
        <div class="two"><div class="field"><label>Starts</label><input class="inp" type="time" id="bS" value="${b.start}"></div><div class="field"><label>Ends</label><input class="inp" type="time" id="bE" value="${b.end}"></div></div>
        <div class="two"><div class="field"><label>Type</label><select class="inp" id="bK">${kinds.map((k) => `<option value="${k}" ${b.kind === k ? 'selected' : ''}>${LU.KINDS[k].name}</option>`).join('')}</select></div>
        <div class="field"><label>XP reward</label><input class="inp" type="number" min="0" max="500" id="bX" value="${b.xp}"></div></div>
        <div class="field"><label>Stat it trains</label><div class="seg" id="bSt">${Object.keys(LU.STATS).map((x) => `<button type="button" data-s="${x}" class="${b.stat === x ? 'on' : ''}">${LU.STATS[x].name}</button>`).join('')}</div></div>
        <div class="field"><label>Show next topic from</label><div class="seg" id="bF">${[['', 'Nothing'], ['gs', 'Morning GS focus'], ['opt', 'Evening optional focus']].map(([v, n]) => `<button type="button" data-f="${v}" class="${(b.focus || '') === v ? 'on' : ''}">${n}</button>`).join('')}</div></div>
        <div class="field"><label>Note (optional)</label><textarea class="inp" id="bN" rows="2">${esc(b.note || '')}</textarea></div>
        <p class="tiny dim">Office type blocks are shown for reference and give no XP. Study types count toward the weekly boss.</p>`,
      foot: `${isNew ? '' : `<button class="btn danger" id="bDel">${I('trash')}</button>`}<button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn" id="bOk">Save</button>`,
      mount: (s) => {
        let stat = b.stat, focus = b.focus || '';
        LU.$$('#bSt button', s).forEach((x) => (x.onclick = () => { stat = x.dataset.s; LU.$$('#bSt button', s).forEach((y) => y.classList.toggle('on', y === x)); }));
        LU.$$('#bF button', s).forEach((x) => (x.onclick = () => { focus = x.dataset.f; LU.$$('#bF button', s).forEach((y) => y.classList.toggle('on', y === x)); }));
        LU.$('#bOk', s).onclick = () => {
          const title = LU.$('#bT', s).value.trim(); if (!title) { LU.$('#bT', s).focus(); return; }
          const st = LU.$('#bS', s).value, en = LU.$('#bE', s).value; if (!st || !en) return;
          Object.assign(b, { title, start: st, end: en, kind: LU.$('#bK', s).value, xp: LU.clamp(+LU.$('#bX', s).value || 0, 0, 500), stat, note: LU.$('#bN', s).value.trim() });
          if (focus) b.focus = focus; else delete b.focus;
          if (isNew) list.push(b);
          LU.save(); LU.closeSheet(); LU.render(); LU.toast(isNew ? 'Block added' : 'Block saved');
        };
        const del = LU.$('#bDel', s);
        if (del) del.onclick = () => { const i = list.indexOf(b); list.splice(i, 1); LU.save(); LU.closeSheet(); LU.render(); LU.toast('Block deleted', { undo: () => { list.splice(i, 0, b); LU.save(); LU.render(); } }); };
      },
    });
  };
  LU.actions.blkEdit = (el) => LU.editBlock(el.dataset.t, el.dataset.id);
  LU.actions.blkAdd = (el) => LU.editBlock(el.dataset.t);
  LU.actions.blkCopy = (el) => LU.confirm('Copy weekday routine?', `Your ${TN[el.dataset.t]} routine will be replaced with a copy of the weekday routine.`, 'Copy', () => { LU.state.schedule[el.dataset.t] = LU.clone(LU.state.schedule.weekday).map((b) => Object.assign(b, { id: 'b' + LU.uid() })); LU.save(); LU.render(); });
  LU.actions.blkReset = (el) => LU.confirm('Restore default routine?', `Your ${TN[el.dataset.t]} routine goes back to the original plan.`, 'Restore', () => { LU.state.schedule[el.dataset.t] = LU.clone(window.DEFAULTS.schedule[el.dataset.t]); LU.save(); LU.render(); });

  /* ---------- checklist editor ---------- */
  LU.views.checklist = {
    render() {
      const c = LU.state.checklist;
      return `<div class="topbar"><button class="iconbtn" data-act="back">${I('back')}</button><h1>Daily checklist<span class="sub">Untimed habits you tick once a day</span></h1></div>
        <div class="list">${c.map((x) => `<div class="li" data-act="ckEdit" data-id="${x.id}"><span class="lic">${I('check')}</span><div class="grow"><div class="lt">${esc(x.title)}</div><div class="ls">${x.xp} XP · ${LU.STATS[x.stat].name}</div></div><span class="chev">${I('chev')}</span></div>`).join('') || '<div class="empty">No checklist items.</div>'}</div>
        <button class="btn block" data-act="ckEdit">${I('plus')}Add item</button>`;
    },
  };
  LU.actions.ckEdit = (el) => {
    const list = LU.state.checklist, id = el.dataset.id, isNew = !id;
    const c = isNew ? { id: 'c' + LU.uid(), title: '', stat: 'vit', xp: 10 } : list.find((x) => x.id === id);
    LU.sheet({
      title: isNew ? 'New checklist item' : 'Edit item',
      body: `<div class="field"><label>Habit</label><input class="inp" id="cT" value="${esc(c.title)}" maxlength="60" placeholder="e.g. Cut nails on Sunday"></div>
        <div class="two"><div class="field"><label>Stat</label><select class="inp" id="cS">${Object.keys(LU.STATS).map((x) => `<option value="${x}" ${c.stat === x ? 'selected' : ''}>${LU.STATS[x].name}</option>`).join('')}</select></div>
        <div class="field"><label>XP</label><input class="inp" type="number" id="cX" min="0" max="200" value="${c.xp}"></div></div>`,
      foot: `${isNew ? '' : `<button class="btn danger" id="cDel">${I('trash')}</button>`}<button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn" id="cOk">Save</button>`,
      mount: (s) => {
        LU.$('#cOk', s).onclick = () => { const t = LU.$('#cT', s).value.trim(); if (!t) return; Object.assign(c, { title: t, stat: LU.$('#cS', s).value, xp: LU.clamp(+LU.$('#cX', s).value || 0, 0, 200) }); if (isNew) list.push(c); LU.save(); LU.closeSheet(); LU.render(); };
        const d = LU.$('#cDel', s); if (d) d.onclick = () => { list.splice(list.indexOf(c), 1); LU.save(); LU.closeSheet(); LU.render(); };
      },
    });
  };

  /* ---------- workout editor ---------- */
  let wday = new Date().getDay();
  LU.views.workout = {
    render() {
      const W = LU.state.workout, w = W[wday] || (W[wday] = { name: 'Rest', list: [] });
      const D = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return `<div class="topbar"><button class="iconbtn" data-act="back">${I('back')}</button><h1>Workout plan<span class="sub">Dumbbells, bench, ab roller, skipping rope</span></h1></div>
        <div class="chips">${D.map((d, i) => `<button class="chip ${i === wday ? 'on' : ''}" data-act="wDay" data-i="${i}">${d}</button>`).join('')}</div>
        <div class="card tap" data-act="wName"><div class="row"><div class="grow"><div class="tiny muted">Day name</div><div style="font:700 17px var(--fd)">${esc(w.name)}</div></div><span class="dim">${I('edit')}</span></div></div>
        <div class="list">${w.list.map((e, i) => `<div class="li" data-act="wEx" data-i="${i}"><span class="lic">${I('dumbbell')}</span><div class="grow"><div class="lt">${esc(e.name)}</div><div class="ls">${esc(e.sets)}</div></div><span class="chev">${I('chev')}</span></div>`).join('') || '<div class="empty">Rest day. Add exercises below.</div>'}</div>
        <button class="btn block" data-act="wEx">${I('plus')}Add exercise</button>`;
    },
  };
  LU.actions.wDay = (el) => { wday = +el.dataset.i; LU.render(); };
  LU.actions.wName = () => {
    const w = LU.state.workout[wday];
    LU.sheet({ title: 'Day name', body: `<div class="field"><label>e.g. Push, Pull, Legs and core</label><input class="inp" id="wn" value="${esc(w.name)}" maxlength="30"></div>`,
      foot: `<button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn" id="wnOk">Save</button>`,
      mount: (s) => { LU.$('#wnOk', s).onclick = () => { w.name = LU.$('#wn', s).value.trim() || w.name; LU.save(); LU.closeSheet(); LU.render(); }; } });
  };
  LU.actions.wEx = (el) => {
    const w = LU.state.workout[wday], i = el.dataset.i, isNew = i == null;
    const e = isNew ? { name: '', sets: '3 × 10' } : w.list[+i];
    LU.sheet({
      title: isNew ? 'Add exercise' : 'Edit exercise',
      body: `<div class="field"><label>Exercise</label><input class="inp" id="eN" value="${esc(e.name)}" maxlength="60" placeholder="e.g. Dumbbell bench press"></div><div class="field"><label>Sets and reps</label><input class="inp" id="eS" value="${esc(e.sets)}" maxlength="30"></div>`,
      foot: `${isNew ? '' : `<button class="btn danger" id="eDel">${I('trash')}</button>`}<button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn" id="eOk">Save</button>`,
      mount: (s) => {
        LU.$('#eOk', s).onclick = () => { const n = LU.$('#eN', s).value.trim(); if (!n) return; e.name = n; e.sets = LU.$('#eS', s).value.trim(); if (isNew) w.list.push(e); LU.save(); LU.closeSheet(); LU.render(); };
        const d = LU.$('#eDel', s); if (d) d.onclick = () => { w.list.splice(+i, 1); LU.save(); LU.closeSheet(); LU.render(); };
      },
    });
  };

  /* ---------- quotes editor ---------- */
  LU.views.quotes = {
    render() {
      const q = LU.state.quotes;
      return `<div class="topbar"><button class="iconbtn" data-act="back">${I('back')}</button><h1>Morning quotes<span class="sub">A different one greets you each day</span></h1></div>
        <button class="btn block" data-act="qtEdit">${I('plus')}Add quote</button>
        <div class="list">${q.map((x) => `<div class="li" data-act="qtEdit" data-id="${x.id}"><div class="grow"><div class="lt" style="font-weight:500">“${esc(x.q)}”</div><div class="ls" style="color:var(--cyan)">${esc(x.a)}</div></div></div>`).join('')}</div>`;
    },
  };
  LU.actions.qtEdit = (el) => {
    const list = LU.state.quotes, id = el.dataset.id, isNew = !id;
    const q = isNew ? { id: 'q' + LU.uid(), q: '', a: '' } : list.find((x) => x.id === id);
    LU.sheet({
      title: isNew ? 'Add quote' : 'Edit quote',
      body: `<div class="field"><label>Quote</label><textarea class="inp" id="qq" rows="4">${esc(q.q)}</textarea></div><div class="field"><label>Author</label><input class="inp" id="qa" value="${esc(q.a)}" maxlength="60"></div>`,
      foot: `${isNew ? '' : `<button class="btn danger" id="qDel">${I('trash')}</button>`}<button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn" id="qOk">Save</button>`,
      mount: (s) => {
        LU.$('#qOk', s).onclick = () => { const t = LU.$('#qq', s).value.trim(); if (!t) return; q.q = t.replace(/^["“]|["”]$/g, ''); q.a = LU.$('#qa', s).value.trim() || 'Unknown'; if (isNew) list.unshift(q); LU.save(); LU.closeSheet(); LU.render(); };
        const d = LU.$('#qDel', s); if (d) d.onclick = () => { list.splice(list.indexOf(q), 1); LU.save(); LU.closeSheet(); LU.render(); };
      },
    });
  };

  /* ---------- activity log ---------- */
  LU.views.log = {
    render() {
      const log = LU.state.log;
      let last = '';
      return `<div class="topbar"><button class="iconbtn" data-act="back">${I('back')}</button><h1>Activity log<span class="sub">Last ${log.length} entries</span></h1></div>
        ${log.map((e) => { const d = new Date(e.t), dk = d.toDateString(); const head = dk !== last ? `<div class="paper">${d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</div>` : ''; last = dk;
          return `${head}<div class="mini"><span>${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span><span class="grow">${esc(e.text)}</span><span class="xp" style="color:${e.xp < 0 ? 'var(--red)' : 'var(--gold)'}">${e.xp ? (e.xp > 0 ? '+' : '') + e.xp : ''}</span></div>`; }).join('') || '<div class="empty">Nothing yet. Complete a quest to start your log.</div>'}`;
    },
  };
})();
