/* Themes: colours, styles, layout, fonts, wallpaper, sound, reader looks. Everything is plain CSS variables + data attributes. */
(function () {
  const LU = window.LU, esc = LU.esc, I = LU.icon;
  const T = (LU.theme = {});

  const h2r = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
  const rgb = (h) => h2r(h).join(', ');
  const mix = (a, b, t) => { const x = h2r(a), y = h2r(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const lum = (h) => { const [r, g, b] = h2r(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };

  /* ---------- colour palettes ---------- */
  const P = (n, g, dark, a, d, p, p2, r, t, m, x, ac, bl, gd, vi, rd, gn, ln, st, extra) => Object.assign({ n, g, dark, a, d, p, p2, r, t, m, x, ac, bl, gd, vi, rd, gn, ln, st }, extra || {});
  T.PAL = {
    cyan: P('Hunter Cyan', 'Dark', 1, '#03060E', '#07112A', '#0A1830', '#0E2042', '#13294F', '#E8F3FF', '#8EA4C6', '#5A6F93', '#5CE1FF', '#3D8BFF', '#F5C451', '#9B7BFF', '#FF5D7A', '#4BE3A0', '120,190,255', '#1B2232', { sh: '8, 18, 40', dp: '5, 11, 26', on: '#02101d' }),
    monarch: P('Shadow Monarch', 'Dark', 1, '#07040F', '#130A26', '#1A0F33', '#24154A', '#301D5E', '#F1E9FF', '#A99BC9', '#6F6392', '#B07CFF', '#7A5CFF', '#F5C451', '#E36BFF', '#FF5D8A', '#5BE3B0', '190,150,255', '#1A1330'),
    crimson: P('Crimson Rank', 'Dark', 1, '#0A0305', '#1A070C', '#240B12', '#30101A', '#3E1523', '#FFEDEF', '#C9949C', '#8F5F67', '#FF4D6A', '#FF8A4D', '#F5C451', '#D96BFF', '#FF2E4E', '#4BE3A0', '255,150,160', '#261319'),
    gold: P('Gold Class (S-Rank)', 'Dark', 1, '#070604', '#14110A', '#1C170C', '#272010', '#342B15', '#FFF6E0', '#BBAA84', '#857654', '#F5C451', '#E39B2B', '#FFD66B', '#D9A8FF', '#FF6B5A', '#7BE3A0', '245,200,100', '#221E14'),
    emerald: P('Emerald Forest', 'Dark', 1, '#030B08', '#08180F', '#0B2217', '#10301F', '#163F29', '#E8FFF3', '#8FB8A2', '#5F8470', '#4BE3A0', '#3DC7FF', '#F5C451', '#9B7BFF', '#FF6B7A', '#7BF0B0', '120,255,190', '#14241C'),
    ocean: P('Midnight Ocean', 'Dark', 1, '#040B14', '#0A1B2B', '#0E2638', '#143348', '#1B4259', '#E6F6FA', '#8FB0BF', '#5F8191', '#4FD1C5', '#3D9BFF', '#F5C451', '#8F9BFF', '#FF6B7A', '#4BE3A0', '120,210,230', '#12212D'),
    amoled: P('AMOLED Black', 'Dark', 1, '#000000', '#050505', '#0B0B0D', '#121216', '#1A1A20', '#F2F5FA', '#8A93A3', '#5A6170', '#5CE1FF', '#3D8BFF', '#F5C451', '#9B7BFF', '#FF5D7A', '#4BE3A0', '200,210,230', '#101012', { sh: '0, 0, 0' }),
    ember: P('Sunset Ember', 'Dark', 1, '#0B0503', '#1C0D07', '#26120A', '#33180C', '#42200F', '#FFF1E6', '#C9A58E', '#8F6F5A', '#FF9A3D', '#FF6B3D', '#FFD166', '#E36BFF', '#FF4D4D', '#7BE3A0', '255,170,110', '#271811'),
    cyber: P('Cyberpunk', 'Dark', 1, '#09010F', '#12031F', '#1A0530', '#260847', '#340C5E', '#F4E9FF', '#B79BD9', '#7A5F9C', '#00F0FF', '#7A5CFF', '#FFE600', '#FF2BD6', '#FF2B6A', '#00FF9C', '255,43,214', '#1A0A2B'),
    retro: P('Retro RPG', 'Dark', 1, '#0F0F1B', '#1A1A2E', '#16213E', '#1F2A52', '#2A3A6B', '#F4F4F8', '#A0A8C8', '#6A7099', '#FFD400', '#4DA3FF', '#FF9F1C', '#B36BFF', '#FF4D6D', '#52E05A', '200,200,255', '#1B1B30'),
    earth: P('Earth Tones', 'Dark', 1, '#1A1410', '#241C15', '#2D231A', '#3A2E22', '#48392A', '#F5EBDD', '#BBA68D', '#85735D', '#D9A066', '#8FB3A0', '#E3B23C', '#B58B9E', '#D9604A', '#8FB35E', '217,160,102', '#2A2018'),
    zen: P('Zen', 'Dark', 1, '#11151A', '#171C22', '#1D232A', '#252C34', '#2E373F', '#E4E8EA', '#98A3A8', '#6A747A', '#9DB8A8', '#8FA8C0', '#C9B37E', '#A89BC0', '#C98A8A', '#9DB8A8', '157,184,168', '#1C2228'),
    paper: P('Paper', 'Light', 0, '#F6F1E7', '#EFE8DA', '#FFFFFF', '#F0E9DB', '#E6DDCB', '#1B1B1F', '#5C5C66', '#8A8A94', '#1F5FD6', '#2F6FE0', '#B7791F', '#6B4FD6', '#C62839', '#1B8A5A', '40,40,60', '#D9D2C3', { sh: '255, 255, 255' }),
    sepia: P('Sepia', 'Light', 0, '#F1E4C8', '#E9D9B6', '#F7EDD4', '#EBDCB9', '#DFCDA3', '#3B2A18', '#6E5A41', '#977F61', '#8B4A1E', '#A0642A', '#B7791F', '#7B4B94', '#B03A2E', '#4F7A3A', '80,50,20', '#CDBA93', { sh: '247, 237, 212' }),
    library: P('Library', 'Light', 0, '#F3EFE6', '#E7E0D0', '#FBF8F1', '#EDE6D5', '#E0D8C4', '#2B2118', '#6B5B49', '#9A8A76', '#2F6B4F', '#3F6E8C', '#9C6B1E', '#6B4F7A', '#A8342B', '#2F6B4F', '60,40,20', '#D8CDB6', { sh: '251, 248, 241' }),
    softlight: P('Soft Light', 'Light', 0, '#F2F6FC', '#E7EEF9', '#FFFFFF', '#EAF0FA', '#DCE6F5', '#0F172A', '#475569', '#94A3B8', '#2563EB', '#3B82F6', '#D97706', '#7C3AED', '#DC2626', '#059669', '30,60,120', '#CBD5E1', { sh: '255, 255, 255' }),
    manga: P('Manga', 'Light', 0, '#FFFFFF', '#F2F2F2', '#FFFFFF', '#EDEDED', '#DDDDDD', '#0A0A0A', '#444444', '#777777', '#111111', '#333333', '#111111', '#444444', '#C8102E', '#111111', '0,0,0', '#CFCFCF', { sh: '255, 255, 255' }),
  };
  T.STYLES = [
    ['system', 'System window', 'The glowing game panels (default)', null],
    ['minimal', 'Minimal', 'Flat cards, no glow, fastest', null],
    ['manga', 'Manga', 'Black ink, white paper, hard shadows', 'manga'],
    ['retro', 'Retro RPG', 'Chunky borders, typewriter text', 'retro'],
    ['cyber', 'Cyberpunk', 'Neon glow', 'cyber'],
    ['zen', 'Zen', 'Soft, quiet, lots of space', 'zen'],
    ['earth', 'Earth tones', 'Warm, rounded, calm', 'earth'],
  ];
  T.WALLS = [['Deep space', 'radial-gradient(120% 80% at 50% -10%, #1d3a7a, #060b1c 60%)'], ['Aurora', 'linear-gradient(160deg,#0b1d3a,#1c6a68 55%,#2a2f6b)'], ['Dusk', 'linear-gradient(170deg,#1a1033,#6b2a5c 60%,#e06a4a)'], ['Forest', 'linear-gradient(170deg,#06130d,#134a30 70%,#1f6b45)'], ['Slate', 'linear-gradient(170deg,#12161c,#2a313c)'], ['Paper wash', 'linear-gradient(170deg,#f6f1e7,#e6dcc5)']];
  const RANKCOL = { E: '#9AA7BD', D: '#4BE3A0', C: '#4FA3FF', B: '#A98BFF', A: '#F5C451', S: '#FF7A59' };
  T.PENSETS = {
    classic: ['Classic', ['#1B1B1F', '#1F5FD6', '#D7263D', '#12873F'], { yellow: '#FFE45C', green: '#93F2A0', pink: '#FFA3CB', blue: '#9AD8FF' }],
    pastel: ['Pastel', ['#5B6C8F', '#7DA7D9', '#E58FA0', '#7CC2A0'], { yellow: '#FFF1A8', green: '#C8F5D0', pink: '#FFD1E3', blue: '#CDEBFF' }],
    neon: ['Neon', ['#00B8D4', '#E100B4', '#6FB000', '#E08A00'], { yellow: '#FFFF00', green: '#39FF14', pink: '#FF77F0', blue: '#00D5FF' }],
    exam: ['Exam (red, blue, green)', ['#D7263D', '#1F5FD6', '#12873F', '#1B1B1F'], { yellow: '#FFE45C', green: '#93F2A0', pink: '#FFA3CB', blue: '#9AD8FF' }],
  };
  const FONTS = {
    clean: ['Clean (Inter)', 'Inter, system-ui, sans-serif', 'InterD, Inter, sans-serif'],
    system: ['Phone default', "system-ui, Roboto, 'Segoe UI', sans-serif", "system-ui, Roboto, 'Segoe UI', sans-serif"],
    serif: ['Serif (book style)', "Georgia, 'Noto Serif', 'Times New Roman', serif", "Georgia, 'Noto Serif', 'Times New Roman', serif"],
    mono: ['Typewriter', "'Courier New', 'Droid Sans Mono', 'Roboto Mono', monospace", "'Courier New', 'Droid Sans Mono', 'Roboto Mono', monospace"],
  };

  /* ---------- settings ---------- */
  const DEF = { pal: 'cyan', style: 'system', accent: '', auto: { dark: 'cyan', light: 'paper' }, sched: { on: false, day: 'paper', night: 'cyan', from: '06:30', to: '19:00' }, byRank: false, bySubject: false, mood: false, aura: false, glow: 100, anim: 'full', corners: 'cut', dens: 'comfy', nav: 'tabs', lvup: 'full', font: 'clean', size: 100, rsize: 100, wall: { type: 'none', g: 0, dim: 45, q: '' }, snd: 'system', hap: 'normal', rbg: 'dark', pens: 'classic', pagesh: 'shadow', frame: 'hex', tstyle: 'normal', diary: 'plain', dfont: 'same' };
  const cfg = () => {
    const s = LU.state && LU.state.settings; if (!s) return JSON.parse(JSON.stringify(DEF));
    const c = s.theme = s.theme || {};
    Object.keys(DEF).forEach((k) => { if (c[k] === undefined) c[k] = typeof DEF[k] === 'object' ? JSON.parse(JSON.stringify(DEF[k])) : DEF[k]; else if (typeof DEF[k] === 'object') c[k] = Object.assign({}, DEF[k], c[k]); });
    return c;
  };
  T.cfg = cfg;

  let subjAccent = '';
  T.setSubject = (sid) => {
    const c = cfg(); let col = '';
    if (sid && c.bySubject) { const s = LU.subject && LU.subject(sid); col = (s && s.color) || (sid === 'qp' ? LU.QP.color : ''); }
    if (col !== subjAccent) { subjAccent = col; T.apply(); }
  };

  const inDay = (s) => { const n = new Date(), m = n.getHours() * 60 + n.getMinutes(), f = LU.toMin(s.from), t = LU.toMin(s.to); return f <= t ? m >= f && m < t : m >= f || m < t; };
  const resolvePal = (c) => {
    if (c.sched.on) return inDay(c.sched) ? c.sched.day : c.sched.night;
    if (c.pal === 'auto') { let light = false; try { light = window.matchMedia('(prefers-color-scheme: light)').matches; } catch (e) {} return light ? c.auto.light : c.auto.dark; }
    return c.pal;
  };
  T.resolved = () => resolvePal(cfg());
  const daysLeft = () => { try { const d = new Date(LU.state.settings.examDate + 'T09:30:00'); return Math.ceil((d - Date.now()) / 86400000); } catch (e) { return 999; } };

  /* ---------- apply ---------- */
  T.apply = () => {
    const c = cfg(), id = resolvePal(c), pal = T.PAL[id] || T.PAL.cyan, root = document.documentElement, V = {};
    let ac = pal.ac;
    if (c.byRank && LU.state && LU.levelInfo) { try { ac = RANKCOL[LU.levelInfo().rank.r] || ac; } catch (e) {} }
    if (c.accent) ac = c.accent;
    if (subjAccent) ac = subjAccent;
    let glow = c.glow / 100;
    const style = c.style;
    if (style === 'minimal' || style === 'zen' || style === 'manga') glow = 0;
    if (style === 'cyber') glow = Math.max(glow, 1) * 1.5;
    if (c.mood) {
      const dl = daysLeft();
      if (dl <= 7) { ac = mix(ac, '#FF4D4D', 0.55); glow *= 1.6; }
      else if (dl <= 30) { ac = mix(ac, '#FF9A3D', 0.4); glow *= 1.4; }
      else if (dl <= 90) glow *= 1.2;
      else if (dl > 240) glow *= 0.7;
    }
    const light = !pal.dark;
    V['--abyss'] = pal.a; V['--deep'] = pal.d; V['--panel'] = pal.p; V['--panel2'] = pal.p2; V['--raise'] = pal.r;
    V['--text'] = pal.t; V['--muted'] = pal.m; V['--dim'] = pal.x;
    V['--cyan'] = ac; V['--blue'] = pal.bl; V['--gold'] = pal.gd; V['--violet'] = pal.vi; V['--red'] = pal.rd; V['--green'] = pal.gn;
    V['--ac-rgb'] = rgb(ac); V['--bl-rgb'] = rgb(pal.bl); V['--gd-rgb'] = rgb(pal.gd); V['--vi-rgb'] = rgb(pal.vi); V['--rd-rgb'] = rgb(pal.rd); V['--gn-rgb'] = rgb(pal.gn); V['--mu-rgb'] = rgb(pal.m);
    V['--ln-rgb'] = pal.ln; V['--line'] = `rgba(${pal.ln}, ${light ? 0.16 : 0.16})`; V['--line2'] = `rgba(${pal.ln}, ${light ? 0.3 : 0.28})`;
    V['--ab-rgb'] = rgb(pal.a); V['--dp-rgb'] = pal.dp || rgb(mix(pal.a, pal.d, 0.5)); V['--sh-rgb'] = pal.sh || rgb(mix(pal.a, pal.d, 0.75));
    V['--ac2'] = light ? mix(ac, '#ffffff', 0.25) : mix(ac, '#ffffff', 0.4);
    V['--on-ac'] = pal.on && !c.accent && !subjAccent && ac === pal.ac ? pal.on : (lum(ac) > 0.55 ? '#06121c' : '#ffffff');
    V['--gd2'] = mix(pal.gd, '#ffffff', 0.45); V['--stage'] = pal.st;
    V['--glow'] = String(Math.max(0, glow));
    V['--zoom'] = String(c.size / 100); V['--rzoom'] = String(c.rsize / 100);
    let fu = (FONTS[c.font] || FONTS.clean)[1], fd = (FONTS[c.font] || FONTS.clean)[2];
    if (style === 'retro' && c.font === 'clean') { fu = fd = FONTS.mono[1]; }
    V['--fu'] = fu; V['--fd'] = fd;
    let streak = 0; try { streak = LU.streak(); } catch (e) {}
    V['--aura'] = String(Math.min(1, streak / 60));
    /* wallpaper */
    const W = c.wall; let wall = 'none';
    if (W.type === 'gradient') wall = T.WALLS[W.g || 0][1];
    else if (W.type === 'image' && T.wallUrl) wall = `url("${T.wallUrl}") center/cover no-repeat`;
    V['--wall'] = wall; V['--wall-dim'] = String(W.dim / 100);
    Object.keys(V).forEach((k) => root.style.setProperty(k, V[k]));
    const at = { style, corners: c.corners, dens: c.dens, anim: c.anim, nav: c.nav, rbg: c.rbg, pagesh: c.pagesh, frame: c.frame, tstyle: c.tstyle, diary: c.diary, dfont: c.dfont, light: light ? '1' : '0', wall: wall !== 'none' || W.type === 'quote' ? '1' : '0', aura: c.aura ? '1' : '0' };
    Object.keys(at).forEach((k) => root.setAttribute('data-' + k, at[k]));
    root.style.colorScheme = light ? 'light' : 'dark';
    const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.content = pal.a;
    try { if (window.Android && Android.setBars) Android.setBars(pal.a, light); } catch (e) {}
    try { localStorage.setItem('levelup.theme.cache', JSON.stringify({ v: V, a: at, l: light, bg: pal.a })); } catch (e) {}
    T.penSet(c.pens);
    T.wallQuote();
    T.sound(c.snd);
    if (LU.pushWidget) { clearTimeout(T._wt); T._wt = setTimeout(() => { try { LU.pushWidget(); } catch (e) {} }, 400); }
  };
  T.widgetTheme = () => {
    const c = cfg(), pal = T.PAL[resolvePal(c)] || T.PAL.cyan;
    const ac = c.accent || (subjAccent || pal.ac);
    return { mode: pal.dark ? (pal.a === '#000000' ? 'black' : 'dark') : 'light', bg: pal.a, tx: pal.t, mu: pal.m, ac, gd: pal.gd };
  };

  T.penSet = (id) => {
    const set = T.PENSETS[id] || T.PENSETS.classic;
    if (LU.PEN) { LU.PEN.length = 0; set[1].forEach((x) => LU.PEN.push(x)); }
    if (LU.HL) Object.assign(LU.HL, set[2]);
  };
  T.sound = (id) => { LU.soundPack = id; };

  /* quote wallpaper */
  T.wallQuote = () => {
    const c = cfg(); let el = document.getElementById('wallq');
    if (c.wall.type !== 'quote') { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'wallq'; document.body.insertBefore(el, document.body.firstChild.nextSibling || null); }
    const qs = (LU.state.quotes || []); const q = c.wall.q || (qs.length ? qs[Math.floor(Math.random() * qs.length)] : null);
    const txt = q ? (q.t || q.text || q.q || String(q)) : 'Small steps, every day.'; const au = q && (q.a || q.author) || '';
    el.innerHTML = `<div class="wq-t">“${esc(txt)}”</div>${au ? `<div class="wq-a">${esc(au)}</div>` : ''}`;
  };

  /* wallpaper image kept in IndexedDB */
  T.loadWall = async () => {
    try { const b = await LU.idb.get('files', 'wallpaper'); if (b && b.size) { if (T.wallUrl) URL.revokeObjectURL(T.wallUrl); T.wallUrl = URL.createObjectURL(b); } } catch (e) {}
  };
  T.pickWall = async () => {
    const f = (await LU.img.pick({}))[0]; if (!f) return;
    try {
      const cv = await LU.img.load(f, 1440), blob = await LU.img.toBlob(cv, 0.82);
      await LU.idb.put('files', 'wallpaper', blob); await T.loadWall();
      cfg().wall.type = 'image'; LU.save(); T.apply(); LU.toast('Wallpaper set', { sys: false });
    } catch (e) { LU.toast(e.message || 'That image could not be used.', { ms: 3000 }); }
  };

  /* minute tick: day/night schedule, mood, auto */
  setInterval(() => { try { const c = cfg(); if (c.sched.on || c.pal === 'auto' || c.mood) T.apply(); } catch (e) {} }, 60000);
  try { window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (LU.state && cfg().pal === 'auto') T.apply(); }); } catch (e) {}
  LU.on && LU.on('levelup', () => { if (cfg().byRank) setTimeout(T.apply, 400); });

  /* ====================================================================
     Themes screen
     ==================================================================== */
  const seg = (key, opts, cur) => `<div class="seg">${opts.map(([v, n]) => `<button type="button" data-th="${key}" data-v="${v}" class="${cur === v ? 'on' : ''}">${n}</button>`).join('')}</div>`;
  const sw = (id, p, on) => `<button class="thc ${on ? 'on' : ''}" data-thpal="${id}"><span class="thd" style="background:${p.a}"><i style="background:${p.p}"></i><i style="background:${p.ac}"></i><i style="background:${p.gd}"></i></span><b>${esc(p.n)}</b></button>`;
  const slider = (key, min, max, step, val, fmt) => `<div class="thsl"><input type="range" data-thr="${key}" min="${min}" max="${max}" step="${step}" value="${val}"><b id="thv_${key}">${fmt(val)}</b></div>`;
  const row = (title, sub, ctrl) => `<div class="field thf"><label>${title}</label>${sub ? `<div class="tiny dim" style="margin:-3px 0 7px 2px">${sub}</div>` : ''}${ctrl}</div>`;
  const tog = (key, title, sub, on) => `<div class="li" data-thtog="${key}"><div class="grow"><div class="lt">${title}</div><div class="ls">${sub}</div></div><span class="switch ${on ? 'on' : ''}"></span></div>`;
  const PRESET_AC = ['#5CE1FF', '#4BE3A0', '#B07CFF', '#FF4D6A', '#F5C451', '#FF9A3D', '#FF2BD6', '#4FA3FF', '#9DB8A8', '#111111'];

  LU.views.themes = {
    render() {
      const c = cfg(), cur = resolvePal(c), pal = T.PAL[cur] || T.PAL.cyan;
      const grp = (g) => Object.keys(T.PAL).filter((k) => T.PAL[k].g === g).map((k) => sw(k, T.PAL[k], c.pal === k)).join('');
      return `<div class="topbar"><button class="iconbtn" data-act="back">${I('back')}</button><h1>Themes<span class="sub">Now showing: ${esc(pal.n)}</span></h1></div>
      <section class="win"><div class="win-in"><div class="win-h">PREVIEW</div>
        <div class="row" style="gap:14px">${LU.rankBadge('B')}<div class="grow"><div class="st-name">Aspirant</div><div class="st-title">Rank B · 4,200 XP</div><div style="margin-top:8px">${LU.bar(0.62, 'thin')}</div></div></div>
        <div class="row" style="gap:8px;margin-top:12px"><button class="btn sm grow">Button</button><button class="btn ghost sm grow">Ghost</button><button class="btn gold sm grow">Gold</button></div></div></section>

      <div class="sec-title">Colors</div>
      <div class="thg"><button class="thc ${c.pal === 'auto' && !c.sched.on ? 'on' : ''}" data-thpal="auto"><span class="thd" style="background:linear-gradient(90deg,#03060E 50%,#F6F1E7 50%)"><i style="background:#5CE1FF"></i><i style="background:#1F5FD6"></i></span><b>Auto (follows phone)</b></button></div>
      <div class="tiny dim thh">Dark</div><div class="thg">${grp('Dark')}</div>
      <div class="tiny dim thh">Light and reading</div><div class="thg">${grp('Light')}</div>
      ${c.pal === 'auto' ? `<div class="card small">When your phone is in dark mode use ${selPal('autoD', c.auto.dark, 1)}, in light mode use ${selPal('autoL', c.auto.light, 0)}.</div>` : ''}

      <div class="sec-title">Style</div>
      <div class="list">${T.STYLES.map(([id, n, d]) => `<div class="li" data-thstyle="${id}"><div class="grow"><div class="lt">${n}</div><div class="ls">${d}</div></div>${c.style === id ? `<span class="pill">On</span>` : ''}</div>`).join('')}</div>

      <div class="sec-title">Accent color</div>
      <div class="thg dots">${PRESET_AC.map((a) => `<button class="thdot ${c.accent === a ? 'on' : ''}" data-thac="${a}" style="background:${a}" aria-label="${a}"></button>`).join('')}<label class="thdot pick ${c.accent && !PRESET_AC.includes(c.accent) ? 'on' : ''}" style="${c.accent && !PRESET_AC.includes(c.accent) ? 'background:' + c.accent : ''}">+<input type="color" id="thColor" value="${c.accent || pal.ac}"></label><button class="chip ${!c.accent ? 'on' : ''}" data-thac="">Theme default</button></div>
      <div class="list" style="margin-top:12px">
        ${tog('byRank', 'Accent follows my rank', 'Grey, green, blue, violet, gold, red as you rank up', c.byRank)}
        ${tog('bySubject', 'Accent follows the subject', 'Reading a PDF takes the color of its subject', c.bySubject)}
        ${tog('mood', 'Exam countdown mood', 'Glow grows and warms up as Prelims gets close', c.mood)}
        ${tog('aura', 'Streak aura', 'Cards glow brighter with a longer streak', c.aura)}
      </div>

      <div class="sec-title">Day and night</div>
      <div class="list">${tog('schedOn', 'Switch theme by time', 'Use one theme in the day and another at night', c.sched.on)}</div>
      ${c.sched.on ? `<div class="two"><div class="field"><label>Day theme</label>${selPal('schD', c.sched.day)}</div><div class="field"><label>Night theme</label>${selPal('schN', c.sched.night)}</div></div>
      <div class="two"><div class="field"><label>Day starts</label><input class="inp" type="time" data-thtime="from" value="${c.sched.from}"></div><div class="field"><label>Night starts</label><input class="inp" type="time" data-thtime="to" value="${c.sched.to}"></div></div>` : ''}

      <div class="sec-title">Look and feel</div>
      ${row('Glow', 'How strong the neon glow is', slider('glow', 0, 150, 10, c.glow, (v) => v + '%'))}
      ${row('Corners', '', seg('corners', [['cut', 'Cut'], ['round', 'Rounded'], ['sharp', 'Sharp']], c.corners))}
      ${row('Spacing', '', seg('dens', [['compact', 'Compact'], ['comfy', 'Comfortable'], ['large', 'Large']], c.dens))}
      ${row('Navigation', 'Where the tabs sit', seg('nav', [['tabs', 'Bottom'], ['float', 'Floating'], ['rail', 'Side']], c.nav))}
      ${row('Animations', 'Choose None or Reduced on a slow phone', seg('anim', [['full', 'Full'], ['reduced', 'Reduced'], ['none', 'None']], c.anim))}
      ${row('Level-up screen', '', seg('lvup', [['full', 'Full screen'], ['banner', 'Small banner']], c.lvup))}

      <div class="sec-title">Text</div>
      ${row('Font', 'Typewriter and the phone font depend on your phone', seg('font', Object.keys(FONTS).map((k) => [k, FONTS[k][0].split(' (')[0]]), c.font))}
      ${row('Text size, whole app', '', slider('size', 85, 130, 5, c.size, (v) => v + '%'))}
      ${row('Text size, reader bars', 'The top and bottom bars of the PDF reader', slider('rsize', 85, 130, 5, c.rsize, (v) => v + '%'))}

      <div class="sec-title">Wallpaper</div>
      ${row('', '', seg('walltype', [['none', 'None'], ['gradient', 'Gradient'], ['image', 'My photo'], ['quote', 'Quote']], c.wall.type))}
      ${c.wall.type === 'gradient' ? `<div class="thg dots">${T.WALLS.map((w, i) => `<button class="thdot big ${c.wall.g === i ? 'on' : ''}" data-thwall="${i}" style="background:${w[1]}" aria-label="${w[0]}"></button>`).join('')}</div>` : ''}
      ${c.wall.type === 'image' ? `<button class="btn ghost block" data-thpickwall="1">${I('image')}${T.wallUrl ? 'Change photo' : 'Choose a photo'}</button>` : ''}
      ${c.wall.type === 'quote' ? `<button class="btn ghost block" data-thnewq="1">${I('quote')}Another quote</button>` : ''}
      ${c.wall.type !== 'none' ? row('Dim the wallpaper', 'Makes text easier to read', slider('dim', 0, 90, 5, c.wall.dim, (v) => v + '%')) : ''}

      <div class="sec-title">Sound and touch</div>
      ${row('Sound pack', '', seg('snd', [['system', 'System'], ['soft', 'Soft'], ['mech', 'Mechanical'], ['silent', 'Silent']], c.snd))}
      ${row('Vibration', '', seg('hap', [['off', 'Off'], ['light', 'Light'], ['normal', 'Normal'], ['strong', 'Strong']], c.hap))}
      <div class="row" style="gap:8px"><button class="btn ghost sm" data-thtest="1">${I('play')}Test sound</button></div>

      <div class="sec-title">PDF reader</div>
      ${row('Background and pages', 'Night mode inverts the page, so white becomes dark. Your marks keep their colors.', seg('rbg', [['dark', 'Dark'], ['sepia', 'Sepia'], ['night', 'Night']], c.rbg))}
      ${row('Pen and highlighter colors', '', seg('pens', Object.keys(T.PENSETS).map((k) => [k, T.PENSETS[k][0].split(' (')[0]]), c.pens))}
      <div class="row" style="gap:8px;margin:-4px 0 12px 2px">${T.PENSETS[c.pens][1].map((x) => `<i class="thdot sm" style="background:${x}"></i>`).join('')}<span style="width:8px"></span>${Object.values(T.PENSETS[c.pens][2]).map((x) => `<i class="thdot sm" style="background:${x}"></i>`).join('')}</div>
      ${row('Page edge', '', seg('pagesh', [['shadow', 'Shadow'], ['flat', 'Flat']], c.pagesh))}

      <div class="sec-title">Personal</div>
      ${row('Rank badge', '', seg('frame', [['hex', 'Hex'], ['circle', 'Circle'], ['shield', 'Shield'], ['square', 'Square']], c.frame))}
      ${row('Title style', '', seg('tstyle', [['normal', 'Normal'], ['caps', 'Capitals'], ['glow', 'Glow'], ['grad', 'Gradient']], c.tstyle))}
      ${row('Diary paper', '', seg('diary', [['plain', 'Plain'], ['notebook', 'Notebook'], ['leather', 'Leather']], c.diary))}
      ${row('Diary writing', 'Handwritten uses the phone’s script font', seg('dfont', [['same', 'Same'], ['hand', 'Handwritten'], ['serif', 'Serif']], c.dfont))}
      ${row('Home-screen widget', '', `<div class="small muted">The widget follows your theme (dark, light or black) and accent color.</div>`)}

      <button class="btn danger block" data-threset="1" style="margin-top:18px">Reset all themes and styles</button>
      <div style="height:24px"></div>`;
    },
    mount(el) {
      const keep = () => { const s = LU.$('.screen.pushed') || LU.$('.screen'); return s ? s.scrollTop : 0; };
      const redo = () => { const s = LU.$('.screen.pushed') || LU.$('.screen'); const y = keep(); LU.render(); const s2 = LU.$('.screen.pushed') || LU.$('.screen'); if (s2) s2.scrollTop = y; };
      const done = () => { LU.save(); T.apply(); redo(); };
      const c = cfg();
      LU.$$('[data-thpal]', el).forEach((b) => (b.onclick = () => { c.pal = b.dataset.thpal; c.sched.on = false; const p = T.PAL[c.pal]; if (p && c.style !== 'system' && c.style !== 'minimal') { /* keep style */ } done(); }));
      LU.$$('[data-thstyle]', el).forEach((b) => (b.onclick = () => {
        c.style = b.dataset.thstyle; const hint = T.STYLES.find((x) => x[0] === c.style)[3];
        if (hint) { c.pal = hint; c.sched.on = false; }
        if (c.style === 'retro') { c.corners = 'sharp'; c.font = 'clean'; } else if (c.style === 'zen' || c.style === 'earth') { c.corners = 'round'; } else if (c.style === 'system') { c.corners = 'cut'; }
        done();
      }));
      LU.$$('[data-th]', el).forEach((b) => (b.onclick = () => {
        const k = b.dataset.th, v = b.dataset.v;
        if (k === 'walltype') { c.wall.type = v; if (v === 'image' && !T.wallUrl) { done(); T.pickWall().then(redo); return; } if (v === 'quote') c.wall.q = ''; }
        else c[k] = v;
        if (k === 'snd') { T.sound(v); LU.sfx('done'); }
        if (k === 'hap') { c.hap = v; LU.vibrate(40); }
        done();
      }));
      LU.$$('[data-thac]', el).forEach((b) => (b.onclick = () => { c.accent = b.dataset.thac; done(); }));
      const col = LU.$('#thColor', el); if (col) { col.oninput = () => { c.accent = col.value; T.apply(); }; col.onchange = () => { c.accent = col.value; done(); }; }
      LU.$$('[data-thtog]', el).forEach((b) => (b.onclick = () => {
        const k = b.dataset.thtog;
        if (k === 'schedOn') c.sched.on = !c.sched.on; else c[k] = !c[k];
        done();
      }));
      LU.$$('[data-thtime]', el).forEach((b) => (b.onchange = () => { c.sched[b.dataset.thtime] = b.value || c.sched[b.dataset.thtime]; LU.save(); T.apply(); }));
      LU.$$('[data-thr]', el).forEach((r) => {
        const k = r.dataset.thr, out = LU.$('#thv_' + k, el);
        r.oninput = () => { const v = +r.value; out.textContent = v + '%'; if (k === 'dim') c.wall.dim = v; else c[k] = v; T.apply(); };
        r.onchange = () => { LU.save(); };
      });
      LU.$$('[data-thwall]', el).forEach((b) => (b.onclick = () => { c.wall.g = +b.dataset.thwall; done(); }));
      const pw = LU.$('[data-thpickwall]', el); if (pw) pw.onclick = () => T.pickWall().then(redo);
      const nq = LU.$('[data-thnewq]', el); if (nq) nq.onclick = () => { c.wall.q = ''; T.wallQuote(); };
      const ts = LU.$('[data-thtest]', el); if (ts) ts.onclick = () => { LU.sfx('done'); setTimeout(() => LU.sfx('level'), 500); LU.vibrate(60); };
      LU.$$('select[data-thsel]', el).forEach((s) => (s.onchange = () => {
        const k = s.dataset.thsel, v = s.value;
        if (k === 'autoD') c.auto.dark = v; else if (k === 'autoL') c.auto.light = v; else if (k === 'schD') c.sched.day = v; else if (k === 'schN') c.sched.night = v;
        done();
      }));
      const rs = LU.$('[data-threset]', el); if (rs) rs.onclick = () => LU.confirm('Reset themes?', 'Colors, styles and look settings go back to the default Hunter Cyan.', 'Reset', () => { LU.state.settings.theme = null; delete LU.state.settings.theme; LU.save(); T.apply(); LU.render(); }, true);
    },
  };
  function selPal(key, cur, dark) {
    const opts = Object.keys(T.PAL).filter((k) => dark === undefined || !!T.PAL[k].dark === !!dark || key.startsWith('sch'));
    return `<select class="inp thsel" data-thsel="${key}">${opts.map((k) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${esc(T.PAL[k].n)}</option>`).join('')}</select>`;
  }
  LU.actions.openThemes = () => LU.push('themes');

  /* start */
  T.boot = async () => { await T.loadWall().catch(() => {}); T.apply(); };
})();
