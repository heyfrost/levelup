/* RPG mode glue: loads the React bundle only when needed, swaps in the RPG screens, keeps Classic untouched */
(function () {
  const LU = window.LU, R = LU.rpg;
  let state = 0, waiters = [], bundleEl = null; /* 0 none, 1 loading, 2 ready, -1 failed */
  const load = (cb) => {
    if (state === 2) return cb && cb();
    if (cb) waiters.push(cb);
    if (state === 1) return;
    state = 1;
    bundleEl = document.createElement('script'); bundleEl.src = 'js/rpg/rpg.bundle.js';
    bundleEl.onload = () => { state = 2; const w = waiters; waiters = []; w.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); };
    bundleEl.onerror = () => { state = -1; waiters = []; LU.toast && LU.toast('RPG mode could not load. Classic is shown.'); };
    document.head.appendChild(bundleEl);
  };
  const ui = () => LU.rpgReact;
  LU.rpgUI = {
    load,
    report: (forced) => load(() => ui().report(forced)),
    openQuest: (q) => ui().openQuest(q),
    lookChanged: () => { apply(); LU.render(false); },
  };

  /* the bell / daily report */
  /* RPG screens: each is a tiny proxy that mounts the React view once the bundle is ready */
  const proxy = (name, orig) => ({
    render(p) { if (orig && !(R.on() && state === 2)) return orig.render(p); return state === 2 ? '' : '<div class="small muted" style="padding:30px">Loading…</div>'; },
    mount(el, p) {
      if (orig && !R.on()) { if (orig.mount) orig.mount(el, p); return; }
      if (state === 2) ui().views[name === 'status' ? 'status' : name].mount(el, p);
      else load(() => LU.render(true));
    },
  });
  ['status'].forEach((n) => { const o = LU.views[n]; LU.views[n] = proxy(n, o); });
  ['rpgGroup', 'rpgGraph', 'rpgStats', 'rpgStat', 'rpgRank', 'rpgBacklog', 'rpgWeight', 'rpgSettings'].forEach((n) => { LU.views[n] = proxy(n, null); });

  /* look: dock instead of the tab bar */
  let dock = false;
  const apply = () => {
    R.paint();
    document.body.classList.toggle('rpg', R.on());
    if (R.on()) load(() => { if (!dock) { dock = true; ui().dock(); } ui().sync(); LU.render(true); });
  };
  R.onUI = () => { document.body.classList.toggle('rpg', R.on()); if (state === 2) ui().sync(); };

  /* More tab: an "RPG Settings" section inside the settings list (the top of More stays as it was) */
  const more = LU.views.more, mr = more.render;
  more.render = function (p) {
    const html = mr.call(this, p), L = R.on();
    const card = `<div class="rpg-more"><div class="sec-title">RPG Settings</div><div class="list"><div class="li" data-act="rpgSettings"><span class="lic">${LU.icon('sword')}</span><div class="grow"><div class="lt">RPG mode · look, goals, graphs, backlog</div><div class="ls">${L ? 'RPG mode is on' : 'Classic is on. Tap to switch or set up RPG.'}</div></div><span class="dim">${LU.icon('chev')}</span></div></div></div>`;
    return html.indexOf('<div class="sec-title">Goals</div>') >= 0 ? html.replace('<div class="sec-title">Goals</div>', card + '<div class="sec-title">Goals</div>') : html + card;
  };
  LU.actions.rpgSettings = (el) => load(() => LU.push('rpgSettings', { g: el && el.dataset && el.dataset.g }));
  LU.actions.rpgWeight = () => load(() => LU.push('rpgWeight'));
  LU.actions.rpgAllQuests = () => LU.go('quests');
  LU.actions.rpgReader = (el) => R.openSlot(el && el.dataset ? el.dataset.slot : 'gs');
  LU.actions.subjRead = (el) => R.openSubject(el.dataset.id);

  /* the morning overlay is replaced by the daily report in RPG mode */
  const sm = LU.showMorning;
  LU.showMorning = function (forced) {
    if (!R.on()) return sm.call(this, forced);
    const d = LU.day(LU.todayKey()); d.morning = true; LU.save();
    load(() => ui().report(forced));
  };

  /* data changes redraw the open screen */
  let t = null;
  const redraw = () => { clearTimeout(t); t = setTimeout(() => { if (R.on() && state === 2) { ui().bump(); } }, 30); };
  R.onData = redraw; R.onTick = redraw;

  /* start-up, called from app.js once the first screen is drawn */
  LU.rpgStart = () => {
    try { R.boot(); R.hookTheme(); R.paint(); } catch (e) { console.error(e); }
    document.body.classList.toggle('rpg', R.on());
    if (!R.on()) return;
    load(() => {
      dock = true; ui().dock(); ui().sync(); LU.render(false);
      const next = () => {
        if (R.weightDue()) ui().weight();
      };
      const rep = () => { if (R.reportDue()) { const d = LU.day(LU.todayKey()); d.morning = true; LU.save(); ui().report(false, next); } else next(); };
      if (R.ui().intro) ui().intro(rep); else rep();
      try { R.autoTick(); } catch (e) {}
    });
  };
})();
