/* Quests: today's timeline, checklist, my tasks, catch-up */
(function () {
  const LU = window.LU, esc = LU.esc, I = LU.icon;
  let viewKey = null, filter = 'all';
  const open = new Set();
  const BODY = ['wake', 'workout', 'hygiene', 'meal', 'sleep', 'check'];

  const editable = (k) => { const t = LU.todayKey(); return k === t || k === LU.addDays(t, -1); };

  const qRow = (q, k, flat) => {
    const now = LU.nowMin(), isToday = k === LU.todayKey();
    const st = q.start ? LU.toMin(q.start) : 0;
    const isNow = isToday && q.src === 'block' && !q.done && !q.info && now >= st && now < st + q.min;
    const cls = ['q', q.done ? 'done' : '', isNow ? 'now' : '', q.info ? 'info' : '', q.skipped ? 'skip' : '', q.missed ? 'missed' : ''].join(' ');
    const ex = open.has(q.id);
    let detail = '';
    if (ex) {
      let inner = '';
      if (q.list && q.list.length) inner += q.list.map((e) => `<div class="ex"><span>${esc(e.name)}</span><span>${esc(e.sets)}</span></div>`).join('');
      if (q.note) inner += `<div class="small muted" style="margin-top:6px">${esc(q.note)}</div>`;
      if (q.subjectId) inner += `<div class="small" style="margin-top:6px">Open the syllabus to tick topics as you finish them.</div>`;
      const acts = [];
      if (q.subjectId) acts.push(`<button class="btn ghost sm" data-act="openSubj" data-id="${q.subjectId}">${I('book')}Open ${esc(LU.subject(q.subjectId).name)}</button>`);
      if (q.subjectId && LU.docs && LU.docs().some((d) => d.subj === q.subjectId)) acts.push(`<button class="btn ghost sm" data-act="questNotes" data-id="${q.subjectId}">${I('notes')}Open notes</button>`);
      if (q.kind === 'office' && isToday) acts.push(`<button class="btn ghost sm" data-act="timer">${I(LU.state.timer ? 'stop' : 'play')}${LU.state.timer ? 'Stop study timer' : 'Start office study timer'}</button>`);
      if (q.kind === 'plan') acts.push(`<button class="btn ghost sm" data-act="tab" data-tab="plan">${I('plan')}Plan tomorrow</button>`);
      if (q.kind === 'buffer') acts.push(`<button class="btn ghost sm" data-act="jumpCatch">${I('loop')}See catch-up list</button>`);
      if (!q.info && !q.done && editable(k)) acts.push(`<button class="btn ghost sm" data-act="qSkip" data-id="${q.id}">${I('skip')}${q.skipped ? 'Un-skip' : 'Skip today'}</button>`);
      if (q.src === 'block') acts.push(`<button class="btn ghost sm" data-act="qEdit" data-id="${q.id}">${I('edit')}Edit</button>`);
      if (q.src === 'task') acts.push(`<button class="btn danger sm" data-act="qDelTask" data-id="${q.id}">${I('trash')}Delete</button>`);
      detail = `<div class="qd">${inner}<div class="qacts">${acts.join('')}</div></div>`;
    }
    const sub = q.sub ? `<div class="qs">${esc(q.sub)}</div>` : '';
    const xpl = q.info ? '' : q.missed ? `<div class="xp miss">Missed · 0 XP</div>` : `<div class="xp">+${q.xp} XP${q.done && q.src === 'block' && LU.peekDay(k) && LU.peekDay(k).done[q.id] && LU.peekDay(k).done[q.id].onTime ? ' · on time' : ''}</div>`;
    const right = q.info ? (q.kind === 'office' ? `<span class="pill dim">${LU.dur(q.min)}</span>` : '')
      : `<div class="chks"><button class="chk x ${q.missed ? 'on' : ''}" data-act="qMiss" data-id="${q.id}" aria-label="Mark missed">${I('x')}</button><button class="chk ${q.done ? 'on' : ''}" data-act="qDone" data-id="${q.id}" aria-label="Complete">${I('check')}</button></div>`;
    const card = `<div class="grow"><div class="qc" data-act="qOpen" data-id="${q.id}"><div class="qi">${LU.kindIcon(q.kind)}</div><div class="grow"><div class="qt">${esc(q.title)}</div>${sub}${q.time ? `<div class="qs">${LU.t12(q.time)}</div>` : ''}${xpl}</div>${right}</div>${detail}</div>`;
    if (flat) return `<div class="${cls}">${card}</div>`;
    return `<div class="${cls}"><div class="tm">${LU.t12(q.start).replace(/ (am|pm)/, '')}<small>${LU.t12(q.start).slice(-2)}</small></div><div class="dot"></div>${card}</div>`;
  };

  LU.views.quests = {
    render() {
      const today = LU.todayKey();
      const k = (viewKey = viewKey || today);
      const d = LU.peekDay(k) || { tasks: [] };
      const all = LU.questsFor(k), p = LU.dayProgress(k);
      const pass = (q) => filter === 'all' ? true : filter === 'left' ? !q.done && !q.info && !q.skipped : filter === 'study' ? LU.KINDS[q.kind] && LU.KINDS[q.kind].study : BODY.includes(q.kind);
      const blocks = all.filter((q) => q.src === 'block' && pass(q));
      const checks = all.filter((q) => q.src === 'check' && pass(q));
      const tasks = all.filter((q) => q.src === 'task' && pass(q));
      const back = LU.state.backlog.filter((b) => !b.done || b.doneOn === today);
      const rel = k === today ? 'Today' : k === LU.addDays(today, -1) ? 'Yesterday' : k === LU.addDays(today, 1) ? 'Tomorrow' : LU.niceDate(k);
      const streak = LU.streak();
      return `
      <div class="topbar"><h1>${rel}<span class="sub">${LU.niceDate(k)} · ${LU.dayTypeName[LU.dayType(k)]}</span></h1>
        <div class="daynav"><button class="iconbtn" data-act="qDay" data-d="-1" aria-label="Previous day">${I('left')}</button><button class="iconbtn" data-act="qDay" data-d="1" aria-label="Next day">${I('right')}</button></div></div>
      <div class="dayhead">${LU.ring(p.pct, p.pct * 100 >= LU.state.settings.clearAt ? 'var(--gold)' : 'var(--cyan)', Math.round(p.pct * 100) + '%')}
        <div class="grow"><div style="font:700 16px var(--fd)">${p.done} of ${p.n} quests done</div><div class="small muted">${LU.fmt(p.got)} / ${LU.fmt(p.tot)} XP. Clear ${LU.state.settings.clearAt}% for the daily bonus.</div>
        <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">${streak ? `<span class="pill gold">${I('fire')}${streak}-day streak</span>` : ''}${all.some((q) => q.missed) ? `<span class="pill red" data-act="missedSheet">${I('x')}${all.filter((q) => q.missed).length} missed</span>` : ''}</div></div></div>
      ${LU.questExtras ? LU.questExtras(k) : ''}
      ${!editable(k) ? `<div class="card small muted">${k > today ? 'This is a preview. Add tasks for tomorrow in the Plan tab.' : 'Past days are read-only. You can still tick yesterday.'}</div>` : ''}
      <div class="chips">${[['all', 'All'], ['left', 'Remaining'], ['study', 'Study'], ['body', 'Body and routine']].map(([f, n]) => `<button class="chip ${filter === f ? 'on' : ''}" data-act="qFilter" data-f="${f}">${n}</button>`).join('')}</div>

      ${blocks.length ? `<div class="tl">${blocks.map((q) => qRow(q, k)).join('')}</div>` : ''}

      ${checks.length ? `<div class="sec-title">Daily checklist <span class="muted">${checks.filter((q) => q.done).length}/${checks.length}</span></div><div class="flat">${checks.map((q) => qRow(q, k, true)).join('')}</div>` : ''}

      <div class="sec-title">My tasks <span class="muted">${tasks.filter((q) => q.done).length}/${tasks.length}</span></div>
      <div class="flat">${tasks.map((q) => qRow(q, k, true)).join('') || `<div class="small muted" style="padding:4px 2px 8px">No extra tasks${k === today ? ' today' : ''}. Plan them the night before in the Plan tab.</div>`}</div>
      ${editable(k) ? `<div class="adder"><input id="qAdd" placeholder="Add a task for ${k === today ? 'today' : 'this day'}" maxlength="140"><button class="addbtn" data-act="qAddTask" aria-label="Add task">${I('plus')}</button></div>` : ''}

      ${k === today && back.length ? `<div class="sec-title" id="catch">Catch-up <span class="muted">${back.filter((b) => !b.done).length} left</span></div>
        <div class="small muted" style="margin:-2px 2px 6px">Study you missed rolls here. Clear it in the Sunday catch-up block. Each gives 60% XP.</div>
        <div class="flat">${back.map((b) => `<div class="q ${b.done ? 'done' : ''}"><div class="grow"><div class="qc"><div class="qi">${LU.kindIcon(b.kind)}</div><div class="grow"><div class="qt">${esc(b.title)}</div><div class="qs">Missed on ${LU.niceDate(b.from)}${b.sub ? '. ' + esc(b.sub) : ''}</div><div class="xp">+${b.xp} XP</div></div><button class="chk ${b.done ? 'on' : ''}" data-act="bDone" data-id="${b.id}">${I('check')}</button></div></div></div>`).join('')}</div>
        ${back.some((b) => !b.done) ? `<button class="btn ghost sm" style="margin-top:8px" data-act="bClear">Dismiss all missed items</button>` : ''}` : ''}
      <div style="height:16px"></div>`;
    },
    mount(el) {
      const inp = LU.$('#qAdd', el);
      if (inp) inp.onkeydown = (e) => { if (e.key === 'Enter') LU.actions.qAddTask(); };
    },
  };
  LU.questsGoToday = () => { viewKey = LU.todayKey(); };

  const findQ = (id) => LU.questsFor(viewKey).find((q) => q.id === id);
  LU.actions.qDay = (el) => {
    const t = LU.todayKey(), nk = LU.addDays(viewKey, +el.dataset.d);
    if (LU.diffDays(t, nk) > 1) { LU.toast('You can look one day ahead. Plan further days in the Plan tab.'); return; }
    if (LU.diffDays(nk, t) > 30) return;
    viewKey = nk; open.clear(); LU.render(false);
  };
  LU.actions.qFilter = (el) => { filter = el.dataset.f; LU.render(); };
  LU.actions.qOpen = (el, e) => {
    if (e.target.closest('.chk')) return;
    const id = el.dataset.id; open.has(id) ? open.delete(id) : open.add(id); LU.render();
  };
  LU.actions.qDone = (el) => {
    const q = findQ(el.dataset.id); if (!q) return;
    if (!editable(viewKey)) { LU.toast(viewKey > LU.todayKey() ? 'That day has not started yet.' : 'Only today and yesterday can be changed.'); return; }
    if (q.done) {
      LU.uncomplete(viewKey, q); LU.sfx('undo'); LU.render(); return;
    }
    el.classList.add('on', 'pop');
    const rec = LU.complete(viewKey, q);
    if (rec) {
      LU.sfx('done'); LU.vibrate(18);
      LU.floatXP(el, `+${rec.xp} XP`);
      if (rec.onTime) setTimeout(() => LU.toast('On time: +20% XP and +1 Discipline'), 200);
    }
    setTimeout(() => LU.render(), 420);
  };
  LU.actions.qMiss = (el) => {
    const q = findQ(el.dataset.id); if (!q) return;
    if (!editable(viewKey)) { LU.toast(viewKey > LU.todayKey() ? 'That day has not started yet.' : 'Only today and yesterday can be changed.'); return; }
    const on = LU.toggleMiss(viewKey, q);
    LU.sfx(on ? 'undo' : 'tap'); LU.vibrate(12);
    LU.render();
  };
  LU.actions.missedSheet = () => {
    const c = LU.missedCounts(), list = LU.missedList();
    let last = '';
    const rows = list.slice(0, 120).map((x) => { const h = x.k !== last ? `<div class="paper" style="margin-top:8px">${LU.niceDate(x.k)}</div>` : ''; last = x.k; return `${h}<div class="li" style="min-height:44px"><span class="lic" style="color:var(--red);background:rgba(255,93,122,.12)">${I('x')}</span><div class="grow lt">${esc(x.t)}</div></div>`; }).join('');
    LU.sheet({ title: 'Missed quests', body: `<div class="row" style="gap:8px;margin-bottom:10px"><span class="pill red">This week ${c.week}</span><span class="pill red">This month ${c.month}</span><span class="pill dim">All time ${c.all}</span></div><div class="list">${rows || '<div class="empty">Nothing marked as missed. Tap the cross on a quest you did not do.</div>'}</div>` });
  };
  LU.actions.qSkip = (el) => { const q = findQ(el.dataset.id); if (q) { LU.toggleSkip(viewKey, q); LU.render(); } };
  LU.actions.qDelTask = (el) => {
    const d = LU.day(viewKey), i = d.tasks.findIndex((t) => t.id === el.dataset.id); if (i < 0) return;
    const [t] = d.tasks.splice(i, 1);
    if (d.done[t.id]) LU.uncomplete(viewKey, Object.assign({ src: 'task', kind: 'task' }, t));
    LU.save(); LU.render();
    LU.toast('Task deleted', { undo: () => { d.tasks.splice(i, 0, t); LU.save(); LU.render(); } });
  };
  LU.actions.qAddTask = () => {
    const inp = LU.$('#qAdd'); const v = inp && inp.value.trim(); if (!v) { inp && inp.focus(); return; }
    LU.day(viewKey).tasks.push({ id: 't' + LU.uid(), title: v, stat: 'dsc', xp: 20 });
    LU.save(); LU.sfx('tap'); LU.render();
    setTimeout(() => { const i = LU.$('#qAdd'); i && i.focus(); }, 30);
  };
  LU.actions.qEdit = (el) => { const q = findQ(el.dataset.id); if (q) LU.editBlock(LU.dayType(viewKey), q.id); };
  LU.actions.openSubj = (el) => LU.push('subject', { id: el.dataset.id });
  LU.actions.questNotes = (el) => {
    const sid = el.dataset.id, nx = LU.nextTopic(sid), ds = LU.docs().filter((d) => d.subj === sid);
    const path = nx ? new Set(LU.pathOf(nx.i).map((x) => x.i)) : new Set();
    const best = ds.find((d) => d.node && path.has(d.node)) || ds.slice().sort((a, b) => (b.opened || 0) - (a.opened || 0))[0];
    if (best) LU.openReader(best.id);
  };
  LU.actions.jumpCatch = () => { const c = LU.$('#catch'); if (c) c.scrollIntoView({ behavior: 'smooth' }); else LU.toast('Nothing in catch-up right now.'); };
  LU.actions.bDone = (el) => {
    const b = LU.state.backlog.find((x) => x.id === el.dataset.id); if (!b) return;
    if (b.done) { LU.undoBacklog(b); LU.sfx('undo'); }
    else { el.classList.add('on', 'pop'); LU.completeBacklog(b); LU.sfx('done'); LU.vibrate(18); LU.floatXP(el, `+${b.xp} XP`); }
    setTimeout(() => LU.render(), 380);
  };
  LU.actions.bClear = () => LU.confirm('Dismiss missed items?', 'They will be removed from catch-up without XP. Only do this if you have covered them another way.', 'Dismiss all', () => {
    LU.state.backlog = LU.state.backlog.filter((b) => b.done); LU.save(); LU.render();
  });
})();
