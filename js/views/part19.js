/* Part 19: page thumbnails (jump, move, duplicate, delete pages) and the PDF's contents list */
(function () {
  const LU = window.LU, esc = LU.esc, I = LU.icon;
  const BAK = (id) => 'pgbak:' + id;
  const MIN30 = 30 * 60 * 1000;

  /* ---------- rewrite a PDF from a list of old page numbers (repeats = copies, missing = deleted) ---------- */
  LU.canUndoPages = (d) => {
    const u = d && d.pgUndo; if (!u) return false;
    if (Date.now() - u.at > MIN30) { delete d.pgUndo; LU.idb.del('snaps', BAK(d.id)).catch(() => {}); LU.save(); return false; }
    return u.what;
  };
  const afterWrite = async (id, d, blob) => {
    await LU.idb.put('files', id, blob); d.size = blob.size;
    LU.closeDoc(id); LU.dropSnaps && LU.dropSnaps(id);
    await LU.idb.clearPrefix('snaps', id + '|').catch(() => {});
    const pdf = await LU.openDoc(id); d.pages = pdf.numPages;
    try { await LU.idb.put('thumbs', id, await LU.makeThumb(pdf)); LU.dropThumb && LU.dropThumb(id); } catch (e) {}
  };
  const clone = (x) => JSON.parse(JSON.stringify(x));

  LU.rearrangePages = async (id, order, what) => {
    const d = LU.doc(id); if (!d || !order.length) return false;
    const wasOpen = LU.readerOpen() && LU.rd.R && LU.rd.R.id === id;
    const curPage = wasOpen ? LU.rd.page() : d.page || 1;
    try {
      LU.toast('Updating your PDF…', { ms: 1800 });
      if (wasOpen) LU.closeReader(true);
      const ink = await LU.getInk(id); LU.saveInk(id, true);
      const [L, blob] = await Promise.all([LU.pdfEdit(), LU.idb.get('files', id)]);
      if (!blob) throw new Error('The PDF file is missing.');
      /* keep the old file and marks so this can be undone */
      await LU.idb.put('snaps', BAK(id), { file: blob, ink: { strokes: ink.strokes, notes: ink.notes, marks: ink.marks, imgs: ink.imgs || [] }, page: d.page, recs: d.recs ? clone(d.recs) : null, pins: (LU.state.mapPins || []).filter((p) => p.doc === id).map(clone), pages: d.pages });
      const src = await L.PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true });
      const out = await L.PDFDocument.create();
      const copied = await out.copyPages(src, order.map((n) => n - 1));
      copied.forEach((pg) => out.addPage(pg));
      const nb = new Blob([await out.save()], { type: 'application/pdf' });
      /* where each old page went: first copy keeps the marks, later copies get duplicates */
      const first = {}, dups = {};
      order.forEach((n, i) => { if (first[n] == null) first[n] = i + 1; else (dups[n] = dups[n] || []).push(i + 1); });
      const fn = (p) => first[p] || 1;
      const mk = (pre) => pre + LU.uid();
      const ns = [], nn = [], ni = [];
      ink.strokes.forEach((s) => { if (first[s.pg]) { ns.push(Object.assign(s, { pg: first[s.pg] })); } });
      ink.notes.forEach((n) => { if (first[n.pg]) nn.push(Object.assign(n, { pg: first[n.pg] })); });
      (ink.imgs || []).forEach((m) => { if (first[m.pg]) ni.push(Object.assign(m, { pg: first[m.pg] })); });
      /* copies */
      const orig = { s: JSON.parse(JSON.stringify(ns.map((x) => x))), };
      void orig;
      Object.keys(dups).forEach((k) => {
        const n = +k;
        dups[k].forEach((pos) => {
          ns.filter((s) => s.pg === first[n]).forEach((s) => ns.push(Object.assign(clone(s), { id: mk('s'), pg: pos })));
          nn.filter((s) => s.pg === first[n]).forEach((s) => nn.push(Object.assign(clone(s), { id: mk('n'), pg: pos })));
          ni.filter((s) => s.pg === first[n]).forEach((s) => ni.push(Object.assign({}, s, { id: mk('i'), pg: pos })));
        });
      });
      ink.strokes = ns; ink.notes = nn; ink.imgs = ni;
      ink.marks = Array.from(new Set(ink.marks.filter((p) => first[p]).map((p) => first[p]))).sort((a, b) => a - b);
      d.page = fn(d.page || 1);
      (d.recs || []).forEach((r) => { if (r.p0) r.p0 = fn(r.p0); (r.ev || []).forEach((e) => { if (e.p) e.p = fn(e.p); }); });
      (LU.state.mapPins || []).forEach((p) => { if (p.doc === id && p.page) p.page = fn(p.page); });
      await afterWrite(id, d, nb);
      d.pgUndo = { at: Date.now(), what: what || 'Undo the last page change' };
      LU.saveInk(id, true); LU.save(true);
      LU.toast(what || 'Pages updated', { ms: 2600 });
      if (wasOpen) setTimeout(() => LU.openReader(id, { page: Math.max(1, Math.min(d.pages, first[curPage] || 1)) }), 80);
      LU.render();
      return true;
    } catch (e) {
      console.error(e);
      LU.toast('Could not change the pages: ' + (e.message || e), { ms: 4500 });
      if (wasOpen) setTimeout(() => LU.openReader(id), 80);
      return false;
    }
  };
  LU.undoPages = async (id) => {
    const d = LU.doc(id), u = d && d.pgUndo; if (!u) return;
    const wasOpen = LU.readerOpen() && LU.rd.R && LU.rd.R.id === id;
    try {
      const b = await LU.idb.get('snaps', BAK(id)); if (!b) throw new Error('The backup is gone.');
      if (wasOpen) LU.closeReader(true);
      const ink = await LU.getInk(id);
      ink.strokes = b.ink.strokes; ink.notes = b.ink.notes; ink.marks = b.ink.marks; ink.imgs = b.ink.imgs;
      d.page = b.page; if (b.recs) d.recs = b.recs;
      (LU.state.mapPins || []).forEach((p) => { const o = b.pins.find((x) => x.id === p.id); if (o && p.doc === id) p.page = o.page; });
      await afterWrite(id, d, b.file);
      delete d.pgUndo; await LU.idb.del('snaps', BAK(id));
      LU.saveInk(id, true); LU.save(true); LU.toast('Pages restored', { ms: 2200 });
      if (wasOpen) setTimeout(() => LU.openReader(id, { page: d.page || 1 }), 80);
      LU.render();
    } catch (e) { LU.toast('Could not undo: ' + (e.message || e), { ms: 4000 }); }
  };

  /* ---------- the thumbnails sheet ---------- */
  LU.pagesSheet = async (id, cur) => {
    const d = LU.doc(id); if (!d) return;
    let pdf; try { pdf = await LU.openDoc(id); } catch (e) { LU.toast('Could not open that PDF.'); return; }
    const N = pdf.numPages; let sel = null; const picked = new Set();
    const undoTxt = LU.canUndoPages(d);
    LU.sheet({
      title: 'Pages · ' + N,
      body: `<div class="row" style="gap:8px;margin-bottom:10px;flex-wrap:wrap"><button class="btn ghost sm" id="pgSel">${I('check')}Select</button>${undoTxt ? `<button class="btn ghost sm" id="pgUndo">${I('undo')}${esc(String(undoTxt).slice(0, 36))}</button>` : ''}<span class="small muted grow" id="pgHint">Tap a page to go there</span></div>
        <div id="pgBar"></div><div id="pgGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px"></div>`,
      mount: (s) => {
        const grid = LU.$('#pgGrid', s), hint = LU.$('#pgHint', s), bar = LU.$('#pgBar', s);
        let html = ''; for (let n = 1; n <= N; n++) html += `<div class="pgt" data-n="${n}" style="position:relative;border-radius:8px;overflow:hidden;border:2px solid ${n === cur ? 'var(--cyan)' : 'var(--line2)'};background:#fff;aspect-ratio:3/4;min-height:90px"><canvas style="width:100%;height:100%;display:block;object-fit:contain"></canvas><span style="position:absolute;left:0;bottom:0;background:rgba(0,0,0,.65);color:#fff;font:700 11px var(--fd);padding:2px 7px;border-top-right-radius:8px">${n}</span><i class="pgk" style="display:none;position:absolute;right:5px;top:5px;width:22px;height:22px;border-radius:50%;background:var(--green);color:#fff;font:800 13px/22px var(--fd);text-align:center;font-style:normal">✓</i></div>`;
        grid.innerHTML = html;
        const done = new Set();
        const draw = async (el) => {
          const n = +el.dataset.n; if (done.has(n)) return; done.add(n);
          try {
            const pg = await pdf.getPage(n), v1 = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: 150 / v1.width }), c = el.querySelector('canvas');
            c.width = Math.round(vp.width); c.height = Math.round(vp.height); el.style.aspectRatio = v1.width + '/' + v1.height;
            const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
            await pg.render({ canvasContext: x, viewport: vp }).promise; pg.cleanup && pg.cleanup();
          } catch (e) { done.delete(n); }
        };
        const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) draw(e.target); }), { rootMargin: '300px' }) : null;
        LU.$$('.pgt', grid).forEach((el) => (io ? io.observe(el) : draw(el)));
        const paintBar = () => {
          if (!sel) { bar.innerHTML = ''; return; }
          const n = picked.size;
          bar.innerHTML = `<div class="card" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;position:sticky;top:0;z-index:3;margin-bottom:10px"><b class="grow">${n} selected</b><button class="btn ghost sm" id="pgDup" ${n ? '' : 'disabled'}>Duplicate</button><button class="btn ghost sm" id="pgMove" ${n ? '' : 'disabled'}>Move</button><button class="btn danger sm" id="pgDel" ${n ? '' : 'disabled'}>${I('trash')}Delete</button></div>`;
          LU.$('#pgDup', bar).onclick = () => { LU.closeSheet(true); const o = []; for (let k = 1; k <= N; k++) { o.push(k); if (picked.has(k)) o.push(k); } LU.rearrangePages(id, o, picked.size + ' page' + (picked.size > 1 ? 's' : '') + ' duplicated'); };
          LU.$('#pgDel', bar).onclick = () => {
            if (picked.size >= N) { LU.toast('A PDF needs at least one page.'); return; }
            const k = picked.size; LU.closeSheet(true);
            LU.confirm('Delete ' + k + ' page' + (k > 1 ? 's' : '') + '?', 'Their marks and notes go too. You can undo this for 30 minutes from the Pages screen.', 'Delete', () => { const o = []; for (let q = 1; q <= N; q++) if (!picked.has(q)) o.push(q); LU.rearrangePages(id, o, k + ' page' + (k > 1 ? 's' : '') + ' deleted'); }, true);
          };
          LU.$('#pgMove', bar).onclick = () => {
            const k = picked.size, keep = []; for (let q = 1; q <= N; q++) if (!picked.has(q)) keep.push(q);
            LU.closeSheet(true);
            LU.sheet({
              title: 'Move ' + k + ' page' + (k > 1 ? 's' : ''),
              body: `<p class="muted" style="margin:0 0 10px">Put them after page number (0 = at the very beginning). Count pages as they are now.</p><div class="row" style="gap:8px"><input class="inp" id="pgAfter" type="number" min="0" max="${N}" inputmode="numeric" placeholder="0 to ${N}"><button class="btn" id="pgGo">Move</button></div>`,
              mount: (sh) => { LU.$('#pgGo', sh).onclick = () => {
                const a = LU.clamp(Math.round(+LU.$('#pgAfter', sh).value || 0), 0, N); LU.closeSheet(true);
                const before = keep.filter((q) => q <= a), after = keep.filter((q) => q > a), mv = []; for (let q = 1; q <= N; q++) if (picked.has(q)) mv.push(q);
                LU.rearrangePages(id, before.concat(mv, after), k + ' page' + (k > 1 ? 's' : '') + ' moved');
              }; },
            });
          };
        };
        LU.$('#pgSel', s).onclick = () => { sel = !sel; picked.clear(); LU.$('#pgSel', s).classList.toggle('on', !!sel); hint.textContent = sel ? 'Tap pages to tick them' : 'Tap a page to go there'; LU.$$('.pgk', grid).forEach((k) => (k.style.display = 'none')); paintBar(); };
        grid.addEventListener('click', (e) => {
          const el = e.target.closest('.pgt'); if (!el) return; const n = +el.dataset.n;
          if (!sel) { LU.closeSheet(true); if (LU.readerOpen()) LU.rd.goTo(n, true); else LU.openReader(id, { page: n }); return; }
          if (picked.has(n)) picked.delete(n); else picked.add(n);
          el.querySelector('.pgk').style.display = picked.has(n) ? 'block' : 'none'; el.style.borderColor = picked.has(n) ? 'var(--green)' : (n === cur ? 'var(--cyan)' : 'var(--line2)'); paintBar();
        });
        const u = LU.$('#pgUndo', s); if (u) u.onclick = () => { LU.closeSheet(true); LU.undoPages(id); };
      },
    });
  };

  /* ---------- contents (the PDF's own chapter list) ---------- */
  LU.outlineSheet = async () => {
    const R = LU.rd.R; if (!R) return; const pdf = R.pdf;
    let ol = null; try { ol = await pdf.getOutline(); } catch (e) {}
    const flat = []; (function walk(a, dep) { (a || []).forEach((it) => { flat.push({ t: it.title, dest: it.dest, dep }); walk(it.items, dep + 1); }); })(ol, 0);
    if (!flat.length) { LU.sheet({ title: 'Contents', body: `<div class="card small muted" style="line-height:1.5">This PDF has no chapter list inside it. Many downloaded notes do not. Use the bookmark button, or Search, to jump around.</div>` }); return; }
    LU.sheet({
      title: 'Contents',
      body: `<div class="list">${flat.map((x, i) => `<div class="li" data-o="${i}" style="padding-left:${14 + Math.min(x.dep, 4) * 16}px"><div class="grow lt" style="font-weight:${x.dep ? 500 : 700}">${esc(String(x.t || '').slice(0, 90))}</div></div>`).join('')}</div>`,
      mount: (s) => LU.$$('[data-o]', s).forEach((el) => (el.onclick = async () => {
        const x = flat[+el.dataset.o];
        try {
          let dest = x.dest; if (typeof dest === 'string') dest = await pdf.getDestination(dest);
          const ref = dest && dest[0], idx = typeof ref === 'object' ? await pdf.getPageIndex(ref) : +ref;
          LU.closeSheet(true); LU.rd.goTo(idx + 1);
        } catch (e) { LU.toast('Could not find that chapter.'); }
      })),
    });
  };
})();
