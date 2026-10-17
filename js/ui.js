/* UI kit: icons, router, sheets, toasts, overlays, charts */
(function () {
  const LU = window.LU, esc = LU.esc;

  /* ---------- icons (24px stroke) ---------- */
  const P = {
    home: '<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
    status: '<path d="M12 3 4 7v5c0 4.4 3.4 8.3 8 9 4.6-.7 8-4.6 8-9V7z"/><path d="m9 12 2 2 4-4"/>',
    quests: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1.2 1.2L7 5M3.5 12l1.2 1.2L7 11M3.5 18l1.2 1.2L7 17"/>',
    study: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M9 8h7"/>',
    plan: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="m9.5 15 1.8 1.8 3.5-3.5"/>',
    more: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
    drop: '<path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z"/>',
    book: '<path d="M2 5h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2zM22 5h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    loop: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
    news: '<path d="M4 4h13v16H6a2 2 0 0 1-2-2zM17 8h3v10a2 2 0 0 1-2 2"/><path d="M8 8h5M8 12h5M8 16h3"/>',
    calc: '<rect x="5" y="2.5" width="14" height="19" rx="2"/><path d="M8 6.5h8M8.5 11h.01M12 11h.01M15.5 11h.01M8.5 14.5h.01M12 14.5h.01M15.5 14.5h.01M8.5 18h.01M12 18h.01M15.5 18h.01"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    bowl: '<path d="M3 11h18a9 9 0 0 1-18 0zM7 7c0-1.5 1-2 1-3M11 7c0-1.5 1-2 1-3M15 7c0-1.5 1-2 1-3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    brief: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    chev: '<path d="m9 5 7 7-7 7"/>',
    left: '<path d="M15 5l-7 7 7 7"/>',
    right: '<path d="m9 5 7 7-7 7"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    dots: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4h6v3"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    play: '<path d="M7 4.5v15l12-7.5z"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    fire: '<path d="M12 22a7 7 0 0 0 7-7c0-4-3-6.5-4-10-2 1.5-3 3.5-3 5.5C11 9 10 8 9.5 6.5 7 9 5 11.5 5 15a7 7 0 0 0 7 7z"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    sword: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/>',
    quote: '<path d="M7 7h4v4c0 3-1.5 5-4 6M14 7h4v4c0 3-1.5 5-4 6"/>',
    save: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>',
    upload: '<path d="M12 21V9M7 14l5-5 5 5"/><path d="M5 3h14"/>',
    heart: '<path d="M12 20.5s-7.5-4.6-9-9.6C2 7.4 4.2 4.5 7.3 4.5c1.9 0 3.5 1 4.7 2.7 1.2-1.7 2.8-2.7 4.7-2.7 3.1 0 5.3 2.9 4.3 6.4-1.5 5-9 9.6-9 9.6z"/>',
    send: '<path d="M21 3 10 14"/><path d="m21 3-7 18-4-7-7-4z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    volume: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
    phone: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    up: '<path d="m6 15 6-6 6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    skip: '<path d="M5 5l9 7-9 7zM19 5v14"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    notes: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
    bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
    marker: '<path d="m9 14 7.5-7.5a2.1 2.1 0 0 1 3 3L12 17"/><path d="M9 14l3 3-2 2H6v-3z"/><path d="M4 21h8"/>',
    underline: '<path d="M7 4v6a5 5 0 0 0 10 0V4"/><path d="M5 20h14"/>',
    eraser: '<path d="m7 21-4-4a2 2 0 0 1 0-2.8L13.2 4a2 2 0 0 1 2.8 0l4 4a2 2 0 0 1 0 2.8L11 21z"/><path d="M8.5 10.5l5 5M11 21h10"/>',
    lasso: '<path d="M12 4c-4.5 0-8 2.2-8 5s3.5 5 8 5 8-2.2 8-5-3.5-5-8-5z" stroke-dasharray="3 2.2"/><path d="M9 13.5c-1.2 2.4-.4 5 2.5 5.5"/>',
    sticky: '<path d="M4 4h16v10l-6 6H4z"/><path d="M14 20v-6h6"/>',
    trophy: '<path d="M8 4h8v6a4 4 0 0 1-8 0z"/><path d="M8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 14v4M8 21h8M10 18h4"/>',
    chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
    bell: '<path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z"/><path d="M10 21h4"/>',
    wallet: '<path d="M3 7h15a3 3 0 0 1 3 3v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zM3 7l12-3v3"/><circle cx="16.5" cy="14" r="1.3"/>',
    steps: '<path d="M8 3c2 0 3 2 3 4.5S10 11 8 11 5 9.5 5 7 6 3 8 3zM16 12c2 0 3 2 3 4.5S18 20 16 20s-3-1-3-3.5 1-4.5 3-4.5z"/>',
    widget: '<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="1.5"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="1.5"/><rect x="13" y="13" width="7.5" height="7.5" rx="1.5"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2.5"/>',
    diary: '<path d="M6 3h11a2 2 0 0 1 2 2v16H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M4 7h3M4 12h3M4 17h3M10 8h6M10 12h4"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    fingerprint: '<path d="M12 11v3.5c0 2-.6 3.8-1.6 5.3M7.5 9.5a5 5 0 0 1 9.4-2.4M5 14c0-1.8.2-3.2.7-4.5M16.5 12.5c0 3-.5 5.3-1.8 7.5M19 15.5c.5-1.5.7-3.5.5-5.5a8 8 0 0 0-14.6-3.5M9.5 20c.5-1 .8-1.8 1-3"/>',
    backspace: '<path d="M20 5H9L3 12l6 7h11a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z"/><path d="m12 9 5 5M17 9l-5 5"/>',
    map: '<path d="M9 4 3 6.5V20l6-2.5 6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>',
    pin: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    minus: '<path d="M5 12h14"/>',
    camera: '<path d="M4 8h3l1.6-2.5h6.8L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.6"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-8 8"/>',
    scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M7 12h10"/>',
    rotate: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
    crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14"/>',
    filepage: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M12 12v6M9 15h6"/>',
    review: '<path d="M5 4h14v17l-7-4-7 4z"/><path d="m9 10 2 2 4-4"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
    hand: '<path d="M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.4l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15"/>',
    expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  };
  LU.icon = (n, cls) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"${cls ? ` class="${cls}"` : ''}>${P[n] || P.star}</svg>`;
  LU.kindIcon = (k) => LU.icon((LU.KINDS[k] || {}).icon || 'star');

  /* ---------- charts ---------- */
  LU.radar = (vals, size = 148) => {
    const keys = Object.keys(LU.STATS), c = size / 2, R = size / 2 - 22;
    const max = Math.max(20, ...keys.map((k) => vals[k]));
    const top = Math.ceil(max / 10) * 10;
    const pt = (i, r) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / keys.length; return [c + r * Math.cos(a), c + r * Math.sin(a)]; };
    const poly = (r) => keys.map((_, i) => pt(i, r).map((x) => x.toFixed(1)).join(',')).join(' ');
    let g = '';
    [1, 0.66, 0.33].forEach((f) => (g += `<polygon points="${poly(R * f)}" fill="none" stroke="rgba(var(--ln-rgb),.16)" stroke-width="1"/>`));
    keys.forEach((_, i) => { const [x, y] = pt(i, R); g += `<line x1="${c}" y1="${c}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(var(--ln-rgb),.12)"/>`; });
    const data = keys.map((k, i) => pt(i, R * Math.max(0.08, Math.sqrt(vals[k] / top))).map((x) => x.toFixed(1)).join(',')).join(' ');
    g += `<polygon points="${data}" fill="rgba(var(--ac-rgb),.22)" stroke="var(--cyan)" stroke-width="1.6" stroke-linejoin="round" style="filter:drop-shadow(0 0 6px rgba(var(--ac-rgb),.8))"/>`;
    keys.forEach((k, i) => { const [x, y] = pt(i, R + 12); g += `<text x="${x.toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="middle">${LU.STATS[k].short}</text>`; });
    return `<svg class="radar" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${g}</svg>`;
  };
  LU.ring = (pct, color = 'var(--cyan)', label = '') => {
    const r = 25, C = 2 * Math.PI * r;
    return `<div class="ring"><svg viewBox="0 0 58 58"><circle cx="29" cy="29" r="${r}" fill="none" stroke="rgba(var(--ln-rgb),.14)" stroke-width="5"/><circle cx="29" cy="29" r="${r}" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - LU.clamp(pct, 0, 1))).toFixed(1)}" style="filter:drop-shadow(0 0 4px ${color});transition:stroke-dashoffset .6s"/></svg><b>${label}</b></div>`;
  };
  const RC = { E: '#8EA4C6', D: '#4BE3A0', C: '#5CE1FF', B: '#3D8BFF', A: '#9B7BFF', S: '#F5C451' };
  LU.rankBadge = (r) => {
    const c = RC[r] || '#9B7BFF', fr = ((LU.state && LU.state.settings.theme) || {}).frame || 'hex';
    const shapes = {
      hex: ['<polygon points="32,3 61,19.5 61,52.5 32,69 3,52.5 3,19.5"', '<polygon points="32,11 54,23.5 54,48.5 32,61 10,48.5 10,23.5"'],
      circle: ['<circle cx="32" cy="36" r="30"', '<circle cx="32" cy="36" r="23"'],
      shield: ['<path d="M5 6 H59 V38 Q59 58 32 69 Q5 58 5 38 Z"', '<path d="M12 12 H52 V37 Q52 53 32 62 Q12 53 12 37 Z"'],
      square: ['<rect x="4" y="8" width="56" height="56" rx="10"', '<rect x="11" y="15" width="42" height="42" rx="6"'],
    }[fr] || null;
    const o = shapes[0], i = shapes[1];
    return `<div class="rank" style="--rc:${c}"><svg viewBox="0 0 64 72"><defs><linearGradient id="rg${r}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".45"/><stop offset="1" stop-color="${c}" stop-opacity=".08"/></linearGradient></defs>${o} fill="url(#rg${r})" stroke="${c}" stroke-width="2" style="filter:drop-shadow(0 0 6px ${c})"/>${i} fill="none" stroke="${c}" stroke-opacity=".35" stroke-width="1"/></svg><b>${r}</b></div>`;
  };
  LU.bar = (pct, cls = '') => `<div class="bar ${cls}"><i style="width:${(LU.clamp(pct, 0, 1) * 100).toFixed(1)}%"></i></div>`;

  /* ---------- router ---------- */
  LU.views = {};
  LU.actions = {};
  const TABS = [['status', 'Status', 'status'], ['quests', 'Quests', 'quests'], ['study', 'Study', 'study'], ['notes', 'Notes', 'notes'], ['plan', 'Plan', 'plan'], ['more', 'More', 'more']];
  let tab = 'status', stack = [];
  LU.currentTab = () => tab;

  LU.shell = () => {
    document.body.insertAdjacentHTML('afterbegin', '<div class="bg"></div>');
    const app = LU.$('#app');
    app.innerHTML = `<div class="screen" id="main"></div><nav class="tabs">${TABS.map(([k, n, ic]) => `<button data-act="tab" data-tab="${k}" aria-label="${n}" class="${k === tab ? 'on' : ''}">${LU.icon(ic)}<span>${n}</span></button>`).join('')}</nav><div class="toasts"></div>`;
  };
  const renderInto = (el, view, params) => {
    const st = el.scrollTop;
    el.innerHTML = view.render(params || {});
    if (view.mount) view.mount(el, params || {});
    return st;
  };
  LU.render = (keepScroll = true) => {
    const top = stack[stack.length - 1];
    if (top) { const st = renderInto(top.el, LU.views[top.name], top.params); if (keepScroll) top.el.scrollTop = st; }
    const main = LU.$('#main');
    const st = renderInto(main, LU.views[tab]);
    if (keepScroll) main.scrollTop = st;
    LU.$$('nav.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    LU.updateBadges && LU.updateBadges();
  };
  LU.go = (t) => {
    while (stack.length) popNow();
    if (t === tab) { LU.$('#main').scrollTo({ top: 0, behavior: 'smooth' }); return; }
    tab = t;
    const main = LU.$('#main');
    main.classList.remove('fade'); void main.offsetWidth; main.classList.add('fade');
    renderInto(main, LU.views[tab]); main.scrollTop = 0;
    LU.$$('nav.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  };
  LU.push = (name, params) => {
    const el = document.createElement('div');
    el.className = 'screen pushed';
    LU.$('#app').appendChild(el);
    stack.push({ name, params: params || {}, el });
    renderInto(el, LU.views[name], params);
  };
  const popNow = () => { const t = stack.pop(); if (t) t.el.remove(); };
  LU.pop = () => {
    const t = stack.pop(); if (!t) return;
    t.el.classList.add('out'); setTimeout(() => t.el.remove(), 220);
    LU.render();
  };
  LU.top = () => stack[stack.length - 1];

  /* global click delegation */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = LU.actions[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el, e); }
  });
  LU.actions.tab = (el) => { LU.sfx('tap'); LU.go(el.dataset.tab); };
  LU.actions.back = () => LU.pop();

  /* ---------- sheet ---------- */
  let sheetEl = null, scrimEl = null, sheetOpts = null;
  LU.sheet = (o) => {
    LU.closeSheet(true);
    sheetOpts = o;
    scrimEl = document.createElement('div'); scrimEl.className = 'scrim';
    const born = Date.now(); /* a finger tap that opened this sheet also sends a late click to whatever is under it: ignore that */
    scrimEl.onclick = () => { if (Date.now() - born > 450) LU.closeSheet(); };
    sheetEl = document.createElement('div'); sheetEl.className = 'sheet';
    sheetEl.innerHTML = `<div class="grab"></div><div class="sh-h"><h2>${esc(o.title || '')}</h2><button class="iconbtn" data-act="closeSheet" aria-label="Close">${LU.icon('x')}</button></div><div class="sh-b">${o.body || ''}</div>${o.foot ? `<div class="sh-f">${o.foot}</div>` : ''}`;
    document.body.append(scrimEl, sheetEl);
    if (o.mount) o.mount(sheetEl);
    return sheetEl;
  };
  LU.closeSheet = (instant) => {
    if (!sheetEl) return false;
    const s = sheetEl, c = scrimEl, o = sheetOpts;
    sheetEl = scrimEl = sheetOpts = null;
    if (o && o.onClose) o.onClose();
    if (instant) { s.remove(); c.remove(); return true; }
    s.classList.add('out'); c.classList.add('out');
    setTimeout(() => { s.remove(); c.remove(); }, 200);
    return true;
  };
  LU.actions.closeSheet = () => LU.closeSheet();
  LU.confirm = (title, text, okLabel, onOk, danger) => {
    LU.sheet({
      title, body: `<p class="muted" style="margin:4px 0 8px">${esc(text)}</p>`,
      foot: `<button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn ${danger ? 'danger' : ''}" id="cfOk">${esc(okLabel)}</button>`,
      mount: (s) => { LU.$('#cfOk', s).onclick = () => { LU.closeSheet(); onOk(); }; },
    });
  };

  /* ---------- toast + floating XP ---------- */
  LU.toast = (text, opts = {}) => {
    const box = LU.$('.toasts'); if (!box) return;
    const t = document.createElement('div'); t.className = 'toast';
    t.innerHTML = `${opts.sys === false ? '' : '<span class="sys">SYSTEM</span>'}<span>${esc(text)}</span>${opts.undo ? '<button>Undo</button>' : ''}`;
    if (opts.undo) t.querySelector('button').onclick = () => { opts.undo(); kill(); };
    box.appendChild(t);
    const kill = () => { t.classList.add('out'); setTimeout(() => t.remove(), 260); };
    setTimeout(kill, opts.ms || 2600);
  };
  LU.floatXP = (el, text) => {
    const r = el.getBoundingClientRect();
    const f = document.createElement('div'); f.className = 'fxp'; f.textContent = text;
    f.style.left = r.left + r.width / 2 + 'px'; f.style.top = r.top - 4 + 'px';
    document.body.appendChild(f); setTimeout(() => f.remove(), 1150);
  };

  /* ---------- overlays ---------- */
  let ovEl = null, ovClose = null;
  LU.overlay = (html, onClose) => {
    LU.closeOverlay(true);
    ovEl = document.createElement('div'); ovEl.className = 'ov'; ovEl.innerHTML = html;
    ovClose = onClose;
    document.body.appendChild(ovEl);
    return ovEl;
  };
  LU.closeOverlay = (instant) => {
    if (!ovEl) return false;
    const o = ovEl, cb = ovClose; ovEl = ovClose = null;
    if (instant) o.remove(); else { o.classList.add('out'); setTimeout(() => o.remove(), 300); }
    if (cb) cb();
    return true;
  };
  LU.actions.closeOv = () => LU.closeOverlay();
  const queue = [];
  let showing = false;
  LU.celebrate = (fn) => { queue.push(fn); if (!showing) next(); };
  const next = () => { const f = queue.shift(); if (!f) { showing = false; return; } showing = true; f(() => setTimeout(next, 250)); };

  LU.on('levelup', (e) => LU.celebrate((done) => {
    LU.sfx('level'); LU.vibrate(60);
    if (((LU.state.settings.theme || {}).lvup) === 'banner') {
      const up = e.rankFrom.r !== e.rankTo.r;
      LU.toast(`LEVEL UP! Level ${e.to}${up ? ' · Rank ' + e.rankTo.r + ' · ' + e.rankTo.title : ''}`, { sys: false, ms: 3800 });
      setTimeout(done, 600); return;
    }
    const rankUp = e.rankFrom.r !== e.rankTo.r;
    const el = LU.overlay(`<div class="rays"></div><div class="burst"></div><div class="burst b2"></div>
      <div class="win gold lvup"><div class="win-in"><div class="win-h">LEVEL UP</div>
      <div class="big">${e.to}</div>
      <p class="sysline later" style="margin-top:14px">${rankUp ? `Rank up: <b>${e.rankFrom.r} → ${e.rankTo.r}</b>. New title: <b>${esc(e.rankTo.title)}</b>.` : `You reached level <b>${e.to}</b>. Keep the momentum.`}</p>
      ${rankUp ? `<div class="later" style="display:flex;justify-content:center;gap:18px;align-items:center;margin:4px 0 14px">${LU.rankBadge(e.rankFrom.r)}${LU.icon('right')}${LU.rankBadge(e.rankTo.r)}</div>` : ''}
      <button class="btn gold block later2" data-act="closeOv">Continue</button></div></div>`, done);
    el.querySelector('.win').style.position = 'relative';
  }));
  LU.on('clear', (e) => LU.celebrate((done) => {
    LU.sfx('clear'); LU.vibrate(40);
    LU.overlay(`<div class="win"><div class="win-in"><div class="win-h">QUEST COMPLETE</div>
      <p class="quote" style="font-size:20px">Daily quest cleared.</p>
      <p class="sysline">Reward: <b>+100 XP</b>. Streak: <b>${e.streak} day${e.streak === 1 ? '' : 's'}</b>.</p>
      <button class="btn block later" data-act="closeOv">Continue</button></div></div>`, done);
  }));
  LU.on('boss', (e) => LU.celebrate((done) => {
    LU.sfx('level'); LU.vibrate(80);
    LU.overlay(`<div class="burst" style="border-color:var(--red)"></div><div class="win red"><div class="win-in"><div class="win-h">BOSS DEFEATED</div>
      <p class="quote" style="font-size:20px">The ${e.hours}-hour week falls.</p>
      <p class="sysline">You studied ${e.hours} hours this week. Reward: <b>+500 XP</b>.</p>
      <button class="btn block later" data-act="closeOv">Claim reward</button></div></div>`, done);
  }));

  /* ---------- Android back button ---------- */
  window.LU_back = () => {
    if (LU.closeOverlay()) return true;
    if (LU.closeSheet()) return true;
    if (stack.length) { LU.pop(); return true; }
    if (tab !== 'status') { LU.go('status'); return true; }
    return false;
  };
})();
