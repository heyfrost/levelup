/* PDF reader: GoodNotes-style marking (pen, highlighter, underline, eraser, sticky notes), zoom, search, bookmarks */
(function () {
  const LU = window.LU, esc = LU.esc, I = LU.icon;

  const PEN = ['#1B1B1F', '#1F5FD6', '#D7263D', '#12873F'];
  const HL = { yellow: '#FFE45C', green: '#93F2A0', pink: '#FFA3CB', blue: '#9AD8FF' };
  const PEN_W = [0.0022, 0.0036, 0.006];
  const HL_W = [0.012, 0.018, 0.026];
  const GAP = 4, MAXZ = 5;
  const STK = ['⭐', '❓', '❗', '✅', '📌', '🔥', 'PYQ', 'IMP', 'REV'];
  LU.HL = HL; LU.PEN = PEN;

  let R = null;
  const prefs = () => (LU.state.reader = Object.assign({ tool: 'hand', pen: 0, penW: 1, hl: 'yellow', hlW: 1, straight: true, penOnly: false, stk: '', dark: false }, LU.state.reader || {}));

  /* ---------- drawing helpers (shared with revision mode) ---------- */
  LU.drawStroke = (ctx, s, W, H, ox = 0, oy = 0) => {
    const p = s.p; if (!p || p.length < 2) return;
    ctx.save();
    ctx.strokeStyle = s.c; ctx.lineWidth = Math.max(1, s.w * W);
    ctx.lineCap = s.t === 'hl' && s.st ? 'butt' : 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    const X = (i) => p[i] * W - ox, Y = (i) => p[i + 1] * H - oy;
    ctx.moveTo(X(0), Y(0));
    if (p.length === 2) ctx.lineTo(X(0) + 0.1, Y(0));
    else if (p.length === 4) ctx.lineTo(X(2), Y(2));
    else {
      for (let i = 2; i < p.length - 2; i += 2) ctx.quadraticCurveTo(X(i), Y(i), (X(i) + X(i + 2)) / 2, (Y(i) + Y(i + 2)) / 2);
      ctx.lineTo(X(p.length - 2), Y(p.length - 2));
    }
    ctx.stroke(); ctx.restore();
  };
  const bbox = (s) => {
    let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
    for (let i = 0; i < s.p.length; i += 2) { x0 = Math.min(x0, s.p[i]); x1 = Math.max(x1, s.p[i]); y0 = Math.min(y0, s.p[i + 1]); y1 = Math.max(y1, s.p[i + 1]); }
    const h = s.w / 2; return [x0 - h, y0 - h, x1 + h, y1 + h];
  };
  LU.strokeBox = bbox;

  /* ---------- open / close ---------- */
  LU.openReader = async (id, opts = {}) => {
    const d = LU.doc(id); if (!d) return;
    if (R) closeReader(true);
    if (LU.orient) LU.orient(true);
    try { if (window.Android && Android.setImmersive) Android.setImmersive(true); } catch (e) {}
    const P = prefs();
    const el = document.createElement('div');
    el.className = 'reader' + (LU.ios ? '' : ' rd-hide');
    el.innerHTML = `
      <header class="rd-top"><button class="iconbtn" data-r="close" aria-label="Back">${I('back')}</button>
        <div class="grow" style="min-width:0"><div class="rd-title ell">${esc(d.name)}</div><button class="rd-pg" data-r="goto"><span id="rdPg">1</span> / ${d.pages}</button></div>
        <button class="iconbtn" data-r="search" aria-label="Search">${I('search')}</button>
        <button class="iconbtn" data-r="map" id="rdMapB" aria-label="Map">${I('map')}</button>
        <button class="iconbtn" data-r="rec" id="rdRecB" aria-label="Record audio">${I('mic')}</button>
        <button class="iconbtn" data-r="mark" id="rdMark" aria-label="Bookmark">${I('bookmark')}</button>
        ${window.Android && Android.setOrientation ? `<button class="iconbtn" data-r="rot" id="rdRot" aria-label="Rotate screen">${I('rotate')}</button>` : ''}
        <button class="iconbtn" data-r="menu" aria-label="More">${I('dots')}</button></header>
      <div class="rd-scroll" id="rdScroll"><div class="rd-pages" id="rdPages"></div></div>
      <button class="rd-peek" data-r="peek" aria-label="Show or hide the bars">${I('dots')}</button>
      <div class="rd-loading">Opening…</div>
      <div class="rd-bottom"><div class="rd-opts" id="rdOpts"></div>
        <div class="rd-tools">
          ${[['hand', 'hand', 'Scroll'], ['pen', 'pen', 'Pen'], ['hl', 'marker', 'Highlighter'], ['line', 'underline', 'Underline'], ['erase', 'eraser', 'Eraser'], ['lasso', 'lasso', 'Lasso: select, move, resize marks'], ['note', 'sticky', 'Note or sticker']].map(([t, ic, n]) => `<button class="rt" data-tool="${t}" aria-label="${n}">${I(ic)}</button>`).join('')}
          <button class="rt" data-r="img" aria-label="Add image">${I('image')}</button>
          <button class="rt" data-r="seltext" id="rdSelB" aria-label="Select and copy text">${I('copy')}</button>
          <span class="rd-sep"></span>
          <button class="rt" data-r="undo" aria-label="Undo">${I('undo')}</button><button class="rt" data-r="redo" aria-label="Redo">${I('redo')}</button>
        </div></div>`;
    if (P.dark) el.classList.add('dark');
    document.body.appendChild(el);
    R = { id, d, el, P, urls: new Map(), selImg: null, zoom: 1, pages: [], undo: [], redo: [], live: null, opened: Date.now(), active: 0, lastAct: Date.now() };
    R.scroller = LU.$('#rdScroll', el); R.pagesEl = LU.$('#rdPages', el);
    el.addEventListener('click', onClick);
    setTool(P.tool === 'erase' || P.tool === 'note' || P.tool === 'lasso' ? 'hand' : P.tool, true);
    try {
      R.pdf = await LU.openDoc(id);
      R.ink = await LU.getInk(id);
    } catch (e) {
      closeReader(true);
      LU.toast(e.message === 'missing' ? 'This PDF file is missing. Open its menu and choose “Replace the PDF file”.' : 'This PDF could not be opened.', { ms: 4500 });
      return;
    }
    if (!R || R.id !== id) return;
    if (LU.theme) LU.theme.setSubject(d.subj);
    const p1 = await R.pdf.getPage(1), v = p1.getViewport({ scale: 1 });
    for (let n = 1; n <= R.pdf.numPages; n++) {
      const pe = document.createElement('div'); pe.className = 'pg'; pe.dataset.n = n;
      pe.innerHTML = `<div class="pg-n">${n}</div>`;
      R.pagesEl.appendChild(pe);
      R.pages.push({ n, w0: v.width, h0: v.height, el: pe, key: '' });
    }
    if (d.pages !== R.pdf.numPages) { d.pages = R.pdf.numPages; }
    layout();
    LU.$('.rd-loading', el).remove();
    d.opened = Date.now(); LU.save();
    goTo(opts.page || d.page || 1, opts.rect, true);
    R.pagesEl.addEventListener('pointerdown', imgDown);
    R.pagesEl.addEventListener('pointermove', imgMove);
    R.pagesEl.addEventListener('pointerup', imgUp);
    R.pagesEl.addEventListener('pointercancel', imgUp);
    R.scroller.addEventListener('scroll', onScroll, { passive: true });
    R.scroller.addEventListener('pointerdown', onDown);
    R.scroller.addEventListener('pointermove', onMove);
    R.scroller.addEventListener('pointerup', onUp);
    R.scroller.addEventListener('pointercancel', onCancel);
    R.scroller.addEventListener('touchstart', onTouchStart, { passive: false });
    R.scroller.addEventListener('touchmove', onTouchMove, { passive: false });
    R.scroller.addEventListener('touchend', onTouchEnd, { passive: false });
    R.scroller.addEventListener('touchcancel', onTouchEnd, { passive: false });
    window.addEventListener('resize', onResize);
    R.timer = setInterval(() => { if (!document.hidden && Date.now() - R.lastAct < 180000) R.active += 15; }, 15000);
    sizeAll();
    updateMark();
  };

  const closeReader = (silent) => {
    if (!R) return;
    if (LU.recOnClose) LU.recOnClose(R.id);
    const r = R; R = null;
    if (LU.orient) LU.orient(false);
    try { if (window.Android && Android.setImmersive) Android.setImmersive(false); } catch (e) {}
    if (LU.theme) LU.theme.setSubject(null);
    clearInterval(r.timer); try { r.urls.forEach((u) => URL.revokeObjectURL(u)); } catch (e) {}
    window.removeEventListener('resize', onResize);
    if (r.ink) LU.saveInk(r.id, true);
    const d = LU.doc(r.id);
    if (d) { d.mins = (d.mins || 0) + Math.round(r.active / 60); LU.save(); }
    r.el.classList.add('out');
    setTimeout(() => r.el.remove(), 220);
    if (!silent) LU.render();
  };
  LU.closeReader = closeReader;
  LU.rd = { get R() { return R; }, goTo: (n, instant) => R && goTo(n, null, instant), page: () => (R ? currentPage() : 0), redraw: () => { if (R) R.pages.forEach((p) => p.hl && drawInk(p)); }, hide: (on) => { if (R) R.el.classList.toggle('rd-hide', !!on); } };
  LU.readerOpen = () => !!R;

  /* Back button: close sheets first, then the options popover, then the reader */
  const prevBack = window.LU_back;
  window.LU_back = () => {
    if (LU.closeOverlay()) return true;
    if (LU.closeSheet()) return true;
    if (R && (R.sel || R.selMode)) { clearSel(); setSelMode(false); return true; }
    if (R) { if (R.el.classList.contains('rd-hide')) { R.el.classList.remove('rd-hide'); return true; } closeReader(); return true; }
    return prevBack();
  };

  /* ---------- layout & rendering ---------- */
  const baseW = () => R.scroller.clientWidth - GAP * 2;
  const pageW = () => Math.round(baseW() * R.zoom);
  function layout() {
    const W = pageW();
    R.pagesEl.style.width = W + GAP * 2 + 'px';
    let y = GAP;
    R.pages.forEach((p) => {
      p.cw = W; p.ch = Math.round((W * p.h0) / p.w0); p.top = y;
      p.el.style.width = p.cw + 'px'; p.el.style.height = p.ch + 'px';
      y += p.ch + GAP;
    });
    R.pagesEl.style.height = y + 120 + 'px';
  }
  /* real page sizes (PDFs can mix sizes); fetched in the background */
  async function sizeAll() {
    const r = R;
    for (let i = 2; i <= r.pages.length; i++) {
      if (R !== r) return;
      try {
        const pg = await r.pdf.getPage(i), v = pg.getViewport({ scale: 1 }), p = r.pages[i - 1];
        if (Math.abs(v.width / v.height - p.w0 / p.h0) > 0.01) {
          const anchor = currentPage(), off = r.scroller.scrollTop - r.pages[anchor - 1].top;
          p.w0 = v.width; p.h0 = v.height; layout();
          r.scroller.scrollTop = r.pages[anchor - 1].top + off;
        } else { p.w0 = v.width; p.h0 = v.height; }
      } catch (e) {}
      if (i % 20 === 0) await new Promise((res) => setTimeout(res, 0));
    }
  }
  const currentPage = () => {
    if (!R || !R.pages.length) return 1;
    const mid = R.scroller.scrollTop + R.scroller.clientHeight * 0.4;
    let lo = 0, hi = R.pages.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (R.pages[m].top <= mid) lo = m; else hi = m - 1; }
    return lo + 1;
  };
  let raf = 0;
  function onScroll() { lpClear(); if (!raf) raf = requestAnimationFrame(() => { raf = 0; update(); }); }
  function update() {
    if (!R) return;
    const top = R.scroller.scrollTop, h = R.scroller.clientHeight;
    const n = currentPage();
    const pg = LU.$('#rdPg', R.el); if (pg) pg.textContent = n;
    if (R.d.page !== n) { R.d.page = n; LU.save(); updateMark(); }
    if (n === R.d.pages && R.d.pages > 2 && !R.d.fin && !R.d.finAsk && !R.askedFin) {
      R.askedFin = true; const rid = R.id;
      setTimeout(() => { if (R && R.id === rid && currentPage() === R.d.pages && !R.d.fin) { R.d.finAsk = true; LU.save(); LU.confirm('Finished this PDF?', 'You reached the last page. Mark it as finished? (Asked only once.)', 'Mark finished', () => LU.markFinished(rid, true)); } }, 1800);
    }
    if (LU.recPage) LU.recPage(n);
    R.pages.forEach((p) => {
      const near = p.top + p.ch > top - h * 0.6 && p.top < top + h * 1.6;
      const far = p.top + p.ch < top - h * 3 || p.top > top + h * 4;
      if (near) renderPage(p);
      else if (far && p.key) unload(p);
    });
  }
  function unload(p) {
    if (p.task) { try { p.task.cancel(); } catch (e) {} p.task = null; }
    p.el.querySelectorAll('canvas').forEach((c) => c.remove());
    p.key = ''; p.cv = p.hl = p.ink = null;
  }
  async function renderPage(p) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    let pxW = p.cw * dpr, pxH = p.ch * dpr;
    const cap = 4.5e6; if (pxW * pxH > cap) { const f = Math.sqrt(cap / (pxW * pxH)); pxW *= f; pxH *= f; }
    pxW = Math.round(pxW); pxH = Math.round(pxH);
    const key = pxW + 'x' + pxH;
    if (p.key === key || p.pending === key) return;
    p.pending = key;
    const r = R;
    try {
      const page = await r.pdf.getPage(p.n);
      const vp = page.getViewport({ scale: pxW / p.w0 });
      const c = document.createElement('canvas'); c.className = 'pc'; c.width = pxW; c.height = pxH;
      const ctx = c.getContext('2d', { alpha: false }); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, pxW, pxH);
      if (p.task) { try { p.task.cancel(); } catch (e) {} }
      p.task = page.render({ canvasContext: ctx, viewport: vp });
      await p.task.promise;
      p.task = null;
      if (R !== r || p.pending !== key) return;
      const old = p.cv; p.el.insertBefore(c, p.el.firstChild); if (old) old.remove();
      p.cv = c;
      if (!p.hl) { p.hl = mk(p, 'hlc'); p.ink = mk(p, 'inkc'); }
      p.hl.width = p.ink.width = pxW; p.hl.height = p.ink.height = pxH;
      p.key = key; p.pending = '';
      drawInk(p);
    } catch (e) { if (p.pending === key) p.pending = ''; }
  }
  const mk = (p, cls) => { const c = document.createElement('canvas'); c.className = cls; p.el.appendChild(c); return c; };
  function drawInk(p) {
    if (!p.hl || !R.ink) return;
    const W = p.hl.width, H = p.hl.height;
    const a = p.hl.getContext('2d'), b = p.ink.getContext('2d');
    a.clearRect(0, 0, W, H); b.clearRect(0, 0, W, H);
    R.ink.strokes.forEach((s) => { if (s.pg === p.n && !(LU.recHide && LU.recHide(s))) LU.drawStroke(s.t === 'hl' ? a : b, s, W, H); });
    drawImgs(p);
    drawNotes(p);
  }
  /* sticky notes and stickers: move with a press-and-drag, resize with the corner handle */
  const noteW = (n) => n.w || (n.k === 's' ? 0.1 : 0.34);
  function placeNote(p, b, n) {
    const pw = p.el.clientWidth || p.cw || 340, w = noteW(n), x = LU.clamp(n.x, 0, Math.max(0, 1 - w));
    b.style.width = w * 100 + '%'; b.style.left = x * 100 + '%'; b.style.top = n.y * 100 + '%';
    const wpx = w * pw, fs = n.k === 's' ? (/^[A-Z]{2,5}$/.test(n.text) ? LU.clamp(wpx * 0.3, 8, 40) : LU.clamp(wpx * 0.62, 12, 80)) : LU.clamp(wpx * 0.09, 7, 30);
    b.style.fontSize = fs + 'px';
    b.style.height = n.h ? n.h * 100 + '%' : '';
    const t = b.querySelector('.pnt');
    if (t && n.k !== 's') t.style.webkitLineClamp = n.h ? Math.max(1, Math.floor((n.h * (p.ch || 500) - fs * 1.1) / (fs * 1.3))) : 4;
  }
  function drawNotes(p) {
    p.el.querySelectorAll('.pnote').forEach((x) => x.remove());
    R.ink.notes.filter((n) => n.pg === p.n && !(LU.recHide && LU.recHide(n))).forEach((n) => {
      const stk = n.k === 's';
      const b = document.createElement('button'); b.className = 'pnote' + (stk ? ' pstk' + (/^[A-Z]{2,5}$/.test(n.text) ? ' ptag' : '') : ''); b.dataset.note = n.id;
      const t = document.createElement('span'); t.className = 'pnt'; t.textContent = n.text; b.appendChild(t);
      let m = null;
      if (!stk && n.text.length > 30) { m = document.createElement('i'); m.className = 'pnm'; m.textContent = 'tap to read all'; b.appendChild(m); }
      const h = document.createElement('i'); h.className = 'pnh'; b.appendChild(h);
      p.el.appendChild(b); placeNote(p, b, n); bindNote(p, b, n);
      if (m) requestAnimationFrame(() => { m.style.display = t.scrollHeight > t.clientHeight + 2 ? '' : 'none'; });
    });
  }
  function bindNote(p, b, n) {
    let st = null;
    const geo = () => ({ x: n.x, y: n.y, w: noteW(n), h: n.h || 0 });
    b.addEventListener('pointerdown', (e) => {
      if (!R) return; e.stopPropagation(); R.lastAct = Date.now();
      const rect = p.el.getBoundingClientRect(), resize = !!e.target.closest('.pnh');
      st = { x0: e.clientX, y0: e.clientY, g0: geo(), hpx: b.offsetHeight, rect, resize, drag: resize, moved: false, pid: e.pointerId, away: false };
      if (!resize) st.timer = setTimeout(() => { if (st) { st.drag = true; b.classList.add('drag'); LU.vibrate && LU.vibrate(15); } }, 320);
      try { b.setPointerCapture(e.pointerId); } catch (x) {}
    });
    b.addEventListener('pointermove', (e) => {
      if (!st || st.pid !== e.pointerId) return;
      const dxp = e.clientX - st.x0, dyp = e.clientY - st.y0;
      if (!st.drag) { if (Math.hypot(dxp, dyp) > 8) { clearTimeout(st.timer); st.away = true; } return; }
      e.preventDefault();
      const dx = dxp / st.rect.width, dy = dyp / st.rect.height, g = st.g0;
      if (st.resize) {
        n.w = LU.clamp(g.w + dx, n.k === 's' ? 0.05 : 0.14, Math.max(0.14, 1 - g.x));
        n.h = LU.clamp((g.h || st.hpx / st.rect.height) + dy, n.k === 's' ? 0.03 : 0.06, Math.max(0.06, 1 - g.y));
      } else {
        const w = noteW(n), hh = b.offsetHeight / st.rect.height;
        n.x = LU.clamp(g.x + dx, 0, Math.max(0, 1 - w)); n.y = LU.clamp(g.y + dy, 0, Math.max(0, 1 - hh));
      }
      st.moved = true; placeNote(p, b, n);
    });
    const end = (e) => {
      if (!st || st.pid !== e.pointerId) return;
      const s0 = st; st = null; clearTimeout(s0.timer); b.classList.remove('drag'); R.nTouch = Date.now();
      try { b.releasePointerCapture(e.pointerId); } catch (x) {}
      if (s0.moved) { push({ t: 'note^', n, before: s0.g0, after: geo() }); drawNotes(p); return; }
      if (e.type === 'pointerup' && !s0.drag && !s0.away) noteSheet(n.id);
      else if (e.type === 'pointerup' && s0.drag && !s0.moved) noteSheet(n.id);
    };
    b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end);
  }
  function addAiNote(pg, text) {
    const nn = { id: 'n' + LU.uid(), pg, x: 0.05, y: 0.05, w: 0.5, text: text.slice(0, 3000), at: Date.now() };
    { const rt = LU.recStamp && LU.recStamp(R.id); if (rt) nn.rt = rt; }
    R.ink.notes.push(nn); push({ t: 'note+', n: nn }); const p = pageByN(pg); if (p) drawNotes(p); clearSel(); setSelMode(false);
    LU.toast('Note added on page ' + pg + '. Hold it to move, drag the corner to resize.', { ms: 3500 });
  }
  function stampAt(p, x, y, k) {
    const w = /^[A-Z]{2,5}$/.test(k) ? 0.14 : 0.09;
    const nn = { id: 'n' + LU.uid(), pg: p.n, k: 's', w, x: LU.clamp(x - w / 2, 0, 1 - w), y: LU.clamp(y - 0.02, 0, 0.95), text: k, at: Date.now() };
    { const rt = LU.recStamp && LU.recStamp(R.id); if (rt) nn.rt = rt; }
    R.ink.notes.push(nn); push({ t: 'note+', n: nn }); drawNotes(p); LU.sfx('tap');
  }

  /* ---------- lasso: select marks, move, resize, recolour, delete ---------- */
  function paintLasso(L) {
    const c = L.p.live; if (!c) return; const ctx = c.getContext('2d'); ctx.clearRect(0, 0, c.width, c.height);
    ctx.save(); ctx.strokeStyle = '#2bd4ff'; ctx.lineWidth = Math.max(2, c.width * 0.004); ctx.setLineDash([c.width * 0.02, c.width * 0.014]); ctx.beginPath();
    L.path.forEach((q, i) => (i ? ctx.lineTo(q[0] * c.width, q[1] * c.height) : ctx.moveTo(q[0] * c.width, q[1] * c.height))); ctx.closePath(); ctx.stroke(); ctx.restore();
  }
  const inPoly = (poly, x, y) => { let r = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) r = !r; } return r; };
  function finishLasso(L) {
    const poly = L.path; if (poly.length < 5) return;
    const list = R.ink.strokes.filter((s) => {
      if (s.pg !== L.p.n) return false;
      const q = []; for (let i = 0; i < s.p.length; i += 2) q.push([s.p[i], s.p[i + 1]]);
      if (q.length === 2) q.push([(q[0][0] + q[1][0]) / 2, (q[0][1] + q[1][1]) / 2]);
      let inn = 0; q.forEach((z) => inPoly(poly, z[0], z[1]) && inn++);
      return inn / q.length >= 0.5;
    });
    if (!list.length) { LU.toast('No marks inside that loop', { sys: false, ms: 1400 }); return; }
    R.lasso = { p: L.p, list }; showLasso();
  }
  function lassoBox() {
    let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
    R.lasso.list.forEach((s) => { const b = bbox(s); x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); });
    return [Math.max(0, x0), Math.max(0, y0), Math.min(1, x1), Math.min(1, y1)];
  }
  function clearLasso() { if (!R) return; if (R.lasso && R.lasso.el) R.lasso.el.remove(); const bar = R.el && LU.$('.lbar', R.el); if (bar) bar.remove(); R.lasso = null; }
  function placeLasso() {
    const Lz = R.lasso, b = lassoBox(); Lz.box = b;
    Lz.el.style.left = b[0] * 100 + '%'; Lz.el.style.top = b[1] * 100 + '%'; Lz.el.style.width = (b[2] - b[0]) * 100 + '%'; Lz.el.style.height = (b[3] - b[1]) * 100 + '%';
  }
  function showLasso() {
    const Lz = R.lasso, p = Lz.p; if (Lz.el) Lz.el.remove();
    const el = document.createElement('div'); el.className = 'lbox'; el.innerHTML = '<i class="lh"></i>'; Lz.el = el; p.el.appendChild(el); placeLasso();
    let st = null;
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); e.preventDefault();
      const rect = p.el.getBoundingClientRect(), b0 = Lz.box.slice();
      st = { mode: e.target.closest('.lh') ? 'size' : 'move', x0: e.clientX, y0: e.clientY, rect, b0, snap: Lz.list.map((s) => ({ s, p: s.p.slice(), w: s.w, c: s.c })), pid: e.pointerId, moved: false };
      try { el.setPointerCapture(e.pointerId); } catch (x) {}
    });
    el.addEventListener('pointermove', (e) => {
      if (!st || st.pid !== e.pointerId) return; e.preventDefault();
      const dx = (e.clientX - st.x0) / st.rect.width, dy = (e.clientY - st.y0) / st.rect.height, b0 = st.b0;
      if (Math.abs(dx) + Math.abs(dy) > 0.002) st.moved = true;
      if (st.mode === 'move') {
        const mx = LU.clamp(dx, -b0[0], 1 - b0[2]), my = LU.clamp(dy, -b0[1], 1 - b0[3]);
        st.snap.forEach((z) => { z.s.p = z.p.map((v, i) => +(v + (i % 2 ? my : mx)).toFixed(4)); });
      } else {
        const bw = Math.max(0.01, b0[2] - b0[0]), bh = Math.max(0.01, b0[3] - b0[1]);
        const f = LU.clamp(1 + (dx / bw + dy / bh) / 2, 0.2, Math.min(5, (1 - b0[0]) / bw, (1 - b0[1]) / bh));
        st.snap.forEach((z) => { z.s.p = z.p.map((v, i) => +(i % 2 ? b0[1] + (v - b0[1]) * f : b0[0] + (v - b0[0]) * f).toFixed(4)); z.s.w = z.w * f; });
      }
      drawInk(p); placeLasso();
    });
    const end = (e) => {
      if (!st || st.pid !== e.pointerId) return; const s0 = st; st = null;
      if (s0.moved) push({ t: 'xform', list: s0.snap.map((z) => ({ s: z.s, pg: p.n, before: { p: z.p, w: z.w, c: z.c }, after: { p: z.s.p.slice(), w: z.s.w, c: z.s.c } })) });
    };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    let bar = LU.$('.lbar', R.el); if (bar) bar.remove();
    bar = document.createElement('div'); bar.className = 'lbar';
    bar.innerHTML = PEN.map((c) => `<button class="sw2" data-lb="pen" data-c="${c}" style="--c:${c}"></button>`).join('') + '<span class="rd-sep"></span>' + Object.keys(HL).map((k) => `<button class="sw2" data-lb="hl" data-c="${HL[k]}" style="--c:${HL[k]}"></button>`).join('') + '<span class="rd-sep"></span>' + `<button class="chip" data-lb="del" style="height:32px;color:var(--red)">${I('trash')}</button><button class="chip on" data-lb="done" style="height:32px">Done</button>`;
    R.el.appendChild(bar);
  }
  function lassoAct(d) {
    const Lz = R.lasso; if (!Lz) return;
    if (d.lb === 'done') { clearLasso(); return; }
    if (d.lb === 'del') { const list = Lz.list; R.ink.strokes = R.ink.strokes.filter((s) => !list.includes(s)); push({ t: 'del', list }); const p = Lz.p; clearLasso(); drawInk(p); LU.toast('Deleted. Tap undo to bring them back.', { sys: false }); return; }
    const hl = d.lb === 'hl', ops = [];
    Lz.list.forEach((s) => { if ((s.t === 'hl') === hl && s.c !== d.c) { ops.push({ s, pg: Lz.p.n, before: { p: s.p.slice(), w: s.w, c: s.c }, after: { p: s.p.slice(), w: s.w, c: d.c } }); s.c = d.c; } });
    if (!ops.length) { LU.toast(hl ? 'No highlighter marks in the selection' : 'No pen marks in the selection', { sys: false, ms: 1500 }); return; }
    push({ t: 'xform', list: ops }); drawInk(Lz.p);
  }
  const pageByN = (n) => R.pages[n - 1];
  function goTo(n, rect, instant) {
    const p = pageByN(LU.clamp(n, 1, R.pages.length)); if (!p) return;
    let y = p.top - GAP;
    if (rect) y = p.top + rect[1] * p.ch - R.scroller.clientHeight * 0.3;
    R.scroller.scrollTo({ top: Math.max(0, y), behavior: instant ? 'auto' : 'smooth' });
    update();
    if (rect) flash(p, rect);
  }
  function flash(p, rect) {
    const f = document.createElement('div'); f.className = 'pflash';
    f.style.left = rect[0] * 100 + '%'; f.style.top = rect[1] * 100 + '%';
    f.style.width = (rect[2] - rect[0]) * 100 + '%'; f.style.height = (rect[3] - rect[1]) * 100 + '%';
    p.el.appendChild(f); setTimeout(() => f.remove(), 2600);
  }
  function onResize() {
    if (!R) return;
    const n = currentPage(), off = (R.scroller.scrollTop - R.pages[n - 1].top) / R.pages[n - 1].ch;
    layout(); R.scroller.scrollTop = R.pages[n - 1].top + off * R.pages[n - 1].ch; update();
  }

  /* ---------- zoom ---------- */
  function setZoom(z, cx, cy) {
    // cx, cy: point in scroller viewport coordinates that should stay fixed
    const old = R.zoom; z = LU.clamp(z, 1, MAXZ); if (Math.abs(z - old) < 0.001) return;
    const sx = R.scroller.scrollLeft + cx, sy = R.scroller.scrollTop + cy;
    const n = currentPage(), p = R.pages[n - 1];
    const relY = (sy - p.top) / p.ch;
    R.zoom = z; layout();
    const f = z / old;
    R.scroller.scrollLeft = (sx - GAP) * f + GAP - cx;
    R.scroller.scrollTop = p.top + relY * p.ch - cy;
    update();
  }

  /* ---------- tools ---------- */
  function setTool(t, quiet) {
    R.P.tool = t; LU.save(); if (R.selImg && t !== 'hand') selectImg(null); if (t !== 'lasso') clearLasso();
    LU.$$('.rt[data-tool]', R.el).forEach((b) => b.classList.toggle('on', b.dataset.tool === t));
    if (R.selMode && t !== 'hand') R.selMode = false;
    applyTA();
    R.el.dataset.tool = t;
    opts();
    if (!quiet) LU.sfx('tap');
  }
  function opts() {
    const o = LU.$('#rdOpts', R.el), P = R.P, t = P.tool;
    let h = '';
    if (t === 'pen' || t === 'line') {
      h = PEN.map((c, i) => `<button class="sw2 ${P.pen === i ? 'on' : ''}" data-pen="${i}" style="--c:${c}"></button>`).join('') + '<span class="rd-sep"></span>' +
        PEN_W.map((w, i) => `<button class="wd ${P.penW === i ? 'on' : ''}" data-penw="${i}"><i style="width:${4 + i * 4}px;height:${4 + i * 4}px"></i></button>`).join('');
    } else if (t === 'hl') {
      h = Object.keys(HL).map((k) => `<button class="sw2 ${P.hl === k ? 'on' : ''}" data-hl="${k}" style="--c:${HL[k]}"></button>`).join('') + '<span class="rd-sep"></span>' +
        HL_W.map((w, i) => `<button class="wd ${P.hlW === i ? 'on' : ''}" data-hlw="${i}"><i class="bar2" style="height:${4 + i * 4}px"></i></button>`).join('') +
        `<button class="chip ${P.straight ? 'on' : ''}" data-straight="1" style="height:32px;margin-left:4px">Straight</button>`;
    } else if (t === 'erase') h = `<span class="small muted">Drag over a mark to erase it</span>`;
    else if (t === 'lasso') h = `<span class="small muted">Draw a loop around your marks, then drag to move or pull the corner to resize</span>`;
    else if (t === 'note') h = `<button class="chip ${P.stk ? '' : 'on'}" data-stk="" style="height:32px">Note</button>` + STK.map((k) => `<button class="chip ${P.stk === k ? 'on' : ''}" data-stk="${k}" style="height:32px;padding:0 10px">${k}</button>`).join('') + `<span class="small muted" style="margin-left:4px">Tap the page</span>`;
    else if (R.selMode) h = `<span class="small muted">Drag over text to select. Two fingers to scroll.</span><button class="chip on" data-r="seldone" style="height:32px;margin-left:8px">Done</button>`;
    else h = `<span class="small muted">${P.penOnly ? 'Stylus mode: fingers scroll, the pen draws' : 'Two fingers to zoom. Pick a tool to mark.'}</span>`;
    o.innerHTML = h;
  }
  function onClick(e) {
    const b = e.target.closest('button'); if (!b || !R) return;
    const P = R.P;
    if (b.dataset.tool) { setTool(b.dataset.tool); return; }
    if (b.dataset.pen != null) { P.pen = +b.dataset.pen; if (P.tool !== 'line') P.tool = 'pen'; setTool(P.tool, true); return; }
    if (b.dataset.penw != null) { P.penW = +b.dataset.penw; opts(); LU.save(); return; }
    if (b.dataset.hl) { P.hl = b.dataset.hl; opts(); LU.save(); return; }
    if (b.dataset.hlw != null) { P.hlW = +b.dataset.hlw; opts(); LU.save(); return; }
    if (b.dataset.straight) { P.straight = !P.straight; opts(); LU.save(); return; }
    if (b.dataset.stk != null) { P.stk = b.dataset.stk; opts(); LU.save(); return; }
    if (b.dataset.note) { if (Date.now() - (R.nTouch || 0) < 600) return; noteSheet(b.dataset.note); return; }
    if (b.dataset.lb) { lassoAct(b.dataset); return; }
    if (b.dataset.imdel) { const bx = b.closest('.pimg'); if (bx) delImg(bx.dataset.im); return; }
    const r = b.dataset.r;
    if (r === 'close') closeReader();
    else if (r === 'undo') undo();
    else if (r === 'redo') redo();
    else if (r === 'mark') toggleMark();
    else if (r === 'goto') gotoSheet();
    else if (r === 'search') searchSheet();
    else if (r === 'menu') menu();
    else if (r === 'peek') R.el.classList.toggle('rd-hide');
    else if (r === 'rot') { const land = window.innerWidth > window.innerHeight; try { if (window.Android && Android.setOrientation) Android.setOrientation(land ? 'portrait' : 'landscape'); else LU.toast('Rotation works in the Android app.'); } catch (e) {} }
    else if (r === 'img') addImage();
    else if (r === 'seltext') { if (R.P.tool !== 'hand') setTool('hand', true); setSelMode(!R.selMode); if (R.selMode) LU.toast('Drag over the text you want. Two fingers to scroll.', { sys: false, ms: 2600 }); else clearSel(); }
    else if (r === 'seldone') { clearSel(); setSelMode(false); }
    else if (r === 'map') { if (LU.mapOpen) LU.mapOpen({ doc: R.id }); }
    else if (r === 'rec') { if (LU.recorderOpen) LU.recorderOpen(R); }
  }

  /* ---------- pointer input ---------- */
  const pts = new Map();
  let pan = null, tapStart = null;
  const pageAt = (x, y) => { const el = document.elementFromPoint(x, y); const pe = el && el.closest && el.closest('.pg'); return pe ? pageByN(+pe.dataset.n) : null; };
  const norm = (p, x, y) => { const r = p.el.getBoundingClientRect(); return [(x - r.left) / r.width, (y - r.top) / r.height]; };
  const inkTool = () => ['pen', 'hl', 'line', 'erase'].includes(R.P.tool);

  function onDown(e) {
    if (!R || e.target.closest('.pnote')) return;
    R.lastAct = Date.now();
    pts.set(e.pointerId, e);
    if (e.pointerType === 'pen' && !R.P.penOnly) { R.P.penOnly = true; LU.save(); setTool(R.P.tool === 'hand' ? 'pen' : R.P.tool, true); LU.toast('Stylus detected. Fingers now scroll, the pen draws. Change this in the ⋯ menu.', { ms: 3500 }); }
    if (pts.size > 1) { cancelLive(); pan = null; lpClear(); return; }
    if (R.selMode && e.pointerType !== 'pen') { if (R.sel) { R.sel = null; drawSel(); selBar(); } R.selDrag = { anchor: null, id: e.pointerId }; selBegin(e.clientX, e.clientY, true, e.pointerId); return; }
    if (R.sel && e.pointerType !== 'pen') { tapStart = { x: e.clientX, y: e.clientY, t: Date.now(), tool: 'selclear' }; lpStart(e); return; }
    if (e.pointerType !== 'pen' && (R.P.tool === 'hand' || (R.P.penOnly && e.pointerType === 'touch'))) lpStart(e);
    const fingerPan = e.pointerType === 'touch' && R.P.penOnly;
    const tool = R.P.tool === 'hand' && e.pointerType === 'pen' ? 'pen' : R.P.tool;
    if (fingerPan || (tool === 'hand' && R.scroller.style.touchAction === 'none')) { if (fingerPan) R.ftap = { x: e.clientX, y: e.clientY, t: Date.now(), id: e.pointerId }; startPan(e); return; }
    if (tool === 'hand' || tool === 'note') { tapStart = { x: e.clientX, y: e.clientY, t: Date.now(), tool }; return; }
    const p = pageAt(e.clientX, e.clientY); if (!p || !p.hl) return;
    e.preventDefault();
    try { R.scroller.setPointerCapture(e.pointerId); } catch (x) {}
    const [x, y] = norm(p, e.clientX, e.clientY);
    if (tool === 'lasso') { clearLasso(); R.live = { lasso: true, p, path: [[x, y]] }; liveCanvas(p, false); return; }
    if (tool === 'erase') { R.live = { erase: true, p, removed: [] }; eraseAt(p, x, y); return; }
    const P = R.P;
    const s = { id: 's' + LU.uid(), pg: p.n, t: tool, p: [x, y], at: Date.now() };
    if (tool === 'hl') { s.c = HL[P.hl]; s.w = HL_W[P.hlW]; s.st = P.straight; }
    else { s.c = PEN[P.pen]; s.w = PEN_W[P.penW]; }
    R.live = { s, p, x0: x, y0: y, t0: Date.now() };
    liveCanvas(p, tool === 'hl');
  }
  function onMove(e) {
    if (!R) return;
    if (pts.has(e.pointerId)) pts.set(e.pointerId, e);
    if (lp && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 10) lpClear();
    if (R.selDrag && (R.selDrag.id === e.pointerId || R.selDrag.handle)) { selMoveTo(e.clientX, e.clientY); return; }
    if (pan && pan.id === e.pointerId) { doPan(e); return; }
    const L = R.live; if (!L || pts.size > 1) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    if (L.erase) { evs.forEach((ev) => { const [x, y] = norm(L.p, ev.clientX, ev.clientY); eraseAt(L.p, x, y); }); return; }
    if (L.lasso) { evs.forEach((ev) => { const [x, y] = norm(L.p, ev.clientX, ev.clientY), q = L.path[L.path.length - 1]; if (Math.hypot(x - q[0], (y - q[1]) * (L.p.ch / L.p.cw)) > 0.004) L.path.push([x, y]); }); paintLasso(L); return; }
    const s = L.s;
    const straight = s.t === 'line' || (s.t === 'hl' && s.st);
    const last = evs[evs.length - 1];
    if (straight) {
      let [x, y] = norm(L.p, last.clientX, last.clientY);
      const dx = x - L.x0, dy = (y - L.y0) * (L.p.ch / L.p.cw);
      if (Math.abs(dy) < Math.abs(dx) * 0.14) y = L.y0;
      s.p = [L.x0, L.y0, x, y];
    } else {
      evs.forEach((ev) => {
        const [x, y] = norm(L.p, ev.clientX, ev.clientY), n = s.p.length;
        if (Math.hypot(x - s.p[n - 2], (y - s.p[n - 1]) * (L.p.ch / L.p.cw)) > 0.0016) s.p.push(+x.toFixed(4), +y.toFixed(4));
      });
    }
    paintLive();
  }
  function onUp(e) {
    if (!R) return;
    pts.delete(e.pointerId); lpClear();
    if (R.selDrag && (R.selDrag.id === e.pointerId || R.selDrag.handle)) { R.selDrag = null; if (R.sel) selBar(); return; }
    if (R.ftap && R.ftap.id === e.pointerId) {
      const ft = R.ftap; R.ftap = null;
      if (Math.hypot(e.clientX - ft.x, e.clientY - ft.y) < 10 && Date.now() - ft.t < 500 && !R.sel && !R.selMode) R.el.classList.toggle('rd-hide');
    }
    if (pan && pan.id === e.pointerId) { endPan(); return; }
    if (tapStart) {
      const ts = tapStart; tapStart = null;
      if (ts.tool === 'selclear') { if (Math.hypot(e.clientX - ts.x, e.clientY - ts.y) < 10 && Date.now() - ts.t < 500) clearSel(); return; }
      if (Math.hypot(e.clientX - ts.x, e.clientY - ts.y) < 10 && Date.now() - ts.t < 500) {
        if (R.selImg) { selectImg(null); return; }
        if (ts.tool === 'note') { const p = pageAt(e.clientX, e.clientY); if (p) { const [x, y] = norm(p, e.clientX, e.clientY); if (R.P.stk) stampAt(p, x, y, R.P.stk); else noteSheet(null, p.n, x, y); } }
        else { const pp = pageAt(e.clientX, e.clientY); if (pp && LU.recTapMark && LU.recTapMark(pp.n, ...norm(pp, e.clientX, e.clientY))) return; R.el.classList.toggle('rd-hide'); }
      }
      return;
    }
    const L = R.live; if (!L) return;
    R.live = null;
    if (L.erase) { if (L.removed.length) push({ t: 'del', list: L.removed }); return; }
    if (L.lasso) { clearLive(L.p); finishLasso(L); return; }
    clearLive(L.p);
    const s = L.s;
    if (s.p.length < 4) { if (s.t === 'line' || s.st) return; s.p.push(s.p[0] + 0.0005, s.p[1]); }
    if ((s.t === 'line' || s.st) && Math.hypot(s.p[2] - s.p[0], s.p[3] - s.p[1]) < 0.006) return;
    s.p = s.p.map((v) => +(+v).toFixed(4));
    { const rt = LU.recStamp && LU.recStamp(R.id); if (rt) s.rt = rt; }
    R.ink.strokes.push(s);
    LU.drawStroke((s.t === 'hl' ? L.p.hl : L.p.ink).getContext('2d'), s, L.p.hl.width, L.p.hl.height);
    push({ t: 'add', s });
  }
  function onCancel(e) { pts.delete(e.pointerId); lpClear(); if (R && R.selDrag && R.selDrag.id === e.pointerId) { R.selDrag = null; if (R.sel) selBar(); } if (pan && pan.id === e.pointerId) pan = null; cancelLive(); tapStart = null; }
  function cancelLive() { if (R && R.live) { if (!R.live.erase) clearLive(R.live.p); else if (R.live.removed.length) push({ t: 'del', list: R.live.removed }); R.live = null; } }

  function liveCanvas(p, hl) {
    if (!p.live) { p.live = mk(p, 'livec'); }
    p.live.width = p.hl.width; p.live.height = p.hl.height;
    p.live.style.mixBlendMode = hl ? 'multiply' : 'normal';
  }
  function paintLive() {
    const L = R.live, c = L.p.live; if (!c) return;
    const ctx = c.getContext('2d'); ctx.clearRect(0, 0, c.width, c.height);
    LU.drawStroke(ctx, L.s, c.width, c.height);
  }
  function clearLive(p) { if (p && p.live) { p.live.remove(); p.live = null; } }

  function eraseAt(p, x, y) {
    const W = p.cw, H = p.ch, r = 14;
    const px = x * W, py = y * H;
    const keep = [];
    let hit = false;
    R.ink.strokes.forEach((s) => {
      if (s.pg !== p.n) { keep.push(s); return; }
      const b = bbox(s);
      if (px < b[0] * W - r || px > b[2] * W + r || py < b[1] * H - r || py > b[3] * H + r) { keep.push(s); return; }
      const lim = r + (s.w * W) / 2;
      for (let i = 0; i < s.p.length - 2 || i === 0; i += 2) {
        const ax = s.p[i] * W, ay = s.p[i + 1] * H, bx = (s.p[i + 2] != null ? s.p[i + 2] : s.p[i]) * W, by = (s.p[i + 3] != null ? s.p[i + 3] : s.p[i + 1]) * H;
        const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
        const t = l2 ? LU.clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
        if (Math.hypot(px - (ax + t * dx), py - (ay + t * dy)) <= lim) { hit = true; R.live.removed.push(s); return; }
        if (s.p.length <= 2) break;
      }
      keep.push(s);
    });
    if (hit) { R.ink.strokes = keep; drawInk(p); LU.vibrate(8); }
  }

  /* one-finger pan (stylus mode) with momentum */
  function startPan(e) { pan = { id: e.pointerId, x: e.clientX, y: e.clientY, vx: 0, vy: 0, t: performance.now() }; cancelAnimationFrame(pan.raf); }
  function doPan(e) {
    const now = performance.now(), dt = Math.max(1, now - pan.t);
    const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
    R.scroller.scrollLeft -= dx; R.scroller.scrollTop -= dy;
    pan.vx = (dx / dt) * 16; pan.vy = (dy / dt) * 16; pan.x = e.clientX; pan.y = e.clientY; pan.t = now;
  }
  function endPan() {
    let { vx, vy } = pan; pan = null;
    const step = () => {
      if (!R || (Math.abs(vx) < 0.4 && Math.abs(vy) < 0.4)) return;
      R.scroller.scrollLeft -= vx; R.scroller.scrollTop -= vy; vx *= 0.94; vy *= 0.94; requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* two-finger pinch zoom + pan (all tools) */
  let pinch = null;
  const tdist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const tmid = (t) => [(t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2];
  function onTouchStart(e) {
    if (!R) return;
    if (e.touches.length === 2) {
      cancelLive(); pan = null; tapStart = null; lpClear(); R.selDrag = null;
      const r = R.scroller.getBoundingClientRect(), [mx, my] = tmid(e.touches);
      pinch = { d0: tdist(e.touches), m: [mx, my], z0: R.zoom, s: 1, ox: R.scroller.scrollLeft + mx - r.left, oy: R.scroller.scrollTop + my - r.top, r };
      R.pagesEl.style.transformOrigin = `${pinch.ox}px ${pinch.oy}px`;
      e.preventDefault();
    }
  }
  function onTouchMove(e) {
    if (!R) return;
    if (pinch && e.touches.length >= 2) {
      e.preventDefault();
      const [mx, my] = tmid(e.touches);
      R.scroller.scrollLeft -= mx - pinch.m[0]; R.scroller.scrollTop -= my - pinch.m[1];
      pinch.m = [mx, my];
      const z = LU.clamp((pinch.z0 * tdist(e.touches)) / pinch.d0, 1, MAXZ);
      pinch.s = z / pinch.z0;
      R.pagesEl.style.transform = `scale(${pinch.s})`;
    } else if ((R.selDrag || R.scroller.style.touchAction === 'none') && e.cancelable) e.preventDefault();
  }
  function onTouchEnd(e) {
    if (!R || !pinch || e.touches.length >= 2) return;
    const pc = pinch; pinch = null;
    R.pagesEl.style.transform = ''; R.pagesEl.style.transformOrigin = '';
    if (Math.abs(pc.s - 1) > 0.01) setZoom(pc.z0 * pc.s, pc.m[0] - pc.r.left, pc.m[1] - pc.r.top);
  }

  /* ---------- undo / redo ---------- */
  function push(op) { R.undo.push(op); if (R.undo.length > 200) R.undo.shift(); R.redo = []; LU.saveInk(R.id); }
  const pagesOf = (op) => new Set(op.im ? [op.im.pg] : op.s ? [op.s.pg] : op.list ? op.list.map((x) => x.pg || (x.s && x.s.pg)) : op.n ? [op.n.pg] : []);
  function apply(op, rev) {
    const st = R.ink.strokes, nt = R.ink.notes;
    const add = (s) => st.push(s), del = (s) => { const i = st.indexOf(s); if (i >= 0) st.splice(i, 1); };
    if (op.t === 'add') rev ? del(op.s) : add(op.s);
    else if (op.t === 'del') op.list.forEach((s) => (rev ? add(s) : del(s)));
    else if (op.t === 'note+') { if (rev) nt.splice(nt.indexOf(op.n), 1); else nt.push(op.n); }
    else if (op.t === 'note-') { if (rev) nt.push(op.n); else nt.splice(nt.indexOf(op.n), 1); }
    else if (op.t === 'note~') op.n.text = rev ? op.before : op.after;
    else if (op.t === 'note^') Object.assign(op.n, rev ? op.before : op.after);
    else if (op.t === 'xform') op.list.forEach((z) => { const g = rev ? z.before : z.after; z.s.p = g.p.slice(); z.s.w = g.w; z.s.c = g.c; });
    else if (op.t === 'img+') { const L = R.ink.imgs; if (rev) { const i = L.indexOf(op.im); if (i >= 0) L.splice(i, 1); if (R.selImg === op.im.id) R.selImg = null; } else L.push(op.im); }
    else if (op.t === 'img-') { const L = R.ink.imgs; if (rev) L.push(op.im); else { const i = L.indexOf(op.im); if (i >= 0) L.splice(i, 1); if (R.selImg === op.im.id) R.selImg = null; } }
    else if (op.t === 'img~') { const g = rev ? op.before : op.after; op.im.x = g.x; op.im.y = g.y; op.im.w = g.w; }
    pagesOf(op).forEach((n) => drawInk(pageByN(n)));
    LU.saveInk(R.id);
  }
  function undo() { clearLasso(); const op = R.undo.pop(); if (!op) { LU.toast('Nothing to undo', { sys: false, ms: 1200 }); return; } apply(op, true); R.redo.push(op); LU.sfx('undo'); }
  function redo() { clearLasso(); const op = R.redo.pop(); if (!op) return; apply(op, false); R.undo.push(op); LU.sfx('tap'); }

  /* ---------- images placed on a page (own layer, saved with the marks) ---------- */
  const imgUrl = (im) => { let u = R.urls.get(im.id); if (!u) { u = URL.createObjectURL(im.blob); R.urls.set(im.id, u); } return u; };
  const placeImg = (b, im) => { b.style.left = im.x * 100 + '%'; b.style.top = im.y * 100 + '%'; b.style.width = im.w * 100 + '%'; b.style.aspectRatio = String(1 / im.ar); };
  function drawImgs(p) {
    p.el.querySelectorAll('.pimg').forEach((x) => x.remove());
    (R.ink.imgs || []).filter((i) => i.pg === p.n).forEach((im) => {
      const b = document.createElement('div'); b.className = 'pimg' + (R.selImg === im.id ? ' sel' : ''); b.dataset.im = im.id;
      b.innerHTML = `<img src="${imgUrl(im)}" alt="" draggable="false"><i class="ph" data-h="1"></i><button class="pidel" data-imdel="1" aria-label="Delete image">${I('x')}</button>`;
      const el = b.querySelector('img');
      el.onerror = () => { /* blob link refused: use the picture's own bytes instead */
        const fr = new FileReader(); fr.onload = () => { el.onerror = null; el.src = fr.result; }; fr.readAsDataURL(im.blob);
      };
      placeImg(b, im); p.el.appendChild(b);
    });
  }
  const findImg = (id) => (R.ink.imgs || []).find((i) => i.id === id);
  function selectImg(id) {
    R.selImg = id;
    R.pagesEl.querySelectorAll('.pimg').forEach((b) => b.classList.toggle('sel', b.dataset.im === id));
    if (id) R.pagesEl.classList.add('imgsel'); else R.pagesEl.classList.remove('imgsel');
  }
  function delImg(id) {
    const im = findImg(id); if (!im) return;
    R.ink.imgs.splice(R.ink.imgs.indexOf(im), 1); R.selImg = null; R.pagesEl.classList.remove('imgsel');
    push({ t: 'img-', im }); drawImgs(pageByN(im.pg)); LU.toast('Image removed. Tap undo to bring it back.', { sys: false });
  }
  async function addImage() {
    const r = R;
    const files = await LU.img.pick({});
    if (!files.length || R !== r) return;
    try {
      LU.toast('Adding image…', { sys: false, ms: 1200 });
      const cv = await LU.img.load(files[0], 1600), blob = await LU.img.toBlob(cv, 0.85);
      if (R !== r) return;
      const n = currentPage(), p = pageByN(n);
      const im = { id: 'i' + LU.uid(), pg: n, x: 0.25, y: 0.25, w: 0.5, ar: cv.height / cv.width, blob, at: Date.now() };
      let hh = im.w * im.ar * p.cw / p.ch; if (hh > 0.8) { im.w = Math.max(0.1, im.w * (0.8 / hh)); hh = im.w * im.ar * p.cw / p.ch; }
      im.x = LU.clamp(0.5 - im.w / 2, 0, 1 - im.w); im.y = LU.clamp(0.5 - hh / 2, 0, Math.max(0, 1 - hh));
      r.ink.imgs.push(im); push({ t: 'img+', im });
      if (R.P.tool !== 'hand') setTool('hand', true);
      drawImgs(p); selectImg(im.id);
      LU.toast('Drag to move, pull the corner to resize', { sys: false, ms: 2600 });
    } catch (e) { LU.toast(e.message || 'Could not add that image.', { ms: 3500 }); }
  }
  let imd = null;
  function imgDown(e) {
    if (!R) return;
    const b = e.target.closest && e.target.closest('.pimg'); if (!b) return;
    if (e.target.closest('[data-imdel]')) { e.stopPropagation(); return; }
    const im = findImg(b.dataset.im); if (!im) return;
    if (R.selImg !== im.id) {
      if (R.P.penOnly && e.pointerType === 'touch') return; // finger scrolls in stylus mode
      e.stopPropagation();
      imd = { tap: im.id, x0: e.clientX, y0: e.clientY, pid: e.pointerId };
      return;
    }
    e.stopPropagation(); e.preventDefault();
    const p = pageByN(im.pg), rect = p.el.getBoundingClientRect();
    imd = { id: im.id, im, mode: e.target.dataset.h ? 'size' : 'move', x0: e.clientX, y0: e.clientY, g0: { x: im.x, y: im.y, w: im.w }, rect, b, pid: e.pointerId, moved: false };
    try { b.setPointerCapture(e.pointerId); } catch (x) {}
  }
  function imgMove(e) {
    if (!R || !imd || imd.pid !== e.pointerId || !imd.im) return;
    const { im, rect, g0, b } = imd;
    const dx = (e.clientX - imd.x0) / rect.width, dy = (e.clientY - imd.y0) / rect.height;
    if (Math.abs(dx) + Math.abs(dy) > 0.002) imd.moved = true;
    const k = (im.ar * rect.width) / rect.height; // page-height fraction per unit of width fraction
    if (imd.mode === 'move') {
      const hh = im.w * k;
      im.x = LU.clamp(g0.x + dx, 0, Math.max(0, 1 - im.w)); im.y = LU.clamp(g0.y + dy, 0, Math.max(0, 1 - hh));
    } else {
      const maxW = Math.min(1 - im.x, (1 - im.y) / k);
      im.w = LU.clamp(g0.w + Math.max(dx, dy / k), 0.06, Math.max(0.06, maxW));
    }
    placeImg(b, im);
  }
  function imgUp(e) {
    if (!R || !imd || imd.pid !== e.pointerId) return;
    const d = imd; imd = null;
    if (d.tap) {
      if (e.type === 'pointerup' && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 10) selectImg(d.tap);
      return;
    }
    if (d.moved) push({ t: 'img~', im: d.im, before: d.g0, after: { x: d.im.x, y: d.im.y, w: d.im.w } });
  }

  /* ---------- sticky notes ---------- */
  function noteSheet(id, pg, x, y) {
    const n = id ? R.ink.notes.find((v) => v.id === id) : null;
    LU.sheet({
      title: n ? `Note on page ${n.pg}` : `New note on page ${pg}`,
      body: `<div class="field"><textarea class="inp" id="ntv" rows="5" placeholder="e.g. Art 21 expanded via Maneka Gandhi case">${n ? esc(n.text) : ''}</textarea></div>`,
      foot: `${n ? `<button class="btn danger" id="ntDel">${I('trash')}</button>` : ''}<button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn" id="ntOk">Save</button>`,
      mount: (s) => {
        const t = LU.$('#ntv', s); if (!n) setTimeout(() => LU.focusField(t), 280);
        LU.$('#ntOk', s).onclick = () => {
          const v = t.value.trim(); LU.closeSheet(); if (!v) return;
          if (n) { if (v !== n.text) { const op = { t: 'note~', n, before: n.text, after: v }; n.text = v; push(op); drawNotes(pageByN(n.pg)); } }
          else { const nn = { id: 'n' + LU.uid(), pg, x: LU.clamp(x, 0.02, 0.94), y: LU.clamp(y, 0.01, 0.97), text: v, at: Date.now() }; { const rt = LU.recStamp && LU.recStamp(R.id); if (rt) nn.rt = rt; } R.ink.notes.push(nn); push({ t: 'note+', n: nn }); drawNotes(pageByN(pg)); LU.sfx('done'); }
        };
        const d = LU.$('#ntDel', s);
        if (d) d.onclick = () => { LU.closeSheet(); R.ink.notes.splice(R.ink.notes.indexOf(n), 1); push({ t: 'note-', n }); drawNotes(pageByN(n.pg)); };
      },
    });
  }

  /* ---------- bookmarks, go to page ---------- */
  function updateMark() { const b = LU.$('#rdMark', R.el); if (b && R.ink) b.classList.toggle('on', R.ink.marks.includes(currentPage())); }
  function toggleMark() {
    const n = currentPage(), m = R.ink.marks, i = m.indexOf(n);
    if (i >= 0) m.splice(i, 1); else { m.push(n); m.sort((a, b) => a - b); }
    LU.saveInk(R.id); updateMark(); LU.sfx('tap'); LU.toast(i >= 0 ? `Bookmark removed from page ${n}` : `Page ${n} bookmarked`, { sys: false, ms: 1400 });
  }
  function gotoSheet() {
    const m = R.ink.marks;
    LU.sheet({
      title: 'Go to page',
      body: `<div class="row" style="gap:8px"><input class="inp" type="number" id="gpv" min="1" max="${R.pages.length}" placeholder="Page 1 to ${R.pages.length}" inputmode="numeric"><button class="btn" id="gpOk">Go</button></div>
        <div class="sec-title">Bookmarks <span class="muted">${m.length}</span></div>
        ${m.length ? `<div class="list">${m.map((n) => `<div class="li" data-gp="${n}"><span class="lic">${I('bookmark')}</span><div class="grow lt">Page ${n}</div></div>`).join('')}</div>` : '<p class="small muted">Tap the bookmark icon at the top to save a page here.</p>'}`,
      mount: (s) => {
        const go = (n) => { LU.closeSheet(); goTo(n); };
        LU.$('#gpOk', s).onclick = () => { const v = +LU.$('#gpv', s).value; if (v) go(v); };
        LU.$('#gpv', s).onkeydown = (e) => { if (e.key === 'Enter') LU.$('#gpOk', s).click(); };
        LU.$$('[data-gp]', s).forEach((x) => (x.onclick = () => go(+x.dataset.gp)));
      },
    });
  }


  /* ---------- select and copy text (long-press, or the Select button) ---------- */
  /* Words come from the PDF's own text layer; scanned pages have none (use "Ask AI about this page" for those). */
  async function pageWords(r, n) {
    r.words = r.words || {};
    if (r.words[n]) return r.words[n];
    const t = await pageText(r, n), out = [];
    t.items.forEach((it) => {
      const [x0, y0, x1, y1] = it.r, str = it.s, L = str.length || 1;
      if (!str.trim()) return;
      const re = /\S+/g; let m;
      while ((m = re.exec(str))) {
        const a = m.index / L, b = (m.index + m[0].length) / L;
        out.push({ s: m[0], r: [x0 + (x1 - x0) * a, y0, x0 + (x1 - x0) * b, y1], sp: m.index + m[0].length < L });
      }
    });
    return (r.words[n] = out);
  }
  const wcmp = (a, b) => (a.n - b.n) || (a.i - b.i);
  function hitWord(r, p, x, y) {
    const W = r.words && r.words[p.n]; if (!W || !W.length) return -1;
    let best = -1, bd = 1e9;
    for (let i = 0; i < W.length; i++) {
      const [x0, y0, x1, y1] = W[i].r, h = y1 - y0;
      const dy = y < y0 ? y0 - y : y > y1 ? y - y1 : 0;
      if (dy > h * 1.6) continue;
      const dx = x < x0 ? x0 - x : x > x1 ? x - x1 : 0;
      const d = dx * 0.6 + dy * 2.2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  function selText() {
    const S = R && R.sel; if (!S) return '';
    let a = S.a, b = S.b; if (wcmp(a, b) > 0) [a, b] = [b, a];
    let out = '', prev = null;
    for (let n = a.n; n <= b.n; n++) {
      const W = R.words && R.words[n]; if (!W) continue;
      const from = n === a.n ? a.i : 0, to = n === b.n ? b.i : W.length - 1;
      if (prev && n !== prev.n) out += '\n\n';
      for (let i = from; i <= to; i++) {
        const w = W[i];
        if (prev && prev.n === n) {
          const ph = prev.r[3] - prev.r[1], dy = w.r[1] - prev.r[1];
          out += dy > ph * 1.8 ? '\n' : dy > ph * 0.55 ? ' ' : ' ';
        }
        out += w.s; prev = { n, r: w.r };
      }
    }
    return out.trim();
  }
  function drawSel() {
    if (!R) return;
    R.pagesEl.querySelectorAll('.selov,.selh').forEach((x) => x.remove());
    const S = R.sel; if (!S) return;
    let a = S.a, b = S.b; if (wcmp(a, b) > 0) [a, b] = [b, a];
    let first = null, last = null;
    for (let n = a.n; n <= b.n; n++) {
      const W = R.words && R.words[n], p = pageByN(n); if (!W || !p) continue;
      const from = n === a.n ? a.i : 0, to = n === b.n ? b.i : W.length - 1;
      const ov = document.createElement('div'); ov.className = 'selov';
      let cur = null;
      for (let i = from; i <= to; i++) {
        const r = W[i].r;
        if (cur && Math.abs(r[1] - cur[1]) < (cur[3] - cur[1]) * 0.5 && r[0] - cur[2] < 0.04) { cur[2] = Math.max(cur[2], r[2]); cur[3] = Math.max(cur[3], r[3]); }
        else { if (cur) box(ov, cur); cur = r.slice(); }
      }
      if (cur) box(ov, cur);
      p.el.appendChild(ov);
      if (n === a.n) first = { p, r: W[from].r };
      if (n === b.n) last = { p, r: W[to].r };
    }
    const handle = (o, which, x, y) => {
      const h = document.createElement('div'); h.className = 'selh'; h.dataset.which = which;
      h.style.left = x * 100 + '%'; h.style.top = y * 100 + '%';
      h.addEventListener('pointerdown', (e) => {
        e.stopPropagation(); e.preventDefault(); R.selDrag = { handle: which, id: e.pointerId };
        try { h.setPointerCapture(e.pointerId); } catch (x2) {}
      });
      o.p.el.appendChild(h);
    };
    if (first) handle(first, 'a', first.r[0], first.r[3]);
    if (last) handle(last, 'b', last.r[2], last.r[3]);
    function box(ov, r) { const d = document.createElement('i'); d.style.cssText = `left:${r[0] * 100}%;top:${r[1] * 100}%;width:${(r[2] - r[0]) * 100}%;height:${(r[3] - r[1]) * 100}%`; ov.appendChild(d); }
  }
  function selBar() {
    let bar = LU.$('.selbar', R.el);
    if (!R.sel) { if (bar) bar.remove(); return; }
    if (!bar) {
      bar = document.createElement('div'); bar.className = 'selbar';
      bar.innerHTML = `<button data-sb="copy">${I('copy')}<span>Copy</span></button><button data-sb="ai">${I('star')}<span>Ask AI</span></button><button data-sb="ref">${I('book')}<span>Books</span></button><button data-sb="page"><span>Whole page</span></button><button data-sb="x" aria-label="Close">${I('x')}</button>`;
      bar.addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return; e.stopPropagation();
        const k = b.dataset.sb, t = selText();
        if (k === 'copy') LU.copyText(t).then((ok) => { LU.toast(ok ? 'Copied ' + t.split(/\s+/).filter(Boolean).length + ' words' : 'Could not copy', { sys: false, ms: 1600 }); if (ok) clearSel(); });
        else if (k === 'ai') {
          if (!LU.aiKey()) { LU.toast('Add your free Gemini key first: More › AI helper.', { ms: 3500 }); return; }
          const label = R.d.name.slice(0, 24) + ' p' + Math.min(R.sel.a.n, R.sel.b.n);
          const apg = Math.min(R.sel.a.n, R.sel.b.n); LU.aiTextTools({ label, text: t, onNote: (txt) => addAiNote(apg, txt) });
        }
        else if (k === 'ref') { const apg = Math.min(R.sel.a.n, R.sel.b.n); LU.refLook(t, (txt) => addAiNote(apg, txt)); }
        else if (k === 'page') selectPage(currentPage());
        else if (k === 'x') { clearSel(); setSelMode(false); }
      });
      R.el.appendChild(bar);
    }
  }
  function clearSel() { if (!R) return; R.sel = null; R.selDrag = null; drawSel(); selBar(); }
  async function selectPage(n) {
    const W = await pageWords(R, n);
    if (!W.length) { noText(); return; }
    R.sel = { a: { n, i: 0 }, b: { n, i: W.length - 1 } }; drawSel(); selBar();
  }
  const noText = () => LU.toast('This page is a picture, so there is no text to copy. Use ⋯ › Ask AI about this page to read it.', { ms: 4200 });
  function setSelMode(on) {
    R.selMode = !!on; if (!on) { R.selDrag = null; }
    applyTA();
    opts();
    R.el.classList.toggle('selmode', !!on);
  }
  function applyTA() { R.scroller.style.touchAction = R.selMode ? 'none' : (R.P.tool === 'hand' && !R.P.penOnly ? 'pan-x pan-y' : 'none'); }
  /* start (or extend) a selection at a screen point; returns false when there is no text there */
  async function selBegin(x, y, quiet, pid) {
    const r = R, p = pageAt(x, y); if (!p) return false;
    const W = await pageWords(r, p.n); if (R !== r) return false;
    const [nx, ny] = norm(p, x, y), i = hitWord(r, p, nx, ny);
    if (i < 0) { if (!W.length && !quiet) noText(); return false; }
    r.sel = { a: { n: p.n, i }, b: { n: p.n, i } }; r.selDrag = pid != null && pts.has(pid) ? { anchor: { n: p.n, i }, id: pid } : null;
    LU.vibrate(15); drawSel(); if (!r.selDrag) selBar(); return true;
  }
  function selMoveTo(x, y) {
    const r = R, S = r.sel, D = r.selDrag; if (!D) return;
    if (S && !D.handle && !D.anchor) D.anchor = S.a;
    const sc = r.scroller.getBoundingClientRect();
    if (y < sc.top + 56) r.scroller.scrollTop -= 14; else if (y > sc.bottom - 56) r.scroller.scrollTop += 14;
    const p = pageAt(x, y); if (!p) return;
    if (!r.words || !r.words[p.n]) { pageWords(r, p.n).then(() => { if (R === r && r.selDrag) selMoveTo(x, y); }); return; }
    const [nx, ny] = norm(p, x, y), i = hitWord(r, p, nx, ny); if (i < 0) return;
    const cur = { n: p.n, i };
    if (!S) { r.sel = { a: cur, b: cur }; D.anchor = cur; drawSel(); return; }
    if (D.handle) {
      const other = D.handle === 'a' ? S.b : S.a;
      S.a = D.handle === 'a' ? cur : other; S.b = D.handle === 'a' ? other : cur;
      if (wcmp(S.a, S.b) > 0) { const t = S.a; S.a = S.b; S.b = t; D.handle = D.handle === 'a' ? 'b' : 'a'; }
    } else if (D.anchor) { S.a = D.anchor; S.b = cur; if (wcmp(S.a, S.b) > 0) { const t = S.a; S.a = S.b; S.b = t; } }
    drawSel();
  }
  let lp = null;
  const lpClear = () => { if (lp) { clearTimeout(lp.t); lp = null; } };
  const lpStart = (e) => {
    lpClear();
    if (e.pointerType === 'pen' || e.target.closest('.pnote,.pimg,.selh,.selbar')) return;
    const x = e.clientX, y = e.clientY;
    lp = { x, y, t: setTimeout(async () => {
      lp = null; tapStart = null;
      const ok = await selBegin(x, y, false, e.pointerId);
      if (ok && R && pan) pan = null;
    }, 480) };
  };

  /* ---------- search ---------- */
  async function pageText(r, n) {
    r.text = r.text || {};
    if (r.text[n]) return r.text[n];
    const pg = await r.pdf.getPage(n), tc = await pg.getTextContent(), vp = pg.getViewport({ scale: 1 });
    const items = tc.items.filter((x) => x.str).map((x) => {
      const t = x.transform, fh = Math.hypot(t[2], t[3]) || 10;
      const a = vp.convertToViewportPoint(t[4], t[5] - fh * 0.2), b = vp.convertToViewportPoint(t[4] + x.width, t[5] + fh * 0.9), rc = [a[0], a[1], b[0], b[1]];
      return { s: x.str, r: [Math.min(rc[0], rc[2]) / vp.width, Math.min(rc[1], rc[3]) / vp.height, Math.max(rc[0], rc[2]) / vp.width, Math.max(rc[1], rc[3]) / vp.height] };
    });
    return (r.text[n] = { items, all: items.map((x) => x.s).join(' ') });
  }
  function searchSheet() {
    const r = R; let token = 0;
    const sh = LU.sheet({
      title: 'Search in this PDF',
      body: `<div class="search" style="margin-top:0">${I('search')}<input id="rsq" placeholder="Word or phrase" enterkeyhint="search" value="${esc(r.lastQ || '')}"></div><div id="rsRes"></div>`,
      mount: (s) => { const q = LU.$('#rsq', s); setTimeout(() => LU.focusField(q), 280); q.onkeydown = (e) => { if (e.key === 'Enter') run(q.value); }; if (r.lastQ) run(r.lastQ); },
    });
    async function run(q) {
      q = q.trim(); if (q.length < 2) return; r.lastQ = q;
      const my = ++token, box = LU.$('#rsRes', sh), ql = q.toLowerCase(), res = [];
      let textless = 0;
      for (let n = 1; n <= r.pages.length; n++) {
        if (my !== token || !LU.$('#rsRes')) return;
        if (n % 5 === 1) box.innerHTML = `<p class="small muted">Searching page ${n} of ${r.pages.length}…</p>`;
        let t; try { t = await pageText(r, n); } catch (e) { t = { items: [], all: '' }; }
        if (!t.items.length) textless++;
        const low = t.all.toLowerCase(); let i = low.indexOf(ql);
        while (i >= 0 && res.length < 150) {
          const snip = t.all.slice(Math.max(0, i - 40), i + q.length + 50);
          const it = t.items.find((x) => x.s.toLowerCase().includes(ql.split(' ')[0]));
          res.push({ n, snip, rect: it && it.r, off: i < 40 ? i : 40 });
          i = low.indexOf(ql, i + ql.length);
          if (res.filter((x) => x.n === n).length >= 5) break;
        }
      }
      if (my !== token) return;
      if (!res.length) { box.innerHTML = `<div class="empty">${I('search')}${textless > r.pages.length * 0.8 ? 'This PDF is made of scanned images, so it has no searchable text.' : `No results for “${esc(q)}”.`}</div>`; return; }
      box.innerHTML = `<p class="small muted">${res.length}${res.length >= 150 ? '+' : ''} results</p>` + res.map((x, k) => {
        const a = x.snip.slice(0, x.off), b = x.snip.slice(x.off, x.off + q.length), c = x.snip.slice(x.off + q.length);
        return `<div class="hit" data-k="${k}"><span class="pill dim">p ${x.n}</span><div class="grow small">…${esc(a)}<mark>${esc(b)}</mark>${esc(c)}…</div></div>`;
      }).join('');
      LU.$$('[data-k]', box).forEach((el) => (el.onclick = () => { const x = res[+el.dataset.k]; LU.closeSheet(); goTo(x.n, x.rect ? [x.rect[0] - 0.01, x.rect[1] - 0.004, x.rect[2] + 0.01, x.rect[3] + 0.004] : null); }));
    }
  }

  /* ---------- menu ---------- */
  function menu() {
    const r = R, P = r.P, d = r.d;
    LU.sheet({
      title: d.name,
      body: `<div class="list">
        <div class="li" id="mRev"><span class="lic">${I('loop')}</span><div class="grow"><div class="lt">Revision for this PDF</div><div class="ls">${r.ink.strokes.length} marks, ${r.ink.notes.length} notes</div></div></div>
        <div class="li" id="mAI"><span class="lic">${I('star')}</span><div class="grow"><div class="lt">Ask AI about this page</div><div class="ls">Explain, summary, MCQs, flashcards (needs Gemini key)</div></div></div>
        <div class="li" id="mFin"><span class="lic">${I('check')}</span><div class="grow"><div class="lt">${r.d.fin ? 'Not finished (back to reading)' : 'Mark as finished'}</div><div class="ls">Shows a green tick on this PDF in Notes</div></div></div>
        <div class="li" id="mImp"><span class="lic">${I('star')}</span><div class="grow"><div class="lt">Collect from this PDF</div><div class="ls">Important points and MCQs, with AI answers</div></div></div>
        <div class="li" id="mSel"><span class="lic">${I('copy')}</span><div class="grow"><div class="lt">Select and copy text</div><div class="ls">Or long-press any word on the page</div></div></div>
        <div class="li" id="mPages"><span class="lic">${I('filepage')}</span><div class="grow"><div class="lt">Pages</div><div class="ls">Thumbnails: jump, move, duplicate or delete pages</div></div></div>
        <div class="li" id="mOutline"><span class="lic">${I('list')}</span><div class="grow"><div class="lt">Contents</div><div class="ls">Chapters of this PDF, if it has them</div></div></div>
        <div class="li" id="mDark"><span class="lic">${I('moon')}</span><div class="grow"><div class="lt">Dark pages</div><div class="ls">Invert the page colours for night reading</div></div><span class="switch ${P.dark ? 'on' : ''}"></span></div>
        <div class="li" id="mFit"><span class="lic">${I('expand')}</span><div class="grow lt">Fit page width</div></div>
        <div class="li" id="mPen"><span class="lic">${I('pen')}</span><div class="grow"><div class="lt">Stylus mode</div><div class="ls">Fingers scroll, only the stylus draws</div></div><span class="switch ${P.penOnly ? 'on' : ''}"></span></div>
        <div class="li" id="mAddPg"><span class="lic">${I('filepage')}</span><div class="grow"><div class="lt">Add a page</div><div class="ls">Photo, scan, gallery image or blank page</div></div></div>
        ${LU.canUndoAddPage && LU.canUndoAddPage(d) ? `<div class="li" id="mUndoPg"><span class="lic">${I('undo')}</span><div class="grow"><div class="lt">Undo last added page</div><div class="ls">${LU.canUndoAddPage(d)}</div></div></div>` : ''}
        <div class="li" id="mTopic"><span class="lic">${I('flag')}</span><div class="grow"><div class="lt">Subject and topic</div><div class="ls">${esc(LU.docLabel(d))}</div></div></div>
        <div class="li" id="mExp"><span class="lic">${I('save')}</span><div class="grow"><div class="lt">Save a copy with my marks</div><div class="ls">PDF in Download/LevelUp</div></div></div>
        <div class="li" id="mClear"><span class="lic" style="color:var(--red);background:rgba(255,93,122,.12)">${I('trash')}</span><div class="grow lt">Erase all marks on this page</div></div>
      </div>`,
      mount: (s) => {
        LU.$('#mRev', s).onclick = () => { LU.closeSheet(true); const id = r.id; closeReader(true); LU.openRevision({ scope: 'doc', id }); };
        LU.$('#mAI', s).onclick = () => { LU.closeSheet(true); LU.aiPage(r.id, currentPage()); };
        LU.$('#mFin', s).onclick = () => { LU.closeSheet(true); LU.markFinished(r.id); };
        LU.$('#mImp', s).onclick = () => { LU.closeSheet(true); LU.collectAll(r.id); };
        LU.$('#mSel', s).onclick = () => { LU.closeSheet(true); if (R.P.tool !== 'hand') setTool('hand', true); setSelMode(true); LU.toast('Drag over the text you want. Two fingers to scroll.', { sys: false, ms: 2600 }); };
        LU.$('#mFit', s).onclick = () => { LU.closeSheet(); setZoom(1, 0, 0); };
        LU.$('#mPages', s).onclick = () => { LU.closeSheet(true); LU.pagesSheet(r.id, currentPage()); };
        LU.$('#mOutline', s).onclick = () => { LU.closeSheet(true); LU.outlineSheet(); };
        LU.$('#mDark', s).onclick = () => { P.dark = !P.dark; LU.save(); r.el.classList.toggle('dark', !!P.dark); LU.closeSheet(); };
        LU.$('#mPen', s).onclick = () => { P.penOnly = !P.penOnly; LU.save(); LU.closeSheet(); setTool(P.tool, true); LU.toast(P.penOnly ? 'Stylus mode on' : 'Stylus mode off: fingers draw with pen tools', { sys: false }); };
        LU.$('#mAddPg', s).onclick = () => { LU.closeSheet(true); LU.addPageSheet(r.id, currentPage()); };
        const mu = LU.$('#mUndoPg', s); if (mu) mu.onclick = () => { LU.closeSheet(true); LU.undoAddPage(r.id); };
        LU.$('#mTopic', s).onclick = () => { LU.closeSheet(true); LU.assignSheet(r.id, null); };
        LU.$('#mExp', s).onclick = () => { LU.closeSheet(); LU.saveInk(r.id, true); LU.exportMarked(r.id); };
        LU.$('#mClear', s).onclick = () => {
          LU.closeSheet(); const n = currentPage(); const list = r.ink.strokes.filter((x) => x.pg === n);
          if (!list.length) { LU.toast('No marks on this page', { sys: false }); return; }
          r.ink.strokes = r.ink.strokes.filter((x) => x.pg !== n); push({ t: 'del', list }); drawInk(pageByN(n)); LU.toast(`Erased ${list.length} marks. Tap undo to bring them back.`, { sys: false });
        };
      },
    });
  }

  /* ---------- export a copy with marks (pdf-lib) ---------- */
  let libLoad = null;
  const pdfLibJs = () => libLoad || (libLoad = new Promise((res, rej) => { if (window.PDFLib) return res(window.PDFLib); const s = document.createElement('script'); s.src = 'vendor/pdf-lib.min.js'; s.onload = () => res(window.PDFLib); s.onerror = rej; document.head.appendChild(s); }));
  LU.pdfEdit = pdfLibJs;
  const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  LU.exportMarked = async (id) => {
    const d = LU.doc(id);
    try {
      const ink = await LU.getInk(id);
      if (!ink.strokes.length && !ink.notes.length && !(ink.imgs || []).length) { LU.toast('This PDF has no marks yet.'); return; }
      LU.toast('Creating your marked copy…', { ms: 2000 });
      const [L, blob, pdf] = await Promise.all([pdfLibJs(), LU.idb.get('files', id), LU.openDoc(id)]);
      const out = await L.PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true });
      const pages = out.getPages();
      const gs = out.context.register(out.context.obj({ Type: 'ExtGState', BM: 'Multiply', CA: 1, ca: 1 }));
      const byPage = {};
      ink.strokes.forEach((s) => (byPage[s.pg] = byPage[s.pg] || []).push(s));
      ink.notes.forEach((n) => { (byPage[n.pg] = byPage[n.pg] || []); });
      (ink.imgs || []).forEach((m) => { (byPage[m.pg] = byPage[m.pg] || []); });
      for (const k of Object.keys(byPage)) {
        const n = +k, page = pages[n - 1]; if (!page) continue;
        const vp = (await pdf.getPage(n)).getViewport({ scale: 1 });
        const P = (x, y) => vp.convertToPdfPoint(x * vp.width, y * vp.height);
        const gsName = page.node.newExtGState('LUhl', gs);
        for (const im of (ink.imgs || []).filter((x) => x.pg === n)) {
          try {
            const emb = await out.embedJpg(await im.blob.arrayBuffer()), w = im.w * vp.width, h = w * im.ar;
            page.drawImage(emb, { x: im.x * vp.width, y: vp.height - im.y * vp.height - h, width: w, height: h });
          } catch (e) {}
        }
        const ops = [];
        const strokes = byPage[n].slice().sort((a, b) => (a.t === 'hl' ? 0 : 1) - (b.t === 'hl' ? 0 : 1));
        strokes.forEach((s) => {
          const [r, g, b] = hex(s.c);
          ops.push(L.pushGraphicsState());
          if (s.t === 'hl') ops.push(L.setGraphicsState(gsName));
          ops.push(L.setStrokingRgbColor(r, g, b), L.setLineWidth(s.w * vp.width), L.setLineCap(s.t === 'hl' && s.st ? L.LineCapStyle.Butt : L.LineCapStyle.Round), L.setLineJoin(L.LineJoinStyle.Round));
          const [x0, y0] = P(s.p[0], s.p[1]); ops.push(L.moveTo(x0, y0));
          if (s.p.length === 2) ops.push(L.lineTo(x0 + 0.01, y0));
          for (let i = 2; i < s.p.length; i += 2) { const [x, y] = P(s.p[i], s.p[i + 1]); ops.push(L.lineTo(x, y)); }
          ops.push(L.stroke(), L.popGraphicsState());
        });
        if (ops.length) page.pushOperators(...ops);
        ink.notes.filter((x) => x.pg === n).forEach((nt) => {
          const [x, y] = P(nt.x, nt.y);
          const a = out.context.obj({ Type: 'Annot', Subtype: 'Text', Rect: [x, y - 18, x + 18, y], Contents: L.PDFHexString.fromText(nt.text), Name: 'Comment', C: [1, 0.85, 0.2], F: 4, Open: false });
          page.node.addAnnot(out.context.register(a));
        });
      }
      const bytes = await out.save();
      const name = d.name.replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 80) + ' (marked).pdf';
      const where = await LU.saveBinary(name, bytes, 'application/pdf');
      LU.toast(where && !String(where).startsWith('Error') ? 'Saved to ' + where : 'Could not save: ' + where, { ms: 4500 });
    } catch (e) {
      console.error(e);
      LU.toast(e.message === 'missing' ? 'The PDF file is missing.' : 'Could not create the marked copy: ' + (e.message || e), { ms: 4500 });
    }
  };
  LU.saveBinary = async (name, bytes, mime) => {
    const A = window.Android;
    if (A && A.binBegin) {
      const h = A.binBegin(name, mime);
      if (String(h).startsWith('Error')) return h;
      const CH = 393216;
      for (let i = 0; i < bytes.length; i += CH) {
        let s = ''; const sub = bytes.subarray(i, i + CH);
        for (let j = 0; j < sub.length; j += 8192) s += String.fromCharCode.apply(null, sub.subarray(j, j + 8192));
        const r = A.binChunk(h, btoa(s));
        if (String(r).startsWith('Error')) return r;
        if (i % (CH * 8) === 0) await new Promise((res) => setTimeout(res, 0));
      }
      return A.binEnd(h);
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([bytes], { type: mime })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    return 'Downloads/' + name;
  };
})();
