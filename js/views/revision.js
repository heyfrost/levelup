/* Revision mode: every highlight, underline, pen mark and note as a snapshot feed */
(function () {
  const LU = window.LU, esc = LU.esc, I = LU.icon;
  const COLOR_NAME = {}; Object.keys(LU.HL).forEach((k) => (COLOR_NAME[LU.HL[k]] = k));
  const FILTERS = [['all', 'All'], ['yellow', 'Yellow'], ['green', 'Green'], ['pink', 'Pink'], ['blue', 'Blue'], ['pen', 'Pen'], ['notes', 'Notes']];
  let filter = 'all';
  const snapMem = new Map();
  LU.dropSnaps = (id) => { Array.from(snapMem.keys()).forEach((k) => { if (String(k).startsWith(id + '|')) snapMem.delete(k); }); };

  LU.openRevision = (params) => LU.push('revision', params);
  LU.actions.revise = (el) => { LU.closeSheet(true); LU.openRevision({ scope: el.dataset.scope, id: el.dataset.id }); };

  const docsIn = ({ scope, id }) => {
    const all = LU.docs();
    if (scope === 'doc') return all.filter((d) => d.id === id);
    if (scope === 'subj') return all.filter((d) => d.subj === id);
    if (scope === 'node') { const keep = new Set(LU.leaves(LU.node(id) || { c: [] }).map((x) => x.i).concat(id)); return all.filter((d) => d.node && keep.has(d.node)); }
    return all.slice().sort((a, b) => (LU.syllabus.findIndex((s) => s.id === a.subj) + 1 || 99) - (LU.syllabus.findIndex((s) => s.id === b.subj) + 1 || 99));
  };
  const scopeTitle = ({ scope, id }) => scope === 'doc' ? (LU.doc(id) || {}).name : scope === 'subj' ? (id === 'qp' ? LU.QP.name : (LU.subject(id) || {}).name) : scope === 'node' ? (LU.node(id) || {}).t : 'All notes';

  /* group nearby marks on a page into one snapshot */
  const cluster = (strokes) => {
    const boxes = strokes.map((s) => {
      const b = LU.strokeBox(s);
      const pad = s.t === 'line' ? [0.035, 0.012] : s.t === 'hl' ? [0.014, 0.014] : [0.02, 0.02];
      return { s, y0: b[1] - pad[0], y1: b[3] + pad[1], x0: b[0], x1: b[2] };
    }).sort((a, b) => a.y0 - b.y0);
    const out = [];
    boxes.forEach((b) => {
      const c = out[out.length - 1];
      if (c && b.y0 <= c.y1 + 0.004 && b.y1 - c.y0 < 0.5) { c.y1 = Math.max(c.y1, b.y1); c.x0 = Math.min(c.x0, b.x0); c.x1 = Math.max(c.x1, b.x1); c.list.push(b.s); }
      else out.push({ y0: b.y0, y1: b.y1, x0: b.x0, x1: b.x1, list: [b.s] });
    });
    return out.map((c) => ({ rect: [Math.max(0, Math.min(c.x0 - 0.03, 0.05)), Math.max(0, c.y0), Math.min(1, Math.max(c.x1 + 0.03, 0.95)), Math.min(1, c.y1)], list: c.list }));
  };
  const tags = (list) => { const t = new Set(); list.forEach((s) => t.add(s.t === 'hl' ? COLOR_NAME[s.c] || 'yellow' : 'pen')); return Array.from(t); };

  LU.views.revision = {
    render(params) {
      return `<div class="topbar"><button class="iconbtn" data-act="back" aria-label="Back">${I('back')}</button><h1>Revision<span class="sub ell">${esc(scopeTitle(params) || '')}</span></h1>
        ${params.scope === 'all' ? `<button class="iconbtn" data-act="revScope" aria-label="Choose subject">${I('flag')}</button>` : ''}</div>
        <div class="chips">${FILTERS.map(([f, n]) => `<button class="chip ${filter === f ? 'on' : ''}" data-act="revFilter" data-f="${f}">${f !== 'all' && f !== 'notes' && f !== 'pen' ? `<i class="cdot" style="background:${LU.HL[f]}"></i>` : ''}${n}</button>`).join('')}</div>
        <div id="revFeed"><p class="small muted" style="padding:8px 2px">Collecting your marks…</p></div>`;
    },
    async mount(el, params) {
      const feed = LU.$('#revFeed', el), my = (el._rev = (el._rev || 0) + 1);
      const docs = docsIn(params);
      let html = '', count = 0;
      const items = [];
      for (const d of docs) {
        const ink = await LU.getInk(d.id);
        if (el._rev !== my) return;
        const cards = [];
        const pages = Array.from(new Set(ink.strokes.map((s) => s.pg).concat(ink.notes.map((n) => n.pg)))).sort((a, b) => a - b);
        pages.forEach((pg) => {
          const sts = ink.strokes.filter((s) => s.pg === pg);
          cluster(sts).forEach((c) => { const tg = tags(c.list); if (filter === 'all' || tg.includes(filter)) cards.push({ kind: 'snap', d, pg, c, tg, y: c.rect[1] }); });
          if (filter === 'all' || filter === 'notes') ink.notes.filter((n) => n.pg === pg).forEach((n) => cards.push({ kind: 'note', d, pg, n, y: n.y }));
        });
        cards.sort((a, b) => a.pg - b.pg || a.y - b.y);
        if (!cards.length) continue;
        html += `<div class="paper">${esc(d.name)} <span class="dim">· ${esc(LU.docLabel(d))}</span></div>`;
        cards.forEach((c) => {
          const k = items.push(c) - 1; count++;
          if (c.kind === 'note') html += `<div class="rcard rnote" data-rk="${k}"><div class="rhead"><span class="cdot" style="background:var(--gold)"></span><span class="grow">Note</span><span class="pill dim">p ${c.pg}</span></div><div class="rtext">${esc(c.n.text).replace(/\n/g, '<br>')}</div></div>`;
          else {
            const ar = ((c.c.rect[3] - c.c.rect[1]) * (c.d.ratio || 1.414)) / (c.c.rect[2] - c.c.rect[0]);
            html += `<div class="rcard" data-rk="${k}"><div class="rhead">${c.tg.map((t) => `<span class="cdot" style="background:${t === 'pen' ? '#9fb2d0' : LU.HL[t]}"></span>`).join('')}<span class="grow tiny muted">${c.tg.map((t) => t === 'pen' ? 'Pen' : t[0].toUpperCase() + t.slice(1)).join(', ')}</span><span class="pill dim">p ${c.pg}</span><button class="pill" data-act="fcSnap" data-ck="${k}" aria-label="Make flashcard">+ Card</button></div><div class="rimg" data-snap="${k}" style="aspect-ratio:${(1 / (ar || 0.2)).toFixed(3)}"></div></div>`;
          }
        });
      }
      if (el._rev !== my) return;
      if (!count) {
        feed.innerHTML = `<div class="empty">${I('loop')}${LU.docs().length ? (filter === 'all' ? 'No marks yet. Open a PDF and highlight or underline what matters. It shows up here.' : 'No marks with this filter.') : 'Add a PDF in the Notes tab, mark it up, and your highlights appear here.'}</div>`;
        return;
      }
      feed.innerHTML = `<p class="small muted" style="margin:2px 2px 0">${count} item${count === 1 ? '' : 's'}. Tap one to open it in the PDF.</p>` + html + '<div style="height:24px"></div>';
      LU._revItems = items;
      LU.$$('[data-rk]', feed).forEach((c) => (c.onclick = (ev) => { if (ev.target.closest('[data-act]')) return; const it = items[+c.dataset.rk]; LU.openReader(it.d.id, { page: it.pg, rect: it.kind === 'note' ? [it.n.x - 0.03, it.n.y - 0.02, it.n.x + 0.08, it.n.y + 0.04] : it.c.rect }); }));
      // render snapshots as they scroll into view, one at a time
      const queue = []; let running = false;
      const pump = async () => {
        if (running) return; running = true;
        while (queue.length) {
          const box = queue.shift(); if (!box.isConnected) continue;
          const it = items[+box.dataset.snap];
          try { const url = await snapshot(it); if (box.isConnected) { box.style.aspectRatio = 'auto'; box.innerHTML = `<img src="${url}" alt="Marked text on page ${it.pg}">`; } }
          catch (e) { box.innerHTML = `<div class="small muted" style="padding:14px">Could not render this snapshot${e.message === 'missing' ? ': PDF file missing' : ''}.</div>`; }
        }
        running = false;
      };
      const io = new IntersectionObserver((ents) => ents.forEach((en) => { if (en.isIntersecting) { io.unobserve(en.target); queue.push(en.target); pump(); } }), { root: el, rootMargin: '400px 0px' });
      LU.$$('[data-snap]', feed).forEach((b) => io.observe(b));
    },
  };
  LU.actions.revFilter = (el) => { filter = el.dataset.f; LU.render(); };
  LU.actions.revScope = () => {
    const counts = {}; LU.docs().forEach((d) => { if (d.subj) counts[d.subj] = (counts[d.subj] || 0) + (d.marks || 0); });
    LU.sheet({
      title: 'Revise one subject',
      body: `<div class="list">${LU.syllabus.concat([LU.QP]).filter((s) => counts[s.id] != null).map((s) => `<div class="li" data-act="revise" data-scope="subj" data-id="${s.id}"><span class="sw" style="width:8px;height:28px;border-radius:3px;background:${s.color}"></span><div class="grow"><div class="lt">${esc(s.name)}</div><div class="ls">${counts[s.id]} marks</div></div></div>`).join('') || '<div class="empty">Attach PDFs to subjects first.</div>'}</div>`,
    });
  };

  /* ---------- snapshot rendering ---------- */
  const hash = (list) => { let h = 0; list.forEach((s) => { for (const ch of s.id) h = (h * 31 + ch.charCodeAt(0)) | 0; h = (h * 31 + s.p.length) | 0; }); return h.toString(36); };
  let lastPage = null;
  LU.snapshotFor = (it) => snapshot(it);
  async function snapshot(it) {
    const key = `${it.d.id}|${it.pg}|${hash(it.c.list)}|${it.c.rect.map((v) => v.toFixed(3)).join(',')}`;
    if (snapMem.has(key)) return snapMem.get(key);
    const cached = await LU.idb.get('snaps', key).catch(() => null);
    if (cached) { snapMem.set(key, cached); return cached; }
    const pdf = await LU.openDoc(it.d.id);
    const [x0, y0, x1, y1] = it.c.rect;
    const outW = Math.min(900, Math.round(Math.min(window.innerWidth, 520) * Math.min(window.devicePixelRatio || 1, 2)));
    const pageKey = it.d.id + '|' + it.pg + '|' + outW;
    let pc;
    if (lastPage && lastPage.key === pageKey) pc = lastPage.c;
    else {
      const page = await pdf.getPage(it.pg), v1 = page.getViewport({ scale: 1 });
      const scale = outW / ((x1 - x0) * v1.width);
      const vp = page.getViewport({ scale });
      pc = document.createElement('canvas'); pc.width = Math.round(vp.width); pc.height = Math.round(vp.height);
      const ctx = pc.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, pc.width, pc.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      lastPage = { key: pageKey, c: pc };
    }
    const W = pc.width, H = pc.height;
    const sx = Math.round(x0 * W), sy = Math.round(y0 * H), sw = Math.max(1, Math.round((x1 - x0) * W)), sh = Math.max(1, Math.round((y1 - y0) * H));
    const out = document.createElement('canvas'); out.width = sw; out.height = sh;
    const o = out.getContext('2d');
    o.drawImage(pc, sx, sy, sw, sh, 0, 0, sw, sh);
    o.globalCompositeOperation = 'multiply';
    it.c.list.filter((s) => s.t === 'hl').forEach((s) => LU.drawStroke(o, s, W, H, sx, sy));
    o.globalCompositeOperation = 'source-over';
    it.c.list.filter((s) => s.t !== 'hl').forEach((s) => LU.drawStroke(o, s, W, H, sx, sy));
    const url = out.toDataURL('image/jpeg', 0.82);
    snapMem.set(key, url);
    LU.idb.put('snaps', key, url).catch(() => {});
    return url;
  }
})();
