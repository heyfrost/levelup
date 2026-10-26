/* Core helpers: dates, storage, native bridge, sound */
(function () {
  const LU = (window.LU = window.LU || {});

  /* ---------- small utils ---------- */
  LU.$ = (s, r) => (r || document).querySelector(s);
  LU.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  LU.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  LU.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  LU.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  LU.clone = (o) => JSON.parse(JSON.stringify(o));
  LU.fmt = (n) => Number(n || 0).toLocaleString('en-IN');

  /* ---------- time ----------
     A "day" starts at 03:00, so a late-night "Lights out" still belongs to the day you lived. */
  const DAY_START_H = 3;
  const pad = (n) => String(n).padStart(2, '0');
  LU.pad = pad;
  LU.keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  LU.now = () => new Date();
  LU.todayKey = () => LU.keyOf(new Date(Date.now() - DAY_START_H * 3600e3));
  LU.parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  LU.addDays = (k, n) => { const d = LU.parseKey(k); d.setDate(d.getDate() + n); return LU.keyOf(d); };
  LU.diffDays = (a, b) => Math.round((LU.parseKey(b) - LU.parseKey(a)) / 864e5);
  LU.dayType = (k) => { const w = LU.parseKey(k).getDay(); return w === 0 ? 'sun' : w === 6 ? 'sat' : 'weekday'; };
  LU.dayTypeName = { weekday: 'Weekday routine', sat: 'Saturday routine', sun: 'Sunday routine' };
  LU.toMin = (t) => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  LU.fromMin = (m) => { m = ((m % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); };
  /* minutes since local midnight, but times after midnight before 03:00 count as 24:xx */
  LU.nowMin = () => { const d = LU._at ? new Date(LU._at) : new Date(); let m = d.getHours() * 60 + d.getMinutes(); if (d.getHours() < DAY_START_H) m += 1440; return m; };
  LU.t12 = (t) => {
    if (!t) return '';
    let [h, m] = t.split(':').map(Number); const ap = h >= 12 && h < 24 ? 'pm' : 'am'; h = h % 12 || 12;
    return `${h}:${pad(m)} ${ap}`;
  };
  LU.dur = (min) => { min = Math.round(min); const h = Math.floor(min / 60), m = min % 60; return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`; };
  const DN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  LU.dayName = (k) => DN[LU.parseKey(k).getDay()];
  LU.niceDate = (k, withDay = true) => { const d = LU.parseKey(k); return (withDay ? DN[d.getDay()].slice(0, 3) + ', ' : '') + d.getDate() + ' ' + MN[d.getMonth()] + (withDay ? '' : ' ' + d.getFullYear()); };
  LU.weekKey = (k) => { const d = LU.parseKey(k); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return LU.keyOf(d); }; // Monday

  /* ---------- native bridge (Android) with browser fallbacks ---------- */
  const A = window.Android;
  LU.native = !!A;
  LU.vibrate = (ms) => {
    if (!LU.state || !LU.state.settings.haptics) return;
    const hp = ((LU.state.settings.theme || {}).hap) || 'normal'; if (hp === 'off') return;
    ms = Math.round(ms * ({ light: 0.5, normal: 1, strong: 1.8 }[hp] || 1));
    try { if (A && A.vibrate) A.vibrate(ms); else if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
  };
  LU.saveFile = (name, text) => {
    try {
      if (A && A.saveText) return A.saveText(name, text);
    } catch (e) {}
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    return 'Downloads/' + name;
  };
  LU.saveFileAs = (name, mime, text) => {
    try {
      if (A && A.saveTextAs) return A.saveTextAs(name, mime, text);
      if (A && A.saveText) return A.saveText(name, text);
    } catch (e) {}
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: mime || 'text/plain' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    return 'Downloads/' + name;
  };
  LU.copyText = async (t) => { try { await navigator.clipboard.writeText(t); return true; } catch (e) { try { const x = document.createElement('textarea'); x.value = t; document.body.appendChild(x); x.select(); const ok = document.execCommand('copy'); x.remove(); return ok; } catch (e2) { return false; } } };
  LU.exitApp = () => { try { if (A && A.exit) A.exit(); } catch (e) {} };

  /* ---------- sound (synthesised, no files) ---------- */
  let ctx;
  const PACKS = { system: { f: 1, l: 1, v: 1 }, soft: { f: 0.8, l: 1.5, v: 0.7, t: 'sine' }, mech: { f: 0.45, l: 0.45, v: 0.5, t: 'square' } };
  const tone = (freq, at, len, type = 'sine', vol = 0.12) => {
    const pk = PACKS[LU.soundPack] || PACKS.system; freq *= pk.f; len *= pk.l; vol *= pk.v; if (pk.t) type = pk.t;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, ctx.currentTime + at);
    g.gain.setValueAtTime(0.0001, ctx.currentTime + at);
    g.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + len);
    o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + at); o.stop(ctx.currentTime + at + len + 0.05);
  };
  LU.sfx = (kind) => {
    if (!LU.state || !LU.state.settings.sound || LU.soundPack === 'silent') return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      if (kind === 'done') { tone(880, 0, 0.18); tone(1318.5, 0.07, 0.3); }
      else if (kind === 'undo') { tone(520, 0, 0.12, 'triangle', 0.08); }
      else if (kind === 'tap') { tone(1200, 0, 0.05, 'triangle', 0.05); }
      else if (kind === 'level') { [523.3, 659.3, 784, 1046.5, 1318.5].forEach((f, i) => tone(f, i * 0.09, 0.5, 'triangle', 0.1)); tone(2093, 0.5, 0.9, 'sine', 0.06); }
      else if (kind === 'clear') { [659.3, 880, 1174.7].forEach((f, i) => tone(f, i * 0.12, 0.45, 'sine', 0.1)); }
      else if (kind === 'system') { tone(220, 0, 0.35, 'sine', 0.06); tone(440, 0.05, 0.5, 'sine', 0.05); tone(1760, 0.1, 0.25, 'sine', 0.025); }
    } catch (e) {}
  };

  /* ---------- storage ---------- */
  const KEY = 'levelup.state.v1', SYLKEY = 'levelup.syllabus.v1';
  LU.load = () => {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
    const D = window.DEFAULTS;
    if (!s) {
      s = {
        v: 1, created: LU.todayKey(),
        settings: LU.clone(D.settings),
        schedule: LU.clone(D.schedule),
        checklist: LU.clone(D.checklist),
        workout: LU.clone(D.workout),
        quotes: LU.clone(D.quotes),
        xp: 0, stats: { str: 0, int: 0, vit: 0, dsc: 0, hlt: 0 },
        days: {}, backlog: [], log: [],
        syl: { done: {}, focus: { gs: 'pol', opt: 'an1' } },
        boss: {}, timer: null, processed: LU.todayKey(), lastBackup: null,
      };
    }
    s.settings = Object.assign(LU.clone(D.settings), s.settings || {});
    LU.state = s;
    try { const t = localStorage.getItem(SYLKEY); LU.syllabus = t ? JSON.parse(t) : window.SYLLABUS; } catch (e) { LU.syllabus = window.SYLLABUS; }
    return s;
  };
  let saveT;
  LU.save = (now) => {
    clearTimeout(saveT);
    const run = () => { try { localStorage.setItem(KEY, JSON.stringify(LU.state)); } catch (e) { console.error(e); } if (LU.afterSave) LU.afterSave(); };
    if (now) run(); else saveT = setTimeout(run, 120);
  };
  LU.saveSyllabus = () => { try { localStorage.setItem(SYLKEY, JSON.stringify(LU.syllabus)); } catch (e) {} };
  LU.resetSyllabus = () => { localStorage.removeItem(SYLKEY); LU.syllabus = window.SYLLABUS; };
  LU.wipe = () => { localStorage.removeItem(KEY); localStorage.removeItem(SYLKEY); };
  /* Backup = progress + syllabus edits + all PDF marks (the PDF files themselves are too big and stay on the phone) */
  LU.exportAll = async () => {
    const ink = {};
    for (const d of (LU.state.docs || [])) { try { const v = await LU.idb.get('ink', d.id); if (v) ink[d.id] = v; } catch (e) {} }
    return JSON.stringify({ app: 'LevelUp', v: 2, exported: new Date().toISOString(), state: LU.state, syllabus: LU.syllabus === window.SYLLABUS ? null : LU.syllabus, ink });
  };
  LU.importAll = async (text) => {
    const o = JSON.parse(text);
    if (!o || o.app !== 'LevelUp' || !o.state) throw new Error('This is not a LevelUp backup file.');
    if (o.ink && LU.idb) for (const id of Object.keys(o.ink)) await LU.idb.put('ink', id, o.ink[id]);
    localStorage.setItem(KEY, JSON.stringify(o.state));
    if (o.syllabus) localStorage.setItem(SYLKEY, JSON.stringify(o.syllabus)); else localStorage.removeItem(SYLKEY);
  };
  window.addEventListener('pagehide', () => LU.save(true));
  document.addEventListener('visibilitychange', () => { if (document.hidden) LU.save(true); });
})();
