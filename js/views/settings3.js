/* Part 3 settings: Tracking and Reminders screens + their entries in More */
(function () {
  const LU = window.LU, esc = LU.esc, I = LU.icon;
  const sw = (on) => `<span class="switch ${on ? 'on' : ''}"></span>`;
  const li = (act, icon, title, sub, extra = '', data = '') => `<div class="li" data-act="${act}" ${data}><span class="lic">${I(icon)}</span><div class="grow"><div class="lt">${title}</div>${sub ? `<div class="ls">${sub}</div>` : ''}</div>${extra || `<span class="chev">${I('chev')}</span>`}</div>`;
  const status = (ok, yes, no) => `<span class="pill ${ok ? 'green' : 'red'}">${ok ? yes : no}</span>`;
  const A = window.Android;

  /* ---------- Tracking ---------- */
  LU.views.track = {
    render() {
      const t = LU.trk(), p = LU.perms(), d = LU.peekDay(LU.todayKey()) || {};
      return `<div class="topbar"><button class="iconbtn" data-act="back">${I('back')}</button><h1>Tracking<span class="sub">Automatic, nothing to type</span></h1></div>
      ${!LU.native ? `<div class="card small muted">Tracking works inside the installed app. In a browser you will only see this screen.</div>` : ''}
      <div class="sec-title">Steps</div>
      <div class="list">
        ${li('trkTog', 'steps', 'Count my steps', p.sensor ? 'Read from your phone’s step sensor' : 'This phone has no step sensor', sw(t.steps), 'data-k="steps"')}
        ${li('trkAskAct', 'check', 'Physical activity permission', 'Needed once so Android lets LevelUp read steps', status(p.activity, 'Allowed', 'Not allowed'))}
        ${li('trkGoal', 'flag', 'Daily step goal', `${LU.fmt(t.goal)} steps. Reaching it gives +20 XP once a day.`)}
      </div>
      <div class="sec-title">Sleep and screen time</div>
      <div class="list">
        ${li('trkUsage', 'moon', 'Usage access', 'Android setting. Find LevelUp in the list and switch it on.', status(p.usage, 'On', 'Off'))}
        ${li('trkTog', 'moon', 'Estimate my sleep', 'Longest stretch with the screen off, shown as an estimate', sw(t.sleep), 'data-k="sleep"')}
        ${li('trkTog', 'phone', 'Show screen time', 'A plain number per day. No judgement, no limits.', sw(t.screen), 'data-k="screen"')}
      </div>
      <div class="card small muted" style="margin-top:14px">Sleep and screen time are read only on this phone and never leave it. If you tick Sleep in your quests, that time is used instead of the estimate.</div>
      ${LU.native ? `<div class="sec-title">Today so far</div><div class="list">
        <div class="li"><span class="lic">${I('steps')}</span><div class="grow lt">Steps</div><b class="num">${d.steps != null ? LU.fmt(d.steps) : '–'}</b></div>
        <div class="li"><span class="lic">${I('moon')}</span><div class="grow lt">Last sleep</div><b class="num">${(LU.sleepOf(LU.todayKey()) || {}).min ? LU.dur(LU.sleepOf(LU.todayKey()).min) : '–'}</b></div>
        <div class="li"><span class="lic">${I('phone')}</span><div class="grow lt">Screen time</div><b class="num">${d.screenMin != null ? LU.dur(d.screenMin) : '–'}</b></div></div>
        <button class="btn ghost block" style="margin-top:12px" data-act="trkRefresh">Refresh now</button>` : ''}
      <div style="height:20px"></div>`;
    },
  };
  LU.actions.trkTog = (el) => { const k = el.dataset.k, s = LU.state.settings; s.track = LU.trk(); s.track[k] = !s.track[k]; LU.save(); if (A && A.setTracking) try { A.setTracking(!!s.track.steps); } catch (e) {} LU.render(); };
  LU.actions.trkAskAct = () => { if (A && A.askActivity) A.askActivity(); else LU.toast('This works inside the installed app.'); };
  LU.actions.trkUsage = () => { if (A && A.openSettings) A.openSettings('usage'); else LU.toast('This works inside the installed app.'); };
  LU.actions.trkRefresh = () => { LU.sampleNow(); LU.syncSensors(); LU.render(); LU.toast('Updated', { sys: false, ms: 1200 }); };
  LU.actions.trkGoal = () => LU.sheet({
    title: 'Daily step goal', body: `<div class="field"><label>Steps per day</label><input class="inp" type="number" id="sgv" min="1000" max="40000" step="500" value="${LU.trk().goal}"></div>`,
    foot: `<button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn" id="sgOk">Save</button>`,
    mount: (s) => { LU.$('#sgOk', s).onclick = () => { const v = LU.clamp(parseInt(LU.$('#sgv', s).value, 10) || 8000, 1000, 40000); LU.state.settings.track = Object.assign(LU.trk(), { goal: v }); LU.save(); LU.closeSheet(); LU.render(); }; },
  });

  /* ---------- Reminders ---------- */
  const GROUPS = [['wake', 'Wake up', 'sun'], ['workout', 'Workout', 'dumbbell'], ['hygiene', 'Bath and hygiene', 'drop'], ['study', 'Study and answer writing', 'book'], ['meal', 'Meals', 'bowl'], ['office', 'Leave room and office', 'brief'], ['night', 'Plan tomorrow and sleep', 'moon'], ['money', 'Log today’s spending (Money)', 'wallet']];
  const DNAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const ago = (t) => { if (!t) return 'never'; const m = Math.round((Date.now() - t) / 60000); if (m < 1) return 'just now'; if (m < 60) return m + ' min ago'; if (m < 1440) return Math.round(m / 60) + ' h ago'; return new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); };
  const healthCard = () => {
    const d = LU.diag();
    if (!d) return `<div class="card small muted" style="margin-top:14px"><b>Reminder health check</b><br>Works inside the installed app.</div>`;
    const nx = d.next ? new Date(d.next).toLocaleString('en-IN', { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : 'none planned';
    return `<div class="sec-title">Reminder health check</div><div class="list">
      ${li('nHealth', 'bell', 'Reminders waiting on your phone', d.armed ? d.armed + ' scheduled. Next: ' + nx : 'None scheduled. Open the app once with Reminders on.', status(d.armed > 0, d.armed, 'None'))}
      ${li('nHealth', 'check', 'Last reminder delivered', ago(d.last), status(!!d.last, 'Yes', 'Never'))}
      ${li('nBatt', 'phone', 'Battery: no restrictions', d.batt ? 'LevelUp may run in the background' : 'Android may stop LevelUp. Tap, find LevelUp and choose Don’t optimize.', status(d.batt, 'OK', 'Fix'))}
      ${d.mi ? li('nAuto', 'phone', 'Autostart (Xiaomi / Redmi)', 'Must be ON, or the phone cancels reminders when the app closes. Tap to open.', '<span class="pill red">Check</span>') : ''}
      </div><div class="card small muted" style="margin-top:12px"><b>If the 1-minute test does not arrive</b><br>1. Allow notifications above.<br>2. Switch Autostart on and Battery to No restrictions.<br>3. In the recent-apps screen, long-press the LevelUp card and tap the lock icon.<br>4. Do not swipe LevelUp away from recent apps. On Redmi that cancels reminders.</div>`;
  };
  LU.views.notif = {
    render() {
      const c = LU.ncfg(), p = LU.perms();
      return `<div class="topbar"><button class="iconbtn" data-act="back">${I('back')}</button><h1>Reminders<span class="sub">Notifications for your routine</span></h1></div>
      <div class="list">
        ${li('nTog', 'bell', 'Reminders', 'Quest start times, plan and weekly review', sw(c.on), 'data-k="on"')}
        ${li('nAllow', 'check', 'Notification permission', p.notif ? 'Allowed' : 'Android blocks notifications for LevelUp. Tap to allow.', status(p.notif, 'Allowed', 'Blocked'))}
        ${p.sdk >= 31 ? li('nExact', 'clock', 'Exact timing', p.exact ? 'Reminders arrive on the minute' : 'Allow “Alarms and reminders” so they do not run late', status(p.exact, 'On', 'Off')) : ''}
      </div>
      <div class="sec-title">What to remind</div>
      <div class="list">${GROUPS.map(([k, n, ic]) => li('nTog', ic, n, '', sw(c.kinds[k]), `data-g="${k}"`)).join('')}</div>
      <div class="sec-title">Timing</div>
      <div class="list">
        ${li('nLead', 'clock', 'Remind me before a quest', c.lead ? c.lead + ' minutes early' : 'Exactly at the start time')}
        ${li('nTime', 'moon', 'Plan tomorrow reminder', LU.t12(c.plan) + ' · only if tomorrow has no tasks yet', '', 'data-f="plan"')}
        ${li('nTime', 'wallet', 'Money reminder', LU.t12(c.money) + ' · only if nothing is logged that day', '', 'data-f="money"')}
        ${li('nTime', 'review', 'Weekly review reminder', 'Sundays at ' + LU.t12(c.review), '', 'data-f="review"')}
      </div>
      <div class="sec-title">My reminders <a class="link" data-act="nCustom" data-i="-1">Add</a></div>
      <div class="list">${(c.custom || []).map((r, i) => `<div class="li" data-act="nCustom" data-i="${i}"><span class="lic">${I('bell')}</span><div class="grow"><div class="lt">${esc(r.title)}</div><div class="ls">${LU.t12(r.time)} · ${r.days && r.days.length && r.days.length < 7 ? r.days.map((d) => DNAMES[d]).join(', ') : 'Every day'}</div></div><span class="chev">${I('chev')}</span></div>`).join('') || `<div class="li"><div class="grow small muted">Nothing yet. Add water, vitamins, or anything you tend to forget.</div></div>`}</div>
      <button class="btn ghost block" style="margin-top:14px" data-act="nTest">${I('bell')}Send a test reminder now</button>
      <button class="btn ghost block" style="margin-top:8px" data-act="nTest1">${I('clock')}Test a scheduled reminder (in 1 minute)</button>
      ${healthCard()}
      <div style="height:20px"></div>`;
    },
  };
  const sync = () => { LU.save(); LU.syncReminders(true); LU.render(); };
  const cfg = () => { const s = LU.state.settings; s.notif = LU.ncfg(); return s.notif; };
  LU.actions.nTog = (el) => { const c = cfg(); if (el.dataset.g) c.kinds[el.dataset.g] = !c.kinds[el.dataset.g]; else c[el.dataset.k] = !c[el.dataset.k]; sync(); };
  LU.actions.nAllow = () => { if (A && A.askNotif) A.askNotif(); else LU.toast('This works inside the installed app.'); };
  LU.actions.nExact = () => { if (A && A.openSettings) A.openSettings('exact'); };
  LU.actions.nHealth = () => LU.render();
  LU.actions.nBatt = () => { if (A && A.openSettings) A.openSettings('battery'); else LU.toast('This works inside the installed app.'); };
  LU.actions.nAuto = () => { if (A && A.openSettings) A.openSettings('autostart'); };
  LU.actions.nTest1 = () => { if (!A) { LU.toast('This works inside the installed app.'); return; } LU.state.testRem = Date.now() + 61000; LU.save(); LU.syncReminders(true); LU.toast('Now close the app and wait a minute.', { sys: false }); LU.render(); };
  LU.actions.nAppInfo = () => { if (A && A.openSettings) A.openSettings('app'); else LU.toast('This works inside the installed app.'); };
  LU.actions.nTest = () => { if (!A) { LU.toast('This works inside the installed app.'); return; } LU.testNotify(); LU.toast('Test sent. Pull down the notification bar.', { sys: false }); };
  LU.actions.nLead = () => LU.sheet({
    title: 'Remind me before a quest', body: `<div class="seg" id="ldS">${[0, 5, 10, 15, 30].map((m) => `<button type="button" data-m="${m}" class="${LU.ncfg().lead === m ? 'on' : ''}">${m ? m + ' min' : 'On time'}</button>`).join('')}</div><p class="small muted" style="margin-top:12px">Wake-up reminders always arrive on time.</p>`,
    mount: (s) => LU.$$('#ldS button', s).forEach((b) => (b.onclick = () => { cfg().lead = +b.dataset.m; LU.closeSheet(); sync(); })),
  });
  LU.actions.nTime = (el) => {
    const f = el.dataset.f;
    LU.sheet({
      title: f === 'plan' ? 'Plan tomorrow reminder' : f === 'money' ? 'Money reminder' : 'Weekly review reminder', body: `<div class="field"><label>Time</label><input class="inp" type="time" id="ntv" value="${LU.ncfg()[f]}"></div>`,
      foot: `<button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn" id="ntOk">Save</button>`,
      mount: (s) => { LU.$('#ntOk', s).onclick = () => { const v = LU.$('#ntv', s).value; if (v) cfg()[f] = v; LU.closeSheet(); sync(); }; },
    });
  };
  LU.actions.nCustom = (el) => {
    const i = +el.dataset.i, c = cfg(), r = i >= 0 ? c.custom[i] : { title: '', time: '12:00', days: [] };
    let days = (r.days || []).slice();
    LU.sheet({
      title: i >= 0 ? 'Edit reminder' : 'New reminder',
      body: `<div class="field"><label>Reminder</label><input class="inp" id="crT" maxlength="60" placeholder="e.g. Drink water" value="${esc(r.title)}"></div>
        <div class="field"><label>Time</label><input class="inp" type="time" id="crM" value="${r.time}"></div>
        <div class="field"><label>Days (none selected = every day)</label><div class="seg" id="crD">${DNAMES.map((n, d) => `<button type="button" data-d="${d}" class="${days.includes(d) ? 'on' : ''}">${n}</button>`).join('')}</div></div>`,
      foot: `${i >= 0 ? `<button class="btn danger" id="crDel">Delete</button>` : `<button class="btn ghost" data-act="closeSheet">Cancel</button>`}<button class="btn" id="crOk">Save</button>`,
      mount: (s) => {
        LU.$$('#crD button', s).forEach((b) => (b.onclick = () => { const d = +b.dataset.d; days = days.includes(d) ? days.filter((x) => x !== d) : days.concat(d); b.classList.toggle('on'); }));
        LU.$('#crOk', s).onclick = () => { const t = LU.$('#crT', s).value.trim(), m = LU.$('#crM', s).value; if (!t || !m) return; const o = { title: t, time: m, days }; if (i >= 0) c.custom[i] = o; else c.custom.push(o); LU.closeSheet(); sync(); };
        const dl = LU.$('#crDel', s); if (dl) dl.onclick = () => { c.custom.splice(i, 1); LU.closeSheet(); sync(); };
      },
    });
  };

  /* ---------- widget help ---------- */
  LU.actions.widgetHelp = () => LU.sheet({
    title: 'Home-screen widget',
    body: `<p class="muted" style="margin:0 0 10px">Your next quest, level, streak and days to Prelims on the home screen.</p>
      <div class="mini"><span>1</span><span class="grow">Touch and hold an empty spot on your home screen.</span></div>
      <div class="mini"><span>2</span><span class="grow">Tap <b>Widgets</b>.</span></div>
      <div class="mini"><span>3</span><span class="grow">Find <b>LevelUp</b> and drag it onto the screen.</span></div>
      <div class="mini"><span>4</span><span class="grow">Tap the widget any time to open the app.</span></div>`,
  });

  /* ---------- entries in More ---------- */
  LU.more3 = () => `
      <div class="sec-title">Money</div>
      <div class="list">${li('openMoney', 'wallet', 'Money', 'Daily necessities and extra spending')}</div>
      <div class="sec-title">Appearance</div>
      <div class="list">${li('openThemes', 'star', 'Themes and styles', 'Colors, fonts, wallpaper, sound, reader looks')}</div>
      <div class="sec-title">Maps</div>
      <div class="list">${li('openMap', 'map', 'Maps', 'World and India · political and physical · your tags')}</div>
      <div class="sec-title">Private</div>
      <div class="list">${li('openDiary', 'diary', 'Diary', 'Type or speak. Locked with fingerprint or PIN')}</div>
      <div class="sec-title">Progress</div>
      <div class="list">
        ${li('openPush', 'chart', 'History and graphs', 'XP, study hours, quests, steps, sleep', '', 'data-v="history"')}
        ${li('openPush', 'review', 'Weekly review', 'Look back at the week and set one fix', '', 'data-v="review"')}
        ${li('openPush', 'trophy', 'Achievements and titles', `${Object.keys(LU.state.ach || {}).length} of ${LU.ACH.length} unlocked`, '', 'data-v="achievements"')}
      </div>
      <div class="sec-title">Tracking and reminders</div>
      <div class="list">
        ${li('openPush', 'bell', 'Reminders', LU.ncfg().on ? 'On · ' + (LU.ncfg().lead ? LU.ncfg().lead + ' min before quests' : 'at quest time') : 'Off', '', 'data-v="notif"')}
        ${li('openPush', 'steps', 'Steps, sleep and screen time', 'Read automatically from your phone', '', 'data-v="track"')}
        ${li('widgetHelp', 'widget', 'Home-screen widget', 'How to add it')}
      </div>`;
})();
