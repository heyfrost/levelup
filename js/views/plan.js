/* Plan: tomorrow's to-do list on top of the default routine */
(function () {
  const LU = window.LU, esc = LU.esc, I = LU.icon;
  let offset = 1, draftTime = '', draftStat = 'dsc';

  LU.views.plan = {
    render() {
      const today = LU.todayKey(), k = LU.addDays(today, offset);
      const d = LU.peekDay(k) || { tasks: [] };
      const td = LU.peekDay(today) || { tasks: [], done: {} };
      const leftToday = (td.tasks || []).filter((t) => !(td.done || {})[t.id]);
      const blocks = LU.questsFor(k).filter((q) => q.src === 'block' && !q.skipped);
      const s = LU.state, ng = LU.nextTopic(s.syl.focus.gs), no = LU.nextTopic(s.syl.focus.opt);
      const sugg = [];
      if (ng) sugg.push('Read: ' + ng.t);
      if (no) sugg.push('Anthropology: ' + no.t);
      sugg.push('Revise yesterday’s notes', 'Practise 25 Prelims MCQs', 'Read The Hindu editorial', 'Make short notes for revision');
      const tasks = (d.tasks || []).slice().sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
      const label = offset === 1 ? 'Tomorrow' : offset === 0 ? 'Today' : LU.dayName(k);
      return `
      <div class="topbar"><h1>Plan ${label.toLowerCase() === 'today' ? 'today' : label}<span class="sub">${LU.niceDate(k)} · ${LU.dayTypeName[LU.dayType(k)]}</span></h1>
        <div class="daynav"><button class="iconbtn" data-act="pDay" data-d="-1" aria-label="Previous day">${I('left')}</button><button class="iconbtn" data-act="pDay" data-d="1" aria-label="Next day">${I('right')}</button></div></div>

      <section class="win"><div class="win-in"><div class="win-h">QUEST PLANNING</div>
        <p class="small muted" style="margin:0 0 12px">Write what you will do ${offset === 1 ? 'tomorrow' : 'this day'}. These tasks join your daily routine as quests, worth 20 XP each.</p>
        <div class="adder"><input id="pAdd" placeholder="e.g. Finish Polity: Emergency provisions" maxlength="140"><button class="addbtn" data-act="pAddTask" aria-label="Add">${I('plus')}</button></div>
        <div class="optrow"><button class="chip ${draftTime ? 'on' : ''}" data-act="pTime">${I('clock')}${draftTime ? LU.t12(draftTime) : 'Any time'}</button>
          ${Object.keys(LU.STATS).map((x) => `<button class="chip ${draftStat === x ? 'on' : ''}" data-act="pStat" data-s="${x}">${LU.STATS[x].short}</button>`).join('')}</div>
      </div></section>

      <div class="sec-title">Planned tasks <span class="muted">${tasks.length}</span></div>
      ${tasks.map((t) => `<div class="task"><div class="grow"><div class="tt">${esc(t.title)}</div><div class="tiny muted" style="margin-top:2px">${t.time ? `<span class="tm2">${LU.t12(t.time)}</span> · ` : ''}${LU.STATS[t.stat || 'dsc'].name}</div></div>
        <button class="iconbtn" data-act="pEdit" data-id="${t.id}" aria-label="Edit">${I('edit')}</button><button class="iconbtn" data-act="pDel" data-id="${t.id}" aria-label="Delete">${I('trash')}</button></div>`).join('') || `<div class="empty">${I('plan')}Nothing planned yet. Add the first task above, or pick a suggestion.</div>`}

      ${offset >= 1 && leftToday.length ? `<div class="card"><div class="row"><div class="grow"><b>${leftToday.length} unfinished task${leftToday.length > 1 ? 's' : ''} today</b><div class="small muted">Carry ${leftToday.length > 1 ? 'them' : 'it'} over so nothing slips.</div></div><button class="btn ghost sm" data-act="pCarry">Move to ${label.toLowerCase()}</button></div></div>` : ''}

      <div class="sec-title">Suggestions</div>
      <div class="chips" style="flex-wrap:wrap;margin:0;padding:0">${sugg.map((x) => `<button class="chip" data-act="pSugg" data-t="${esc(x)}" style="max-width:100%">${I('plus')}<span class="ell">${esc(x)}</span></button>`).join('')}</div>

      <div class="sec-title">Default routine <span class="muted">${blocks.length} quests</span><a class="link" data-act="pEditRoutine" data-t="${LU.dayType(k)}">Edit</a></div>
      <div class="card" style="padding:6px 14px">${blocks.map((b) => `<div class="mini"><span>${LU.t12(b.start)}</span><span class="grow">${esc(b.title)}</span></div>`).join('')}</div>
      <div style="height:16px"></div>`;
    },
    mount(el) {
      const inp = LU.$('#pAdd', el);
      if (inp) inp.onkeydown = (e) => { if (e.key === 'Enter') LU.actions.pAddTask(); };
    },
  };
  const key = () => LU.addDays(LU.todayKey(), offset);
  const addTask = (title) => {
    LU.day(key()).tasks.push({ id: 't' + LU.uid(), title, time: draftTime || '', stat: draftStat, xp: 20 });
    LU.save(); LU.sfx('tap');
  };
  LU.actions.pDay = (el) => { offset = LU.clamp(offset + +el.dataset.d, 0, 7); LU.render(false); };
  LU.actions.pAddTask = () => {
    const inp = LU.$('#pAdd'); const v = inp && inp.value.trim(); if (!v) { inp && inp.focus(); return; }
    addTask(v); LU.render(); setTimeout(() => { const i = LU.$('#pAdd'); i && i.focus(); }, 30);
  };
  LU.actions.pSugg = (el) => { addTask(el.dataset.t); LU.render(); LU.toast('Added to ' + (offset === 1 ? 'tomorrow' : LU.niceDate(key())), { sys: false, ms: 1500 }); };
  LU.actions.pStat = (el) => { draftStat = el.dataset.s; LU.render(); };
  LU.actions.pTime = () => {
    LU.sheet({
      title: 'Task time', body: `<div class="field"><label>Time (optional)</label><input class="inp" type="time" id="ptv" value="${draftTime}"></div>`,
      foot: `<button class="btn ghost" id="ptClr">Any time</button><button class="btn" id="ptOk">Set time</button>`,
      mount: (s) => { LU.$('#ptOk', s).onclick = () => { draftTime = LU.$('#ptv', s).value; LU.closeSheet(); LU.render(); }; LU.$('#ptClr', s).onclick = () => { draftTime = ''; LU.closeSheet(); LU.render(); }; },
    });
  };
  LU.actions.pDel = (el) => {
    const d = LU.day(key()), i = d.tasks.findIndex((t) => t.id === el.dataset.id); if (i < 0) return;
    const [t] = d.tasks.splice(i, 1); LU.save(); LU.render();
    LU.toast('Task deleted', { undo: () => { d.tasks.splice(i, 0, t); LU.save(); LU.render(); } });
  };
  LU.actions.pEdit = (el) => {
    const t = LU.day(key()).tasks.find((x) => x.id === el.dataset.id); if (!t) return;
    LU.sheet({
      title: 'Edit task',
      body: `<div class="field"><label>Task</label><textarea class="inp" id="peT" rows="2">${esc(t.title)}</textarea></div>
        <div class="two"><div class="field"><label>Time</label><input class="inp" type="time" id="peTm" value="${t.time || ''}"></div>
        <div class="field"><label>Stat</label><select class="inp" id="peS">${Object.keys(LU.STATS).map((x) => `<option value="${x}" ${t.stat === x ? 'selected' : ''}>${LU.STATS[x].name}</option>`).join('')}</select></div></div>`,
      foot: `<button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn" id="peOk">Save</button>`,
      mount: (s) => { LU.$('#peOk', s).onclick = () => { const v = LU.$('#peT', s).value.trim(); if (!v) return; t.title = v; t.time = LU.$('#peTm', s).value; t.stat = LU.$('#peS', s).value; LU.save(); LU.closeSheet(); LU.render(); }; },
    });
  };
  LU.actions.pCarry = () => {
    const today = LU.todayKey(), td = LU.day(today), nd = LU.day(key());
    const left = td.tasks.filter((t) => !td.done[t.id]);
    left.forEach((t) => nd.tasks.push(Object.assign({}, t, { id: 't' + LU.uid() })));
    td.tasks = td.tasks.filter((t) => td.done[t.id]);
    LU.save(); LU.render(); LU.toast(`Moved ${left.length} task${left.length > 1 ? 's' : ''}`);
  };
  LU.actions.pEditRoutine = (el) => LU.push('routine', { t: el.dataset.t });
})();
