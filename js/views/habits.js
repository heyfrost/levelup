/* Part 10: focus timer, light day, and the Study tools hub. */
(function () {
  const LU = window.LU, esc = LU.esc, I = LU.icon, A = window.Android;
  const today = () => LU.todayKey();

  /* =========================================================
     Focus timer (Pomodoro style). Counts as extra study time and XP.
     It keeps running if you leave the app: the end time is saved.
     ========================================================= */
  const F = () => { const s = LU.state; s.focusCfg = Object.assign({ mins: 25 }, s.focusCfg || {}); return s.focusCfg; };
  const PRESETS = [15, 25, 45, 50, 90];
  const endOf = (f) => f.start + f.mins * 60000;
  LU.focusStart = (mins, label, subj) => { LU.state.focus = { start: Date.now(), mins, label: label || '', subj: subj || '' }; LU.save(); if (LU.syncReminders) LU.syncReminders(true); };
  const award = (f, min) => {
    if (min < 1) return { min: 0, xp: 0 };
    const k = LU.keyOf(new Date(f.start - 3 * 3600e3)), d = LU.day(k);
    d.extraMin = (d.extraMin || 0) + min;
    d.focusN = (d.focusN || 0) + 1;
    { const m = (d.subjMin = d.subjMin || {}), sj = f.subj || '_'; m[sj] = (m[sj] || 0) + min; }
    const st = LU.state.stats; st.int = (st.int || 0) + Math.floor(min / 30);
    LU.gainXP(min); LU.log('Focus session · ' + LU.dur(min), min);
    LU.checkBoss && LU.checkBoss(k);
    return { min, xp: min };
  };
  /* finish: full time if the clock ran out, otherwise the minutes done (5 or more) */
  LU.focusFinish = (early) => {
    const f = LU.state.focus; if (!f) return null;
    const ran = Math.min(f.mins, Math.round((Date.now() - f.start) / 60000));
    const min = early ? (ran >= 5 ? ran : 0) : f.mins;
    LU.state.focus = null;
    const r = award(f, min);
    LU.save(); if (LU.syncReminders) LU.syncReminders(true);
    return Object.assign({ early, ran }, r);
  };
  const checkDone = () => {
    const f = LU.state.focus;
    if (f && Date.now() >= endOf(f)) {
      const r = LU.focusFinish(false);
      LU.sfx && LU.sfx('clear'); LU.vibrate && LU.vibrate(80);
      LU.toast('Focus session done. +' + r.xp + ' XP', { sys: false });
      if (LU.top() && LU.top().name === 'focus') LU.render();
      return true;
    }
    return false;
  };
  LU.focusCheck = checkDone;
  let tickId = null;
  const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  const startTick = () => {
    if (tickId) return;
    tickId = setInterval(() => {
      const el = document.getElementById('fcClock');
      if (!el) { clearInterval(tickId); tickId = null; checkDone(); return; }
      const f = LU.state.focus; if (!f) return;
      if (checkDone()) return;
      el.textContent = mmss(endOf(f) - Date.now());
      const b = document.getElementById('fcBar'); if (b) b.style.width = Math.min(100, ((Date.now() - f.start) / (f.mins * 60000)) * 100) + '%';
    }, 500);
  };
  LU.views.focus = {
    render() {
      const f = LU.state.focus, d = LU.peekDay(today()) || {}, c = F();
      const head = `<div class="topbar"><button class="iconbtn" data-act="back">${I('back')}</button><h1>Focus timer<span class="sub">Study without your phone</span></h1></div>`;
      if (f) {
        return head + `<div class="card" style="text-align:center"><div class="small muted">${esc(f.label || 'Focusing')} · ${f.mins} min</div>
          <div id="fcClock" style="font:800 64px var(--fd);margin:8px 0">${mmss(endOf(f) - Date.now())}</div>
          <div class="bar"><i id="fcBar" style="width:${Math.min(100, ((Date.now() - f.start) / (f.mins * 60000)) * 100)}%"></i></div>
          <div class="small muted" style="margin-top:12px">You can leave the app. A reminder rings when time is up.</div>
          <button class="btn danger block" style="margin-top:14px" data-act="fcStop">Stop now</button></div>`;
      }
      return head + `<div class="card"><div class="lt" style="margin-bottom:10px">Session length</div>
        <div class="chips" style="margin:0 -2px">${PRESETS.map((m) => `<button class="chip ${c.mins === m ? 'on' : ''}" data-act="fcMins" data-m="${m}">${m} min</button>`).join('')}</div>
        <div class="field" style="margin-top:12px"><label>Subject (so your study time is counted by subject)</label><select class="inp" id="fcS"><option value="">No subject</option>${LU.syllabus.map((x) => `<option value="${x.id}" ${c.subj === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
        <div class="field"><label>What are you studying? (optional)</label><input class="inp" id="fcL" maxlength="40" placeholder="e.g. Polity, Fundamental Rights"></div>
        <button class="btn block" data-act="fcGo">${I('play')}Start ${c.mins} minutes</button></div>
        <div class="list" style="margin-top:12px"><div class="li"><div class="grow lt">Sessions today</div><b class="num">${d.focusN || 0}</b></div><div class="li"><div class="grow lt">Extra study today</div><b class="num">${LU.dur(d.extraMin || 0)}</b></div></div>
        <div class="card small muted" style="margin-top:12px">You earn 1 XP per minute and the minutes count toward your weekly boss. Stopping after 5 minutes or more still counts what you did.</div>`;
    },
    mount() { if (LU.state.focus) startTick(); },
  };
  LU.actions.openFocus = () => { LU.push('focus'); };
  LU.actions.fcMins = (el) => { F().mins = +el.dataset.m; LU.save(); LU.render(); };
  LU.actions.fcGo = () => { const l = document.getElementById('fcL'), sb = document.getElementById('fcS'); F().subj = sb ? sb.value : ''; LU.focusStart(F().mins, l ? l.value.trim() : '', F().subj); LU.sfx && LU.sfx('tap'); LU.render(); };
  LU.actions.fcStop = () => LU.confirm('Stop this session?', 'Minutes done so far are kept if it was 5 or more.', 'Stop', () => {
    const r = LU.focusFinish(true);
    LU.toast(r && r.xp ? 'Saved ' + r.min + ' min. +' + r.xp + ' XP' : 'Stopped. Under 5 minutes does not count.', { sys: false }); LU.render();
  }, true);
  /* end-of-session alarm goes through the normal reminder pipe */
  const baseBuild = LU.buildReminders;
  LU.buildReminders = () => {
    const out = baseBuild(), f = LU.state.focus;
    if (f && endOf(f) > Date.now() + 3000) out.push({ at: endOf(f), title: 'Focus session finished', text: 'Open LevelUp to collect your XP. Take a short break.' });
    return out.sort((a, b) => a.at - b.at);
  };
  window.addEventListener('focus', () => checkDone());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDone(); });
  setTimeout(checkDone, 1500);

  /* =========================================================
     Light day: drops the heavy extras so a tired day still counts
     ========================================================= */
  const LIGHT_SKIP = ['workout', 'answer', 'essay', 'csat', 'mock', 'ca', 'buffer', 'routine'];
  LU.isLight = (k) => !!((LU.peekDay(k) || {}).low);
  const baseQuests = LU.questsFor;
  LU.questsFor = (k) => {
    const qs = baseQuests(k);
    if (LU.isLight(k)) qs.forEach((q) => { if (q.src === 'block' && LIGHT_SKIP.includes(q.kind)) { q.skipped = true; q.light = true; } });
    return qs;
  };
  LU.actions.toggleLight = () => {
    const k = LU.todayKey(), d = LU.day(k);
    d.low = d.low ? 0 : 1;
    LU.save(); if (LU.syncReminders) LU.syncReminders(true);
    LU.toast(d.low ? 'Light day on. Heavy extras are set aside, your streak is safe.' : 'Back to the full plan.', { sys: false });
    LU.render();
  };
  LU.questExtras = (k) => {
    if (k !== today()) return '';
    const on = LU.isLight(k);
    return (LU.revCard ? LU.revCard() : '') + `<div class="card tap" data-act="toggleLight" style="display:flex;align-items:center;gap:12px"><span class="lic">${I('moon')}</span><div class="grow"><div class="lt">Light day</div><div class="small muted">${on ? 'On: workout, answer writing, mocks and other extras are set aside' : 'Tired today? Keep only the essentials. Your streak stays safe.'}</div></div><span class="switch ${on ? 'on' : ''}"></span></div>`;
  };

  /* =========================================================
     Study tools hub (More > Study tools)
     ========================================================= */
  const li = (act, icon, title, sub) => `<div class="li" data-act="${act}"><span class="lic">${I(icon)}</span><div class="grow"><div class="lt">${title}</div>${sub ? `<div class="ls">${sub}</div>` : ''}</div><span class="chev">${I('chev')}</span></div>`;
  LU.views.tools = {
    render() {
      const due = LU.revDue().length, m = (LU.state.mocks || []).length, mc = LU.state.mcq || { sets: [] }, aw = LU.state.aw || { log: {}, target: 1 }, k = today();
      return `<div class="topbar"><button class="iconbtn" data-act="back">${I('back')}</button><h1>Study tools<span class="sub">Practice, revision and tracking</span></h1></div>
        <div class="list">
          ${li('openRevDue', 'loop', 'Revision', due ? due + ' topic' + (due > 1 ? 's' : '') + ' due now' : 'Nothing due. Spaced at 1, 7, 30, 90 days')}
          ${li('openMcq', 'target', 'Practice MCQs', (mc.sets || []).length ? (mc.sets.length + ' set' + (mc.sets.length > 1 ? 's' : '')) : 'Paste your own questions and practise')}
          ${li('openMocks', 'chart', 'Mock tests', m ? m + ' logged' : 'Log scores and see your trend')}
          ${li('openAnswers', 'pen', 'Answer writing', (aw.log[k] || 0) + ' of ' + aw.target + ' today')}
          ${li('openCA', 'news', 'Current affairs', (LU.state.ca || []).length + ' notes')}
          ${li('openCoverage', 'map', 'Coverage map', 'See what is learned, revised and strong')}
          ${li('openFocus', 'clock', 'Focus timer', LU.state.focus ? 'Running now' : 'Timed study sessions')}
        </div><div style="height:20px"></div>`;
    },
  };
  LU.actions.openTools = () => LU.push('tools');
  const prev = LU.more3;
  LU.more3 = () => `
      <div class="sec-title">Study tools</div>
      <div class="list">${li('openTools', 'target', 'Study tools', 'Revision, MCQs, mock tests, answers, current affairs, focus timer')}</div>` + prev();
})();
