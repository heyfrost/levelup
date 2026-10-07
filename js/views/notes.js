/* Notes Library: add PDFs, attach to subject/topic, browse, manage */
(function () {
  const LU = window.LU, esc = LU.esc, I = LU.icon;
  let filter = '', busy = false, fstat = '';
  const thumbs = {};
  const fmtSize = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');

  /* order inside a subject: by your own order if you moved things, otherwise by upload time (newest last) */
  LU.docOrd = (d) => (typeof d.ord === 'number' ? d.ord : d.added || 0);
  const byOrd = (a, b) => LU.docOrd(a) - LU.docOrd(b);

  let sel = null;   // Set of ids while choosing PDFs to delete
  const card = (d) => {
    const pct = d.pages ? LU.clamp((d.page || 1) / d.pages, 0, 1) : 0;
    const on = sel && sel.has(d.id);
    return `<div class="dcard" data-act="${sel ? 'selDoc' : 'openDoc'}" data-id="${d.id}" ${on ? 'style="outline:3px solid var(--accent,#5b8cff);border-radius:12px"' : ''}>
      <div class="dth" data-thumb="${d.id}">${thumbs[d.id] ? `<img src="${thumbs[d.id]}" alt="">` : I('book')}<div class="dprog"><i style="width:${(d.opened ? pct : 0) * 100}%"></i></div></div>
      ${sel ? `<span class="dmore" style="pointer-events:none;display:grid;place-items:center">${on ? I('check') : ''}</span>` : `<button class="dmore" data-act="docMenu" data-id="${d.id}" aria-label="Options">${I('dots')}</button>`}
      <div class="dname">${esc(d.name)}</div>
      <div class="tiny muted">${d.pages} pages${d.marks ? ` · ${d.marks} marks` : ''}${d.fin ? ' · <span style="color:var(--green,#3ddc97);font-weight:700">✓ Finished</span>' : ''}</div></div>`;
  };

  LU.views.notes = {
    render() {
      const docs = LU.docs();
      const q = filter.trim().toLowerCase();
      if (fstat && !docs.some((d) => d.fin)) fstat = '';
      const byQ = q ? docs.filter((d) => (d.name + ' ' + LU.docLabel(d)).toLowerCase().includes(q)) : docs;
      const list = fstat === 'fin' ? byQ.filter((d) => d.fin) : fstat === 'rd' ? byQ.filter((d) => !d.fin) : byQ;
      const last = docs.filter((d) => d.opened).sort((a, b) => b.opened - a.opened)[0];
      const marks = docs.reduce((a, d) => a + (d.marks || 0), 0);
      const head = `<div class="topbar"><h1>Notes<span class="sub">${docs.length} PDF${docs.length === 1 ? '' : 's'} · ${marks} marks</span></h1>
        <div class="row" style="gap:8px">${docs.length > 1 ? `<button class="btn ghost sm" data-act="selStart">${I('trash')}Select</button>` : ''}<button class="btn ghost sm" data-act="scanOpen">${I('scan')}Scan</button><button class="btn sm" data-act="addPdf">${I('plus')}Add PDF</button></div></div>
        <input type="file" id="pdfIn" accept="application/pdf,.pdf" multiple hidden>`;
      if (!docs.length) {
        return head + `<section class="win"><div class="win-in"><div class="win-h">NOTES LIBRARY</div>
          <p class="quote" style="font-size:19px;margin-top:0">Bring your academy notes here.</p>
          <div class="mini"><span>1</span><span class="grow">Download a PDF from the Unacademy app.</span></div>
          <div class="mini"><span>2</span><span class="grow">Tap <b>Share</b> and choose <b>LevelUp</b>, or tap Add PDF here.</span></div>
          <div class="mini"><span>3</span><span class="grow">Pick its subject and topic. LevelUp suggests one by reading the PDF.</span></div>
          <div class="mini"><span>4</span><span class="grow">Read, highlight and underline. Your marks collect in Revision mode.</span></div>
          <button class="btn block" style="margin-top:16px" data-act="addPdf">${I('plus')}Add your first PDF</button></div></section>`;
      }
      const groups = [];
      LU.syllabus.forEach((s) => { const g = list.filter((d) => d.subj === s.id).sort(byOrd); if (g.length) groups.push([s, g]); });
      const qps = list.filter((d) => d.subj === 'qp').sort(byOrd);
      if (qps.length) groups.push([LU.QP, qps]);
      const uns = list.filter((d) => !d.subj || (d.subj !== 'qp' && !LU.subject(d.subj))).sort(byOrd);
      const folders = !q && !sel;
      const fold = (id, name, color, n, ic) => `<div class="fcard" data-act="openFolder" data-id="${id}"><span class="fic" style="--c:${color}">${I(ic || 'folder')}</span><div class="fnm">${esc(name)}</div><div class="tiny muted">${n} PDF${n === 1 ? '' : 's'}</div></div>`;
      const mcqN = ((LU.state.mcqbank || {}).items || []).length, impN = ((LU.state.imp || {}).items || []).length;
      const folderHtml = !folders ? '' : `<div class="fgrid">
          <div class="fcard sp" data-act="openMcqFolder"><span class="fic" style="--c:#7c8cff">${I('target')}</span><div class="fnm">MCQ</div><div class="tiny muted">${mcqN} question${mcqN === 1 ? '' : 's'}</div></div>
          <div class="fcard sp" data-act="openImpFolder"><span class="fic" style="--c:#f5b942">${I('star')}</span><div class="fnm">Important points</div><div class="tiny muted">${impN} point${impN === 1 ? '' : 's'}</div></div>
          <div class="fcard sp" data-act="openRefs"><span class="fic" style="--c:#5fd0c5">${I('book')}</span><div class="fnm">Reference books</div><div class="tiny muted">${((LU.state.refs || []).length)} book${(LU.state.refs || []).length === 1 ? '' : 's'}</div></div>
          ${groups.map(([s, g]) => fold(s.id, s.name, s.color, g.length)).join('')}${uns.length ? fold('_uns', 'Unsorted', '#8a93a6', uns.length) : ''}</div>`;
      return head + `
        ${last && !q ? `<div class="card tap" data-act="openDoc" data-id="${last.id}"><div class="row"><div class="cth" data-thumb="${last.id}">${thumbs[last.id] ? `<img src="${thumbs[last.id]}" alt="">` : ''}</div>
          <div class="grow"><div class="tiny muted">Continue reading</div><div style="font:700 16px/1.3 var(--fd);margin-top:2px">${esc(last.name)}</div><div class="small muted" style="margin-top:2px">Page ${last.page} of ${last.pages}</div><div style="margin-top:8px">${LU.bar(last.page / last.pages, 'thin')}</div></div></div></div>` : ''}
        ${!q ? `<section class="win gold"><div class="win-in" style="padding:14px 16px"><div class="row"><span class="bossic gold">${I('loop')}</span><div class="grow"><div style="font:700 16px var(--fd)">Revision mode</div><div class="small muted">Every highlight, underline and note in one feed.</div></div><button class="btn gold sm" data-act="revise" data-scope="all">Open</button></div></div></section>` : ''}
        ${sel ? `<div class="card" style="display:flex;align-items:center;gap:8px;position:sticky;top:0;z-index:5"><b class="grow">${sel.size} selected</b><button class="btn ghost sm" data-act="selAll">${sel.size === list.length ? 'None' : 'All'}</button><button class="btn danger sm" data-act="selDel" ${sel.size ? '' : 'disabled'}>${I('trash')}Delete</button><button class="btn ghost sm" data-act="selStop">Cancel</button></div>` : ''}
        <div class="search">${I('search')}<input id="nq" type="text" placeholder="Search your PDFs" value="${esc(filter)}" autocomplete="off"></div>
        ${docs.some((d) => d.fin) ? `<div class="chips" style="margin:10px 0">${[['', 'All'], ['rd', 'Reading'], ['fin', 'Finished']].map(([k, t]) => `<button class="chip ${fstat === k ? 'on' : ''}" data-act="fStat" data-k="${k}">${t}</button>`).join('')}</div>` : ''}
        ${folderHtml}
        ${folders ? '' : groups.map(([s, g]) => `<div class="paper row" style="gap:8px"><span class="sw" style="width:8px;height:8px;border-radius:2px;background:${s.color}"></span>${esc(s.name)} <span class="dim">${g.length}</span></div><div class="dgrid" data-dg="1">${g.map(card).join('')}</div>`).join('')}
        ${folders ? '' : uns.length ? `<div class="paper">Unsorted <span class="dim">${uns.length}</span></div><div class="dgrid" data-dg="1">${uns.map(card).join('')}</div>` : ''}
        ${!list.length && q ? `<div class="empty">No PDF matches “${esc(filter)}”.</div>` : ''}
        <div style="height:16px"></div>`;
    },
    mount(el) {
      const inp = LU.$('#nq', el);
      if (inp) { let t; inp.oninput = () => { clearTimeout(t); t = setTimeout(() => { filter = inp.value; LU.render(); const n = LU.$('#nq'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 200); }; }
      const f = LU.$('#pdfIn', el);
      if (f) f.onchange = () => { const files = Array.from(f.files || []); f.value = ''; LU.importFiles(files.map((x) => ({ blob: x, name: x.name }))); };
      LU.loadThumbs(el);
      if (!filter.trim() && !sel) LU.$$('.dcard', el).forEach(bindDrag);
    },
  };

  /* ---------- one subject folder ---------- */
  const inFolder = (id) => LU.docs().filter((d) => id === '_uns' ? (!d.subj || (d.subj !== 'qp' && !LU.subject(d.subj))) : d.subj === id).sort(byOrd);
  const folderName = (id) => id === '_uns' ? 'Unsorted' : id === 'qp' ? LU.QP.name : (LU.subject(id) || { name: 'Folder' }).name;
  LU.views.nfolder = {
    render(p) {
      const id = (p && p.id) || '_uns', all = inFolder(id), list = fstat === 'fin' ? all.filter((d) => d.fin) : fstat === 'rd' ? all.filter((d) => !d.fin) : all;
      return `<div class="topbar"><button class="iconbtn" data-act="back">${I('back')}</button><h1>${esc(folderName(id))}<span class="sub">${list.length} PDF${list.length === 1 ? '' : 's'}</span></h1>
        <div class="row" style="gap:8px">${list.length > 1 && !sel ? `<button class="btn ghost sm" data-act="selStart">${I('trash')}Select</button>` : ''}<button class="btn sm" data-act="addPdf">${I('plus')}Add</button></div></div>
        <input type="file" id="pdfIn" accept="application/pdf,.pdf" multiple hidden>
        ${all.some((d) => d.fin) ? `<div class="chips" style="margin:6px 0 10px">${[['', 'All'], ['rd', 'Reading'], ['fin', 'Finished']].map(([k, t]) => `<button class="chip ${fstat === k ? 'on' : ''}" data-act="fStat" data-k="${k}">${t}</button>`).join('')}</div>` : ''}
        ${sel ? `<div class="card" style="display:flex;align-items:center;gap:8px;position:sticky;top:0;z-index:5"><b class="grow">${sel.size} selected</b><button class="btn ghost sm" data-act="selAll">${sel.size === list.length ? 'None' : 'All'}</button><button class="btn danger sm" data-act="selDel" ${sel.size ? '' : 'disabled'}>${I('trash')}Delete</button><button class="btn ghost sm" data-act="selStop">Cancel</button></div>` : ''}
        ${list.length ? `${!sel && list.length > 1 ? '<div class="tiny dim" style="margin:6px 2px 0">Hold a PDF and drag it to change its order.</div>' : ''}<div class="dgrid" data-dg="1">${list.map(card).join('')}</div>` : '<div class="empty">No PDFs in this folder.</div>'}
        <div style="height:16px"></div>`;
    },
    mount(el) {
      const f = LU.$('#pdfIn', el);
      if (f) f.onchange = () => { const files = Array.from(f.files || []); f.value = ''; LU.importFiles(files.map((x) => ({ blob: x, name: x.name }))); };
      LU.loadThumbs(el);
      if (!sel) LU.$$('.dcard', el).forEach(bindDrag);
    },
  };
  LU.actions.openFolder = (el) => { LU.push('nfolder', { id: el.dataset.id }); };

  /* ---------- hold and drag to reorder (inside one subject) ---------- */
  let dragEnd = 0;
  const bindDrag = (card) => {
    card.style.webkitTouchCallout = 'none'; card.style.userSelect = 'none';
    card.addEventListener('contextmenu', (e) => e.preventDefault());
    card.addEventListener('dragstart', (e) => e.preventDefault());
    card.addEventListener('pointerdown', (e) => {
      if (e.button > 0 || e.target.closest('.dmore')) return;
      const grid = card.parentElement; if (!grid || !grid.dataset.dg) return;
      let sx = e.clientX, sy = e.clientY, lx = sx, ly = sy, on = false, clone = null, off = [0, 0], scroller = LU.$('#main') || document.scrollingElement, auto = 0;
      const stopTouch = (ev) => { if (on && ev.cancelable) ev.preventDefault(); };
      const move = (ev) => {
        lx = ev.clientX; ly = ev.clientY;
        if (!on) { if (Math.abs(lx - sx) + Math.abs(ly - sy) > 9) cancel(); return; }
        place();
      };
      const place = () => {
        clone.style.left = lx - off[0] + 'px'; clone.style.top = ly - off[1] + 'px';
        const others = Array.from(grid.children).filter((c) => c !== card);
        let hitC = null;
        for (const c of others) { const r = c.getBoundingClientRect(); if (lx >= r.left && lx <= r.right && ly >= r.top && ly <= r.bottom) { hitC = c; break; } }
        if (hitC) {
          const order = Array.from(grid.children);
          if (order.indexOf(card) < order.indexOf(hitC)) hitC.after(card); else hitC.before(card);
        } else if (others.length) {
          const lr = others[others.length - 1].getBoundingClientRect();
          if (ly > lr.bottom) grid.appendChild(card);
        }
      };
      const tick = () => {
        if (!on) return; const r = scroller.getBoundingClientRect ? scroller.getBoundingClientRect() : { top: 0, bottom: innerHeight };
        const top = Math.max(r.top, 0) + 90, bot = Math.min(r.bottom, innerHeight) - 90;
        if (ly < top) scroller.scrollTop -= Math.min(16, (top - ly) / 4 + 3); else if (ly > bot) scroller.scrollTop += Math.min(16, (ly - bot) / 4 + 3);
        place(); auto = requestAnimationFrame(tick);
      };
      const lift = () => {
        on = true; LU.vibrate(18);
        const r = card.getBoundingClientRect(); off = [lx - r.left, ly - r.top];
        clone = card.cloneNode(true); clone.classList.add('dclone'); clone.style.width = r.width + 'px'; clone.style.left = r.left + 'px'; clone.style.top = r.top + 'px';
        document.body.appendChild(clone); card.classList.add('dghost');
        document.addEventListener('touchmove', stopTouch, { passive: false });
        auto = requestAnimationFrame(tick);
      };
      const cleanup = () => {
        clearTimeout(timer); cancelAnimationFrame(auto);
        window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', abort);
        document.removeEventListener('touchmove', stopTouch);
        if (clone) clone.remove(); card.classList.remove('dghost');
      };
      const cancel = () => { if (!on) cleanup(); };
      const abort = () => { cleanup(); };
      const up = () => {
        const was = on; cleanup();
        if (!was) return;
        dragEnd = Date.now();
        const stop = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
        document.addEventListener('click', stop, true); setTimeout(() => document.removeEventListener('click', stop, true), 450);
        const ids = Array.from(grid.children).map((c) => c.dataset.id);
        const before = ids.map((id) => LU.doc(id)).filter(Boolean).slice().sort(byOrd).map((d) => d.id).join();
        if (ids.join() !== before) { ids.forEach((id, i) => { const d = LU.doc(id); if (d) d.ord = i + 1; }); LU.save(true); LU.toast('Order saved', { sys: false }); }
      };
      const timer = setTimeout(lift, 450);
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', abort);
    });
  };
  LU.loadThumbs = (el) => {
    LU.$$('[data-thumb]', el).forEach(async (box) => {
      const id = box.dataset.thumb;
      if (thumbs[id]) return;
      const t = await LU.idb.get('thumbs', id).catch(() => null);
      if (t) { thumbs[id] = t; box.innerHTML = `<img src="${t}" alt="">` + (box.querySelector('.dprog') ? box.querySelector('.dprog').outerHTML : ''); }
    });
  };
  LU.dropThumb = (id) => { delete thumbs[id]; };

  LU.actions.addPdf = () => { const f = LU.$('#pdfIn'); if (f) f.click(); else { LU.go('notes'); setTimeout(() => LU.$('#pdfIn') && LU.$('#pdfIn').click(), 100); } };

  /* Import one or more files (from picker or share), then ask where each belongs */
  LU.importFiles = async (items) => {
    if (!items.length) return;
    if (busy) { LU.toast('Still adding the previous PDF. Try again in a moment.'); return; }
    busy = true;
    const done = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      LU.toast(`Adding ${items.length > 1 ? `${i + 1} of ${items.length}: ` : ''}${it.name}`, { ms: 1800 });
      try { done.push(await LU.importPdf(it.blob, it.name)); if (it.onDone) it.onDone(); }
      catch (e) { LU.toast(e.message || 'That file could not be added.', { ms: 4000 }); }
    }
    busy = false;
    if (LU.currentTab() !== 'notes' && !LU.top()) LU.go('notes');
    LU.render();
    const next = () => { const r = done.shift(); if (r) LU.assignSheet(r.doc.id, r.suggestions, next); };
    next();
  };

  /* ---------- assign to subject / topic ---------- */
  LU.assignSheet = (id, sugg, after) => {
    const d = LU.doc(id); if (!d) return;
    const looksQP = /question\s*paper|\bpyq\b|previous\s*year|\bqp\b|prelims?\s*20\d\d|mains?\s*20\d\d|\bpaper\s*(i|ii|1|2)\b/i.test(d.name || '');
    let subj = d.subj || (looksQP ? 'qp' : (sugg && sugg.subjects[0])) || null, node = d.node || null, query = '';
    const topicsHtml = () => {
      const s = subj && LU.subject(subj); if (!s) return '';
      const q = query.trim().toLowerCase(); const rows = [];
      const walk = (n, depth, path) => {
        if (rows.length > 60) return;
        const isGroup = n.c && n.c.length;
        if (q ? n.t.toLowerCase().includes(q) : depth <= 1 && isGroup) rows.push({ n, path });
        (n.c || []).forEach((c) => walk(c, depth + 1, path.concat(n.t)));
      };
      (s.c || []).forEach((sec) => (sec.c || []).forEach((c) => walk(c, 1, [sec.t])));
      return `<div class="field"><label>Topic in ${esc(s.name)} (optional)</label><div class="search" style="margin:0 0 6px">${I('search')}<input id="asq" placeholder="Search topics" value="${esc(query)}"></div></div>
        <div class="list" style="margin-top:0">${[{ n: null }].concat(rows).map((r) => `<div class="li" data-pick="${r.n ? r.n.i : ''}" style="min-height:48px;padding:10px 14px"><div class="grow"><div class="lt" style="font-weight:${r.n ? 500 : 600}">${r.n ? esc(r.n.t) : 'Whole subject'}</div>${r.path ? `<div class="ls ell">${esc(r.path.join(' › '))}</div>` : ''}</div>${(r.n ? r.n.i : null) === node ? `<span class="pill">Selected</span>` : ''}</div>`).join('')}</div>`;
    };
    const suggHtml = () => (!sugg || !sugg.topics.length) ? '' : `<div class="field"><label>${I('star', 'inl')} Suggested from the PDF</label>${sugg.topics.map((t) => { const n = LU.node(t.id); if (!n) return ''; const p = LU.pathOf(t.id); return `<button class="sugg ${node === t.id ? 'on' : ''}" data-sugg="${t.id}" data-sid="${t.sid}"><b>${esc(n.t)}</b><span>${esc(LU.subject(t.sid).name)} › ${esc(p.slice(0, -1).map((x) => x.t).slice(-2).join(' › '))}</span></button>`; }).join('')}</div>`;
    const body = () => `<p class="small muted" style="margin:0 0 10px">${esc(d.name)} · ${d.pages} pages${d.hasText ? '' : '. This PDF looks scanned, so suggestions come from its name only.'}</p>
      ${suggHtml()}
      <div class="field"><label>Subject</label><div class="seg" id="asSubj"><button type="button" data-s="qp" class="${subj === 'qp' ? 'on' : ''}">Question paper</button>${LU.syllabus.map((s) => `<button type="button" data-s="${s.id}" class="${subj === s.id ? 'on' : ''}">${esc(s.name)}</button>`).join('')}</div></div>
      <div id="asTopics">${topicsHtml()}</div>`;
    const sh = LU.sheet({
      title: 'Where does this PDF belong?', body: body(),
      foot: `<button class="btn ghost" id="asSkip">${d.subj ? 'Cancel' : 'Skip for now'}</button><button class="btn" id="asOk">Save</button>`,
      onClose: () => after && setTimeout(after, 260),
    });
    const wire = () => {
      LU.$$('#asSubj button', sh).forEach((b) => (b.onclick = () => { subj = b.dataset.s; node = null; query = ''; redraw(); }));
      LU.$$('[data-sugg]', sh).forEach((b) => (b.onclick = () => { subj = b.dataset.sid; node = b.dataset.sugg; redraw(); }));
      LU.$$('[data-pick]', sh).forEach((b) => (b.onclick = () => { node = b.dataset.pick || null; redraw(true); }));
      const q = LU.$('#asq', sh);
      if (q) { let t; q.oninput = () => { clearTimeout(t); t = setTimeout(() => { query = q.value; LU.$('#asTopics', sh).innerHTML = topicsHtml(); wire(); const n = LU.$('#asq', sh); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 200); }; }
    };
    const redraw = (keep) => { const b = LU.$('.sh-b', sh), st = b.scrollTop; b.innerHTML = body(); wire(); if (keep) b.scrollTop = st; };
    wire();
    LU.$('#asOk', sh).onclick = () => { d.subj = subj; d.node = subj === 'qp' ? null : node; LU.save(); LU.closeSheet(); LU.render(); LU.toast(subj ? 'Saved to ' + LU.docLabel(d) : 'Saved in Unsorted'); };
    LU.$('#asSkip', sh).onclick = () => LU.closeSheet();
  };

  /* ---------- document menu ---------- */
  LU.actions.docMenu = (el, e) => {
    e.stopPropagation();
    const d = LU.doc(el.dataset.id); if (!d) return;
    LU.sheet({
      title: d.name,
      body: `<p class="small muted" style="margin:0 0 6px">${esc(LU.docLabel(d))} · ${d.pages} pages · ${fmtSize(d.size || 0)}${d.mins ? ` · read for ${LU.dur(d.mins)}` : ''}</p>
      <div class="list">
        <div class="li" data-act="dmOpen" data-id="${d.id}"><span class="lic">${I('book')}</span><div class="grow lt">Open</div></div>
        <div class="li" data-act="revise" data-scope="doc" data-id="${d.id}"><span class="lic">${I('loop')}</span><div class="grow lt">Revise this PDF's marks</div></div>
        <div class="li" data-act="dmImp" data-id="${d.id}"><span class="lic">${I('star')}</span><div class="grow"><div class="lt">Collect from this PDF</div><div class="ls">Important points and MCQs, with AI answers</div></div></div>
        <div class="li" data-act="dmMove" data-id="${d.id}"><span class="lic">${I('flag')}</span><div class="grow"><div class="lt">Change subject or topic</div><div class="ls">${esc(LU.docLabel(d))}</div></div></div>
        <div class="li" data-act="dmFin" data-id="${d.id}"><span class="lic">${I('check')}</span><div class="grow"><div class="lt">${d.fin ? 'Not finished (back to reading)' : 'Mark as finished'}</div></div></div>
        <div class="li" data-act="dmRename" data-id="${d.id}"><span class="lic">${I('edit')}</span><div class="grow lt">Rename</div></div>
        <div class="li" data-act="dmExport" data-id="${d.id}"><span class="lic">${I('save')}</span><div class="grow"><div class="lt">Save a copy with my marks</div><div class="ls">To Download/LevelUp</div></div></div>
        <div class="li" data-act="dmRelink" data-id="${d.id}"><span class="lic">${I('upload')}</span><div class="grow"><div class="lt">Replace the PDF file</div><div class="ls">Use after restoring a backup on a new phone</div></div></div>
        <div class="li" data-act="dmDel" data-id="${d.id}"><span class="lic" style="color:var(--red);background:rgba(255,93,122,.12)">${I('trash')}</span><div class="grow lt">Delete</div></div>
      </div><input type="file" id="relinkIn" accept="application/pdf,.pdf" hidden>`,
    });
  };
  LU.actions.dmOpen = (el) => { LU.closeSheet(true); LU.openReader(el.dataset.id); };
  LU.actions.dmMcq = (el) => { LU.closeSheet(true); if (LU.mcqCollect) LU.mcqCollect(el.dataset.id); };
  LU.actions.fStat = (el) => { fstat = el.dataset.k || ''; LU.render(); };
  LU.actions.dmImp = (el) => { LU.closeSheet(true); if (LU.collectAll) LU.collectAll(el.dataset.id); };
  LU.actions.dmMove = (el) => { LU.closeSheet(true); LU.assignSheet(el.dataset.id, null); };
  LU.actions.dmRename = (el) => {
    const d = LU.doc(el.dataset.id);
    LU.sheet({ title: 'Rename PDF', body: `<div class="field"><label>Name</label><input class="inp" id="rnv" value="${esc(d.name)}" maxlength="120"></div>`,
      foot: `<button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn" id="rnOk">Save</button>`,
      mount: (s) => { LU.$('#rnOk', s).onclick = () => { const v = LU.$('#rnv', s).value.trim(); if (v) { d.name = v; LU.save(); } LU.closeSheet(); LU.render(); }; } });
  };
  LU.actions.selStart = () => { sel = new Set(); LU.render(true); };
  LU.actions.selStop = () => { sel = null; LU.render(true); };
  LU.actions.selDoc = (el) => { if (!sel) return; const id = el.dataset.id; if (sel.has(id)) sel.delete(id); else sel.add(id); LU.render(true); };
  LU.actions.selAll = () => {
    if (!sel) return; const q = filter.trim().toLowerCase();
    const list = q ? LU.docs().filter((d) => (d.name + ' ' + LU.docLabel(d)).toLowerCase().includes(q)) : LU.docs();
    if (sel.size === list.length) sel.clear(); else list.forEach((d) => sel.add(d.id));
    LU.render(true);
  };
  LU.actions.selDel = () => {
    if (!sel || !sel.size) return;
    const ids = Array.from(sel), marks = ids.reduce((a, id) => a + ((LU.doc(id) || {}).marks || 0), 0);
    LU.confirm(`Delete ${ids.length} PDF${ids.length > 1 ? 's' : ''}?`, `They and their ${marks} marks will be removed from LevelUp. The original files in your Downloads are not touched.`, 'Delete', async () => {
      for (const id of ids) { try { await LU.deleteDoc(id); LU.dropThumb(id); } catch (e) {} }
      sel = null; LU.render(); LU.toast(ids.length + ' PDF' + (ids.length > 1 ? 's' : '') + ' deleted');
    }, true);
  };
  LU.actions.dmDel = (el) => {
    const d = LU.doc(el.dataset.id);
    LU.confirm('Delete this PDF?', `“${d.name}” and all ${d.marks || 0} of its marks will be removed from LevelUp. The original file in your Downloads is not touched.`, 'Delete', async () => { await LU.deleteDoc(d.id); LU.dropThumb(d.id); LU.render(); LU.toast('PDF deleted'); }, true);
  };
  LU.actions.dmRelink = (el) => {
    const id = el.dataset.id, f = LU.$('#relinkIn');
    f.onchange = async () => { const file = f.files[0]; if (!file) return; LU.closeSheet(); try { await LU.relinkDoc(id, file); LU.dropThumb(id); LU.render(); LU.toast('PDF file replaced. Your marks are kept.'); } catch (e) { LU.toast('That file could not be opened.'); } };
    f.click();
  };
  LU.actions.dmExport = (el) => { LU.closeSheet(); LU.exportMarked(el.dataset.id); };
  LU.actions.openDoc = (el, e) => { if (e.target.closest('[data-act="docMenu"]')) return; LU.openReader(el.dataset.id); };

  /* ---------- incoming shares from other apps (Android) ---------- */
  LU.checkIncoming = async () => {
    if (!window.Android || !window.Android.takeIncoming) return;
    let list = [];
    try { list = JSON.parse(window.Android.takeIncoming() || '[]'); } catch (e) { return; }
    if (!list.length) return;
    const items = [];
    for (const it of list) {
      try {
        const r = await fetch(it.url);
        if (!r.ok) throw new Error();
        items.push({ blob: await r.blob(), name: it.name, onDone: () => { try { window.Android.deleteIncoming(it.file); } catch (e) {} } });
      } catch (e) { LU.toast('Could not read ' + it.name); }
    }
    LU.closeOverlay(true);
    LU.importFiles(items);
  };
  window.LU_incomingReady = () => LU.checkIncoming();
})();
