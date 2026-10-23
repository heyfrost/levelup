/* Scanner (camera / gallery -> crop, rotate, filter -> PDF) and "add pages to a PDF" */
(function () {
  const LU = window.LU, esc = LU.esc, I = LU.icon, T = () => LU.img;
  const BAK = (id) => 'bak:' + id;
  const MIN30 = 30 * 60 * 1000;

  /* ====================================================================
     Adding pages into an existing PDF (written into the file itself)
     ==================================================================== */
  const readStamp = (d) => { const u = d.addUndo; return u ? Math.max(1, Math.round((Date.now() - u.at) / 60000)) : 0; };
  LU.canUndoAddPage = (d) => {
    const u = d && d.addUndo; if (!u) return false;
    if (Date.now() - u.at > MIN30) { delete d.addUndo; LU.idb.del('files', BAK(d.id)).catch(() => {}); LU.save(); return false; }
    return `Removes the ${u.count} page${u.count > 1 ? 's' : ''} you added ${readStamp(d)} min ago`;
  };

  const shiftInk = (ink, d, fn) => {
    ink.strokes.forEach((s) => { s.pg = fn(s.pg); });
    ink.notes.forEach((n) => { n.pg = fn(n.pg); });
    (ink.imgs || []).forEach((m) => { m.pg = fn(m.pg); });
    ink.marks = Array.from(new Set(ink.marks.map(fn))).sort((a, b) => a - b);
    d.page = fn(d.page || 1);
    (d.recs || []).forEach((r) => { if (r.p0) r.p0 = fn(r.p0); (r.ev || []).forEach((e) => { if (e.p) e.p = fn(e.p); }); });
    (LU.state.mapPins || []).forEach((p) => { if (p.doc === d.id && p.page) p.page = fn(p.page); });
  };
  const afterWrite = async (id, d, blob, touchFirst) => {
    await LU.idb.put('files', id, blob);
    d.size = blob.size;
    LU.closeDoc(id); LU.dropSnaps && LU.dropSnaps(id);
    await LU.idb.clearPrefix('snaps', id + '|').catch(() => {});
    const pdf = await LU.openDoc(id); d.pages = pdf.numPages;
    if (touchFirst) { try { await LU.idb.put('thumbs', id, await LU.makeThumb(pdf)); LU.dropThumb && LU.dropThumb(id); } catch (e) {} }
  };

  /* items: [{blank:true} | {bytes, w, h}] ; after: 0..pages */
  LU.addPagesTo = async (id, items, after, opts = {}) => {
    const d = LU.doc(id); if (!d || !items.length) return false;
    const wasOpen = LU.readerOpen() && LU.rd.R && LU.rd.R.id === id;
    try {
      LU.toast('Adding to your PDF…', { ms: 1500 });
      if (wasOpen) LU.closeReader(true);
      const ink = await LU.getInk(id); LU.saveInk(id, true);
      const [L, blob] = await Promise.all([LU.pdfEdit(), LU.idb.get('files', id)]);
      if (!blob) throw new Error('The PDF file is missing.');
      const doc = await L.PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true });
      const n = doc.getPageCount(); after = Math.max(0, Math.min(n, after));
      const ref = doc.getPage(Math.max(0, Math.min(n - 1, after > 0 ? after - 1 : 0))).getSize();
      let k = 0;
      for (const it of items) {
        if (it.blank) doc.insertPage(after + k, [ref.width, ref.height]);
        else {
          const im = await doc.embedJpg(it.bytes), W = ref.width, H = (W * it.h) / it.w;
          const pg = doc.insertPage(after + k, [W, H]); pg.drawImage(im, { x: 0, y: 0, width: W, height: H });
        }
        k++;
      }
      const out = await doc.save();
      const nb = new Blob([out], { type: 'application/pdf' });
      /* keep the original so the last add can be undone */
      await LU.idb.put('files', BAK(id), blob);
      await afterWrite(id, d, nb, after === 0);
      shiftInk(ink, d, (p) => (p > after ? p + items.length : p));
      d.addUndo = { at: Date.now(), after, count: items.length, size: blob.size };
      LU.saveInk(id, true); LU.save(true);
      LU.toast(`${items.length} page${items.length > 1 ? 's' : ''} added${after === n ? ' at the end' : ' after page ' + after}`, { ms: 2800 });
      if (opts.open !== false && (wasOpen || opts.open)) setTimeout(() => LU.openReader(id, { page: after + 1 }), 80);
      LU.render();
      return true;
    } catch (e) {
      console.error(e);
      LU.toast('Could not add the page: ' + (e.message || e), { ms: 4500 });
      if (wasOpen) setTimeout(() => LU.openReader(id), 80);
      return false;
    }
  };

  LU.undoAddPage = async (id) => {
    const d = LU.doc(id), u = d && d.addUndo; if (!u) return;
    const wasOpen = LU.readerOpen() && LU.rd.R && LU.rd.R.id === id;
    try {
      const bak = await LU.idb.get('files', BAK(id)); if (!bak) throw new Error('The backup is gone.');
      if (wasOpen) LU.closeReader(true);
      const ink = await LU.getInk(id); LU.saveInk(id, true);
      const lo = u.after, hi = u.after + u.count;
      ink.strokes = ink.strokes.filter((s) => !(s.pg > lo && s.pg <= hi));
      ink.notes = ink.notes.filter((s) => !(s.pg > lo && s.pg <= hi));
      ink.imgs = (ink.imgs || []).filter((s) => !(s.pg > lo && s.pg <= hi));
      ink.marks = ink.marks.filter((p) => !(p > lo && p <= hi));
      shiftInk(ink, d, (p) => (p > hi ? p - u.count : p > lo ? Math.max(1, lo) : p));
      await afterWrite(id, d, bak, lo === 0);
      delete d.addUndo; await LU.idb.del('files', BAK(id));
      LU.saveInk(id, true); LU.save(true);
      LU.toast('Last added page removed', { ms: 2200 });
      if (wasOpen) setTimeout(() => LU.openReader(id, { page: Math.max(1, Math.min(lo || 1, d.pages)) }), 80);
      LU.render();
    } catch (e) { LU.toast('Could not undo: ' + (e.message || e), { ms: 4000 }); }
  };

  /* where should the new pages go? */
  LU.pagePositionSheet = (docId, cur, count, cb) => {
    const d = LU.doc(docId); if (!d) return;
    cur = Math.max(1, Math.min(d.pages, cur || d.page || 1));
    const rows = [[cur, `After page ${cur}${cur === d.pages ? ' (the last page)' : ''}`, 'Right after the page you are on'], ...(cur !== d.pages ? [[d.pages, `At the end`, `After page ${d.pages}`]] : []), ...(cur !== 0 ? [[0, 'At the beginning', 'Before page 1']] : [])];
    LU.sheet({
      title: `Where should ${count > 1 ? 'these ' + count + ' pages' : 'this page'} go?`,
      body: `<div class="list">${rows.map(([v, t, s], i) => `<div class="li" data-pos="${v}"><span class="lic">${I(i === 0 ? 'down' : i === 1 && cur !== d.pages ? 'skip' : 'up')}</span><div class="grow"><div class="lt">${esc(t)}</div><div class="ls">${esc(s)}</div></div></div>`).join('')}</div>`,
      mount: (s) => LU.$$('[data-pos]', s).forEach((el) => (el.onclick = () => { const v = +el.dataset.pos; LU.closeSheet(true); cb(v); })),
    });
  };

  const fromFile = async (f) => { const cv = await T().load(f, 2000); return { bytes: await T().toBytes(cv, 0.86), w: cv.width, h: cv.height }; };

  LU.addPageSheet = (docId, cur) => {
    const d = LU.doc(docId); if (!d) return;
    const go = (items) => LU.pagePositionSheet(docId, cur, items.length, (pos) => LU.addPagesTo(docId, items, pos, { open: true }));
    const fromPick = async (opt) => {
      const files = await T().pick(opt); if (!files.length) return;
      try { LU.toast('Preparing…', { ms: 1200 }); const items = []; for (const f of files) items.push(await fromFile(f)); go(items); }
      catch (e) { LU.toast(e.message || 'That image could not be used.', { ms: 3500 }); }
    };
    LU.sheet({
      title: 'Add a page',
      body: `<div class="list">
        <div class="li" id="apCam"><span class="lic">${I('camera')}</span><div class="grow"><div class="lt">Take a photo</div><div class="ls">Opens your camera. The photo becomes a page</div></div></div>
        <div class="li" id="apScan"><span class="lic">${I('scan')}</span><div class="grow"><div class="lt">Scan with crop and filters</div><div class="ls">Like a scanner app: straighten, clean up, then add</div></div></div>
        <div class="li" id="apGal"><span class="lic">${I('image')}</span><div class="grow"><div class="lt">Choose images from gallery</div><div class="ls">One or many images, one page each</div></div></div>
        <div class="li" id="apBlank"><span class="lic">${I('filepage')}</span><div class="grow"><div class="lt">Blank page</div><div class="ls">Same size as your other pages. Write on it with the pen</div></div></div></div>`,
      mount: (s) => {
        LU.$('#apCam', s).onclick = () => { LU.closeSheet(true); fromPick({ camera: true }); };
        LU.$('#apGal', s).onclick = () => { LU.closeSheet(true); fromPick({ multiple: true }); };
        LU.$('#apBlank', s).onclick = () => { LU.closeSheet(true); go([{ blank: true }]); };
        LU.$('#apScan', s).onclick = () => { LU.closeSheet(true); LU.scanOpen({ docId, cur }); };
      },
    });
  };

  /* ====================================================================
     Scanner
     ==================================================================== */
  let S = null;
  const PREV = 900;
  const R90 = (q) => [[1 - q[3][1], q[3][0]], [1 - q[0][1], q[0][0]], [1 - q[1][1], q[1][0]], [1 - q[2][1], q[2][0]]];
  const defQuad = () => [[0.05, 0.05], [0.95, 0.05], [0.95, 0.95], [0.05, 0.95]];
  const fullQuad = () => [[0, 0], [1, 0], [1, 1], [0, 1]];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  LU.scanOpen = (o = {}) => {
    if (S) return;
    const el = document.createElement('div'); el.className = 'scanv';
    el.innerHTML = `
      <header class="sc-top"><button class="iconbtn" data-s="back" aria-label="Back">${I('back')}</button>
        <div class="grow" style="min-width:0"><div class="sc-t">${o.docId ? 'Scan pages to add' : 'Scan'}</div><div class="tiny muted" id="scSub">No pages yet</div></div>
        <button class="btn sm" data-s="save" id="scSave" disabled>${o.docId ? 'Add to PDF' : 'Save'}</button></header>
      <div class="sc-stage" id="scStage"></div>
      <div class="sc-strip" id="scStrip"></div>
      <div class="sc-filters" id="scFilters"></div>
      <div class="sc-bar" id="scBar">
        <button data-s="cam">${I('camera')}<span>Camera</span></button>
        <button data-s="gal">${I('image')}<span>Gallery</span></button>
        <button data-s="crop" class="pg-only">${I('crop')}<span>Crop</span></button>
        <button data-s="rot" class="pg-only">${I('rotate')}<span>Rotate</span></button>
        <button data-s="left" class="pg-only">${I('left')}<span>Earlier</span></button>
        <button data-s="right" class="pg-only">${I('right')}<span>Later</span></button>
        <button data-s="del" class="pg-only dng">${I('trash')}<span>Delete</span></button>
      </div>`;
    document.body.appendChild(el);
    S = { el, pages: [], sel: -1, docId: o.docId || null, cur: o.cur || 0, busy: false, name: '' };
    el.addEventListener('click', onClick);
    syncUI();
    if (o.autoCamera) addFromPick({ camera: true });
  };
  LU.scanIsOpen = () => !!S;
  LU.scanClose = () => { if (!S) return; S.el.remove(); S = null; };
  LU.scanState = () => S;

  const prevBack = window.LU_back;
  window.LU_back = () => {
    if (S) {
      if (LU.closeOverlay()) return true;
      if (LU.closeSheet()) return true;
      if (S.crop) { S.crop.cancel(); return true; }
      leave(); return true;
    }
    return prevBack();
  };
  const leave = () => {
    if (!S) return;
    if (!S.pages.length) { LU.scanClose(); return; }
    LU.confirm('Leave the scanner?', `${S.pages.length} scanned page${S.pages.length > 1 ? 's' : ''} will be thrown away.`, 'Throw away', () => LU.scanClose(), true);
  };

  function onClick(e) {
    const b = e.target.closest('[data-s]'); if (!b || !S || S.busy) return;
    const a = b.dataset.s, pg = S.pages[S.sel];
    if (a === 'back') leave();
    else if (a === 'cam') addFromPick({ camera: true });
    else if (a === 'gal') addFromPick({ multiple: true });
    else if (a === 'save') save();
    else if (a === 'th') { S.sel = +b.dataset.i; syncUI(); }
    else if (a === 'filt' && pg) { pg.filter = b.dataset.f; pg.out = null; syncUI(); }
    else if (a === 'allfilt') { S.pages.forEach((p) => { p.filter = pg.filter; p.out = null; }); syncUI(); LU.toast('Filter applied to all pages', { sys: false, ms: 1400 }); }
    else if (!pg) return;
    else if (a === 'crop') openCrop(pg);
    else if (a === 'rot') { pg.rot = (pg.rot + 1) % 4; pg.prev = T().rotate(pg.prev, 90); pg.qn = R90(pg.qn); const t = pg.sw; pg.sw = pg.sh; pg.sh = t; pg.out = null; syncUI(); }
    else if (a === 'left' && S.sel > 0) { const p = S.pages; [p[S.sel - 1], p[S.sel]] = [p[S.sel], p[S.sel - 1]]; S.sel--; syncUI(); }
    else if (a === 'right' && S.sel < S.pages.length - 1) { const p = S.pages; [p[S.sel + 1], p[S.sel]] = [p[S.sel], p[S.sel + 1]]; S.sel++; syncUI(); }
    else if (a === 'del') LU.confirm('Delete this page?', `Page ${S.sel + 1} will be removed from this scan.`, 'Delete', () => { S.pages.splice(S.sel, 1); S.sel = Math.min(S.sel, S.pages.length - 1); syncUI(); }, true);
  }

  async function addFromPick(opt) {
    const files = await T().pick(opt); if (!files.length || !S) return;
    S.busy = true; setSub('Opening photo…');
    try {
      let first = -1;
      for (const f of files) {
        const cv = await T().load(f, 2000);
        const blob = await T().toBlob(cv, 0.9);
        const f2 = Math.min(1, PREV / Math.max(cv.width, cv.height)), prev = T().canvas(cv.width * f2, cv.height * f2);
        prev.getContext('2d').drawImage(cv, 0, 0, prev.width, prev.height);
        S.pages.push({ id: 'p' + LU.uid(), blob, rot: 0, qn: defQuad(), filter: 'enh', prev, sw: cv.width, sh: cv.height, out: null });
        if (first < 0) first = S.pages.length - 1;
        await sleep(0);
      }
      S.sel = first; S.busy = false; syncUI();
      if (opt.camera) openCrop(S.pages[S.sel]);
    } catch (e) { S.busy = false; syncUI(); LU.toast(e.message || 'That photo could not be opened.', { ms: 3500 }); }
  }

  const setSub = (t) => { const s = LU.$('#scSub', S.el); if (s) s.textContent = t; };

  /* preview of one page after crop + filter */
  function render(pg) {
    if (pg.out) return pg.out;
    const w = pg.prev.width, h = pg.prev.height;
    const q = pg.qn.map(([x, y]) => [x * w, y * h]);
    pg.out = T().filter(T().warp(pg.prev, q, PREV), pg.filter);
    return pg.out;
  }

  function syncUI() {
    if (!S) return;
    const n = S.pages.length, pg = S.pages[S.sel];
    setSub(n ? `Page ${S.sel + 1} of ${n}` : 'No pages yet');
    LU.$('#scSave', S.el).disabled = !n;
    S.el.classList.toggle('has', !!n);
    const stage = LU.$('#scStage', S.el);
    if (!pg) {
      stage.innerHTML = `<div class="sc-empty">${I('scan')}<div style="font:700 17px var(--fd);margin-top:8px">Scan your notes</div><p class="small muted">Tap <b>Camera</b> to take a photo of a page, or <b>Gallery</b> to pick photos you already have. Then straighten, clean up and save as a PDF.</p></div>`;
    } else {
      stage.innerHTML = '<canvas id="scPv"></canvas>';
      const c = LU.$('#scPv', stage), out = render(pg);
      c.width = out.width; c.height = out.height; c.getContext('2d').drawImage(out, 0, 0);
    }
    LU.$('#scStrip', S.el).innerHTML = S.pages.map((p, i) => `<button class="th ${i === S.sel ? 'on' : ''}" data-s="th" data-i="${i}"><img src="${T().thumb(p.out || p.prev, 140)}" alt=""><b>${i + 1}</b></button>`).join('');
    LU.$('#scFilters', S.el).innerHTML = pg ? T().FILTERS.map(([k, n2]) => `<button class="chip ${pg.filter === k ? 'on' : ''}" data-s="filt" data-f="${k}">${n2}</button>`).join('') + (n > 1 ? `<button class="chip" data-s="allfilt">Apply to all</button>` : '') : '';
    LU.$$('.pg-only', S.el).forEach((b) => (b.disabled = !pg));
    const strip = LU.$('#scStrip', S.el), on = LU.$('.th.on', strip); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' });
  }

  /* ---------- crop editor: four draggable corners ---------- */
  function openCrop(pg) {
    const ov = document.createElement('div'); ov.className = 'sc-crop';
    ov.innerHTML = `<header class="sc-top"><button class="iconbtn" data-c="cancel" aria-label="Cancel">${I('x')}</button><div class="grow"><div class="sc-t">Crop</div><div class="tiny muted">Drag the four corners onto the page edges</div></div><button class="btn sm" data-c="ok">Done</button></header>
      <div class="sc-cstage" id="scCs"><div class="sc-cbox" id="scCb"><canvas id="scCc"></canvas><svg id="scCsv" class="sc-poly"><polygon id="scCpl"/></svg>${[0, 1, 2, 3].map((i) => `<i class="hd" data-h="${i}"></i>`).join('')}</div></div>
      <div class="sc-cfoot"><button class="btn ghost sm" data-c="full">Whole picture</button><button class="btn ghost sm" data-c="inset">Reset corners</button></div>`;
    S.el.appendChild(ov);
    const q = pg.qn.map((p) => p.slice());
    const stage = LU.$('#scCs', ov), box = LU.$('#scCb', ov), cc = LU.$('#scCc', ov), svg = LU.$('#scCsv', ov), poly = LU.$('#scCpl', ov), hds = LU.$$('.hd', ov);
    let dw = 0, dh = 0;
    const layout = () => {
      const bw = stage.clientWidth - 44, bh = stage.clientHeight - 44;
      const s = Math.min(bw / pg.prev.width, bh / pg.prev.height);
      dw = Math.max(40, Math.round(pg.prev.width * s)); dh = Math.max(40, Math.round(pg.prev.height * s));
      box.style.width = dw + 'px'; box.style.height = dh + 'px';
      cc.width = pg.prev.width; cc.height = pg.prev.height; cc.getContext('2d').drawImage(pg.prev, 0, 0);
      svg.setAttribute('width', dw); svg.setAttribute('height', dh);
      draw();
    };
    const draw = () => {
      poly.setAttribute('points', q.map(([x, y]) => `${x * dw},${y * dh}`).join(' '));
      hds.forEach((h, i) => { h.style.left = q[i][0] * dw + 'px'; h.style.top = q[i][1] * dh + 'px'; });
    };
    hds.forEach((h) => {
      const i = +h.dataset.h;
      h.onpointerdown = (e) => { e.preventDefault(); e.stopPropagation(); try { h.setPointerCapture(e.pointerId); } catch (x) {} h._d = { x: e.clientX, y: e.clientY, p: q[i].slice() }; h.classList.add('on'); };
      h.onpointermove = (e) => { if (!h._d) return; q[i][0] = LU.clamp(h._d.p[0] + (e.clientX - h._d.x) / dw, 0, 1); q[i][1] = LU.clamp(h._d.p[1] + (e.clientY - h._d.y) / dh, 0, 1); draw(); };
      h.onpointerup = h.onpointercancel = () => { h._d = null; h.classList.remove('on'); };
    });
    const close = () => { ov.remove(); if (S) S.crop = null; };
    S.crop = { cancel: close };
    ov.addEventListener('click', (e) => {
      const b = e.target.closest('[data-c]'); if (!b) return; const a = b.dataset.c;
      if (a === 'cancel') close();
      else if (a === 'full') { fullQuad().forEach((p, i) => (q[i] = p)); draw(); }
      else if (a === 'inset') { defQuad().forEach((p, i) => (q[i] = p)); draw(); }
      else if (a === 'ok') {
        /* corners must form a sensible shape */
        const area = Math.abs(((q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[2][0] - q[0][0]) * (q[1][1] - q[0][1])) / 2 + ((q[2][0] - q[0][0]) * (q[3][1] - q[0][1]) - (q[3][0] - q[0][0]) * (q[2][1] - q[0][1])) / 2);
        if (area < 0.02) { LU.toast('The corners are too close together.', { ms: 2200 }); return; }
        pg.qn = q; pg.out = null; close(); syncUI();
      }
    });
    layout();
    window.__scLayout = layout;
    setTimeout(layout, 60);
  }

  /* ---------- turning the pages into JPEGs (full quality) ---------- */
  async function buildPages(progress) {
    const res = [];
    for (let i = 0; i < S.pages.length; i++) {
      progress && progress(i + 1, S.pages.length);
      const p = S.pages[i];
      let cv = await T().load(p.blob, 2200);
      cv = T().rotate(cv, p.rot * 90);
      const q = p.qn.map(([x, y]) => [x * cv.width, y * cv.height]);
      cv = T().filter(T().warp(cv, q, 2000), p.filter);
      res.push({ bytes: await T().toBytes(cv, 0.85), w: cv.width, h: cv.height });
      cv.width = cv.height = 1;
      await sleep(0);
    }
    return res;
  }

  function save() {
    if (!S || !S.pages.length) return;
    if (S.docId) { // scanning into one PDF
      S.busy = true; LU.toast('Preparing pages…', { ms: 1500 });
      buildPages().then((items) => {
        const docId = S.docId, cur = S.cur; S.busy = false;
        LU.pagePositionSheet(docId, cur, items.length, async (pos) => { LU.scanClose(); await LU.addPagesTo(docId, items, pos, { open: true }); });
      }).catch((e) => { if (S) S.busy = false; LU.toast('Could not prepare the pages: ' + (e.message || e), { ms: 4000 }); });
      return;
    }
    const dflt = 'Scan ' + new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    LU.sheet({
      title: `Save ${S.pages.length} page${S.pages.length > 1 ? 's' : ''}`,
      body: `<div class="field"><label>Document name</label><input class="inp" id="scName" value="${esc(S.name || dflt)}" maxlength="80" autocomplete="off"></div>
        <button class="btn block" id="scNew">${I('save')}Save as a new PDF</button>
        <button class="btn ghost block" id="scExist" style="margin-top:10px">${I('filepage')}Add to an existing PDF</button>
        <p class="small muted" style="margin-top:10px">A new PDF goes into your Notes library, then you pick its subject and topic.</p>`,
      mount: (s) => {
        const nm = () => { const v = LU.$('#scName', s).value.trim(); S.name = v; return v || dflt; };
        LU.$('#scNew', s).onclick = () => { const name = nm(); LU.closeSheet(true); saveNew(name); };
        LU.$('#scExist', s).onclick = () => { nm(); LU.closeSheet(true); pickExisting(); };
      },
    });
  }

  async function saveNew(name) {
    S.busy = true;
    const bar = LU.$('#scSave', S.el); bar.disabled = true;
    try {
      const items = await buildPages((i, n) => { setSub(`Making page ${i} of ${n}…`); });
      setSub('Creating the PDF…');
      const bytes = await T().buildPdf(items);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const r = await LU.importPdf(blob, name);
      const d = r.doc; d.name = name; d.hasText = false; LU.save(true);
      LU.scanClose();
      if (LU.currentTab() !== 'notes' && !LU.top()) LU.go('notes');
      LU.render();
      LU.toast('Saved to your Notes: ' + name, { ms: 2500 });
      LU.assignSheet(d.id, { subjects: [], topics: [] });
    } catch (e) {
      console.error(e);
      if (S) { S.busy = false; bar.disabled = false; setSub(`Page ${S.sel + 1} of ${S.pages.length}`); }
      LU.toast('Could not save: ' + (e.message || e), { ms: 4500 });
    }
  }

  function pickExisting() {
    const docs = LU.docs().slice().sort((a, b) => (b.opened || 0) - (a.opened || 0));
    if (!docs.length) { LU.toast('You have no PDFs yet. Save this as a new PDF first.', { ms: 3000 }); return; }
    let q = '';
    const list = () => docs.filter((d) => !q || (d.name + ' ' + LU.docLabel(d)).toLowerCase().includes(q)).slice(0, 80);
    const rows = () => list().map((d) => `<div class="li" data-pd="${d.id}"><span class="lic">${I('book')}</span><div class="grow"><div class="lt ell">${esc(d.name)}</div><div class="ls ell">${esc(LU.docLabel(d))} · ${d.pages} pages</div></div></div>`).join('') || '<div class="li"><div class="grow small muted">No PDF matches.</div></div>';
    LU.sheet({
      title: 'Add to which PDF?',
      body: `<div class="search" style="margin-top:0">${I('search')}<input id="pdq" placeholder="Search your PDFs" autocomplete="off"></div><div class="list" id="pdl">${rows()}</div>`,
      mount: (s) => {
        const wire = () => LU.$$('[data-pd]', s).forEach((el) => (el.onclick = () => {
          const id = el.dataset.pd; LU.closeSheet(true); S.busy = true; LU.toast('Preparing pages…', { ms: 1500 });
          buildPages().then((items) => { S.busy = false; LU.pagePositionSheet(id, LU.doc(id).page, items.length, async (pos) => { LU.scanClose(); await LU.addPagesTo(id, items, pos, { open: true }); }); })
            .catch((e) => { if (S) S.busy = false; LU.toast('Could not prepare the pages: ' + (e.message || e), { ms: 4000 }); });
        }));
        LU.$('#pdq', s).oninput = (e) => { q = e.target.value.trim().toLowerCase(); LU.$('#pdl', s).innerHTML = rows(); wire(); };
        wire();
      },
    });
  }

  LU.actions.scanOpen = () => LU.scanOpen({});
})();
