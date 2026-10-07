/* Part 12c: search inside all PDFs (typed text, no OCR) and previous-year-question tracker by topic. */
(function () {
  const LU = window.LU, esc = LU.esc, I = LU.icon;
  const head = (t, sub) => `<div class="topbar"><button class="iconbtn" data-act="back" aria-label="Back">${I('back')}</button><h1>${t}${sub ? `<span class="sub">${sub}</span>` : ''}</h1></div>`;

  /* =========================================================
     Search across every PDF. The text of each page is read once and kept on the phone.
     Scanned pages (pictures of text) have no text to read, so they are counted but cannot be searched.
     ========================================================= */
  const mem = new Map();
  const getIdx = async (id) => { if (mem.has(id)) return mem.get(id); const v = await LU.idb.get('snaps', 'idx:' + id).catch(() => null); if (v) mem.set(id, v); return v; };
  let building = null;
  LU.buildIndex = async (onProg) => {
    const docs = LU.docs().slice(); let i = 0;
    for (const d of docs) {
      i++;
      if (building && building.stop) break;
      const have = await getIdx(d.id);
      if (have && have.pages === d.pages) { onProg && onProg(i, docs.length, d.name); continue; }
      onProg && onProg(i, docs.length, d.name);
      let pdf; try { pdf = await LU.openDoc(d.id); } catch (e) { continue; }
      const pages = []; let scanned = 0;
      for (let p = 1; p <= pdf.numPages; p++) {
        if (building && building.stop) return;
        let t = '';
        try { const pg = await pdf.getPage(p), tc = await pg.getTextContent(); t = tc.items.map((x) => x.str).join(' ').replace(/\s+/g, ' ').trim(); pg.cleanup && pg.cleanup(); } catch (e) {}
        if (t.length < 20) scanned++;
        pages.push(t);
        if (p % 10 === 0) await new Promise((r) => setTimeout(r, 0));
      }
      const v = { pages: d.pages, text: pages, scanned };
      mem.set(d.id, v); await LU.idb.put('snaps', 'idx:' + d.id, v).catch(() => {});
    }
  };
  const snippet = (t, i, q) => { const a = Math.max(0, i - 50), b = Math.min(t.length, i + q.length + 70); return (a ? '…' : '') + t.slice(a, b) + (b < t.length ? '…' : ''); };
  let sq = '', results = null, prog = '';
  LU.views.psearch = {
    render() {
      const docs = LU.docs();
      return head('Search PDFs', 'Across all your notes') + `
        <div class="search">${I('search')}<input id="psq" type="text" placeholder="Word or phrase" value="${esc(sq)}" autocomplete="off"></div>
        <button class="btn block" data-act="psGo" style="margin-top:8px">${I('search')}Search</button>${LU.aiKey() ? `<button class="btn ghost block" data-act="psRead" style="margin-top:8px">${I('star')}Read scanned pages with AI</button>` : ''}<div id="psInfo" class="small muted" style="margin:8px 2px">${esc(prog)}</div>
        <div id="psRes">${results ? renderRes() : `<div class="card small muted">${docs.length ? 'Type a word and press search. The first time, LevelUp reads the text of your PDFs (a minute or two for big libraries).' : 'Add PDFs in Notes first.'}</div>`}</div>
        <div style="height:20px"></div>`;
    },
    mount(el) {
      const inp = LU.$('#psq', el);
      inp.onkeydown = (e) => { if (e.key === 'Enter') go(); };
      inp.oninput = () => { sq = inp.value; };
    },
  };
  const renderRes = () => {
    if (!results.length) return `<div class="empty">No match for “${esc(sq)}”.</div>`;
    return `<div class="small muted" style="margin:0 2px 6px">${results.length}${results.length >= 80 ? '+' : ''} match${results.length > 1 ? 'es' : ''}</div><div class="list">${results.map((r) => `<div class="li" data-act="psOpen" data-id="${r.id}" data-pg="${r.pg}"><div class="grow"><div class="lt">${esc(r.name)} · p ${r.pg}</div><div class="ls" style="white-space:normal">${r.sn}</div></div><span class="chev">${I('chev')}</span></div>`).join('')}</div>`;
  };
  const go = async () => {
    const inp = document.getElementById('psq'); if (!inp) return; sq = inp.value.trim(); if (sq.length < 2) { LU.toast('Type at least 2 letters.'); return; }
    const info = document.getElementById('psInfo'); building = { stop: false };
    try { await LU.buildIndex((i, n, nm) => { if (info) info.textContent = 'Reading PDFs ' + i + ' of ' + n + ': ' + nm; }); } catch (e) {}
    building = null;
    const q = sq.toLowerCase(), out = []; let scanned = 0, pagesN = 0;
    for (const d of LU.docs()) {
      const ix = await getIdx(d.id); if (!ix) continue; scanned += ix.scanned || 0; pagesN += ix.text.length;
      for (let p = 0; p < ix.text.length && out.length < 80; p++) {
        const t = ix.text[p], i = t.toLowerCase().indexOf(q);
        if (i >= 0) out.push({ id: d.id, name: d.name, pg: p + 1, sn: esc(snippet(t, i, q)).replace(new RegExp(esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), (m) => `<mark>${m}</mark>`) });
      }
      if (out.length >= 80) break;
    }
    results = out;
    prog = scanned ? scanned + ' of ' + pagesN + ' pages are pictures of text (scans). Their words cannot be searched.' : '';
    LU.render();
  };
  LU.actions.openPSearch = () => { results = null; prog = ''; LU.push('psearch'); };
  LU.actions.psOpen = (el) => LU.openReader(el.dataset.id, { page: +el.dataset.pg });
  LU.actions.psGo = () => go();

  /* read scanned pages with Gemini (page picture in, text out). One page per call, spaced out for the free limit. */
  let reading = null;
  LU.actions.psRead = async () => {
    if (reading) { reading.stop = true; return; }
    if (!LU.aiKey()) { LU.toast('Add your Gemini key in AI helper first.'); LU.push('aikey'); return; }
    const info = document.getElementById('psInfo'); reading = { stop: false }; let done = 0, err = '';
    const btn = document.querySelector('[data-act=psRead]'); if (btn) btn.textContent = 'Stop reading';
    try { await LU.buildIndex((i, n, nm) => { if (info) info.textContent = 'Reading text of PDFs ' + i + ' of ' + n + ': ' + nm; }); } catch (e) {}
    outer: for (const d of LU.docs()) {
      const ix = await getIdx(d.id); if (!ix) continue; ix.tried = ix.tried || [];
      for (let p = 1; p <= ix.text.length; p++) {
        if (reading.stop) break outer;
        if ((ix.text[p - 1] || '').length >= 20 || ix.tried.includes(p)) continue;
        if (info) info.textContent = 'AI is reading ' + d.name + ' page ' + p + ' (' + done + ' done). Tap Stop reading to pause.';
        try {
          const im = await LU.pageImage(d.id, p, 1100);
          const t = await LU.ai('Transcribe all printed or handwritten text on this page. Reply with the text only. If the page has no text reply with exactly: (blank)', { images: [im], temp: 0 });
          ix.text[p - 1] = /^\(blank\)$/i.test(t.trim()) ? '' : t.replace(/\s+/g, ' ').trim(); ix.tried.push(p); done++;
          ix.scanned = ix.text.filter((x, i) => (x || '').length < 20 && !ix.tried.includes(i + 1)).length;
          if (done % 5 === 0) await LU.idb.put('snaps', 'idx:' + d.id, ix).catch(() => {});
        } catch (e) { err = e.message || 'Stopped.'; if (e.code === 'nokey') LU.push('aikey'); break outer; }
        await new Promise((r) => setTimeout(r, 4500));
      }
      await LU.idb.put('snaps', 'idx:' + d.id, ix).catch(() => {});
    }
    reading = null;
    for (const d of LU.docs()) { const ix = mem.get(d.id); if (ix) await LU.idb.put('snaps', 'idx:' + d.id, ix).catch(() => {}); }
    prog = done + ' scanned page' + (done === 1 ? '' : 's') + ' read.' + (err ? ' Stopped: ' + err : ' You can search them now.');
    LU.render();
  };
  /* indexes of deleted PDFs */
  const baseDel = LU.deleteDoc;
  LU.deleteDoc = async (id) => { await baseDel(id); mem.delete(id); LU.idb.del('snaps', 'idx:' + id).catch(() => {}); };

  /* =========================================================
     Previous-year questions (PYQ), tagged by syllabus topic
     ========================================================= */
  const Q = () => { const s = LU.state; if (!Array.isArray(s.pyq)) s.pyq = []; return s.pyq; };
  const topicName = (id) => { const n = LU.node(id); return n ? n.t : '(removed topic)'; };
  let tab = 'freq', fsubj = '';
  const allLeaves = () => LU.syllabus.flatMap((s) => LU.subjLeaves(s).map((l) => ({ id: l.i, t: l.t, subj: s.id, sn: s.name })));
  LU.views.pyq = {
    render() {
      const list = Q().filter((q) => !fsubj || q.subj === fsubj);
      const by = {}; list.forEach((q) => { (by[q.node] = by[q.node] || []).push(q); });
      const rows = Object.keys(by).map((id) => ({ id, qs: by[id], yrs: Array.from(new Set(by[id].map((q) => q.yr))).sort() })).sort((a, b) => b.qs.length - a.qs.length);
      const used = Array.from(new Set(Q().map((q) => q.subj)));
      return head('Previous-year questions', Q().length + ' saved') + `
        <button class="btn block" data-act="pqAdd">${I('plus')}Add questions</button>
        <div class="seg" style="margin:12px 0"><button type="button" data-act="pqTab" data-t="freq" class="${tab === 'freq' ? 'on' : ''}">By topic</button><button type="button" data-act="pqTab" data-t="all" class="${tab === 'all' ? 'on' : ''}">All questions</button></div>
        ${used.length > 1 ? `<div class="chips"><button class="chip ${fsubj ? '' : 'on'}" data-act="pqSubj" data-s="">All</button>${used.map((s) => `<button class="chip ${fsubj === s ? 'on' : ''}" data-act="pqSubj" data-s="${s}">${esc((LU.subject(s) || { name: s }).name)}</button>`).join('')}</div>` : ''}
        ${tab === 'freq'
          ? `<div class="list">${rows.map((r) => `<div class="li" data-act="pqTopic" data-id="${r.id}"><div class="grow"><div class="lt">${esc(topicName(r.id))}</div><div class="ls">${r.yrs.join(', ')}${LU.isDone(r.id) ? ' · done' : ' · not done yet'}</div></div><b class="num">${r.qs.length}×</b></div>`).join('') || `<div class="li"><div class="grow small muted">No questions yet. Add some and tag the topic. The topics asked most often show up first.</div></div>`}</div>`
          : `<div class="list">${list.slice().sort((a, b) => b.yr - a.yr).map((q) => `<div class="li" data-act="pqEdit" data-id="${q.id}"><div class="grow"><div class="lt" style="white-space:normal">${esc(q.q)}</div><div class="ls">${q.yr} · ${esc(q.ex)} · ${esc(topicName(q.node))}</div></div><span class="chev">${I('chev')}</span></div>`).join('') || `<div class="li"><div class="grow small muted">Nothing saved.</div></div>`}</div>`}
        <div style="height:20px"></div>`;
    },
  };
  LU.actions.openPYQ = () => LU.push('pyq');
  LU.actions.pqTab = (el) => { tab = el.dataset.t; LU.render(); };
  LU.actions.pqSubj = (el) => { fsubj = el.dataset.s; LU.render(); };
  LU.actions.pqTopic = (el) => {
    const id = el.dataset.id, l = Q().filter((q) => q.node === id).sort((a, b) => b.yr - a.yr);
    LU.sheet({ title: topicName(id), body: `<div class="list">${l.map((q) => `<div class="li" data-act="pqEdit" data-id="${q.id}"><div class="grow"><div class="lt" style="white-space:normal">${esc(q.q)}</div><div class="ls">${q.yr} · ${esc(q.ex)}</div></div></div>`).join('')}</div>` });
  };
  const pick = { node: '', yr: new Date().getFullYear() - 1, ex: 'Prelims' };
  const sheet = (q) => {
    const isNew = !q.id; let node = q.node || pick.node;
    LU.sheet({
      title: isNew ? 'Add questions' : 'Edit question',
      body: `<div class="field"><label>${isNew ? 'Question(s). One per line, or paste several' : 'Question'}</label><textarea class="inp" id="pqT" rows="${isNew ? 4 : 5}" maxlength="3000" placeholder="Paste the question text">${esc(q.q || '')}</textarea></div>
        <div style="display:flex;gap:10px"><div class="field" style="flex:1"><label>Year</label><input class="inp" id="pqY" type="number" inputmode="numeric" min="1990" max="2100" value="${q.yr || pick.yr}"></div>
        <div class="field" style="flex:1"><label>Exam</label><select class="inp" id="pqE">${['Prelims', 'Mains GS', 'Optional', 'Other'].map((x) => `<option ${(q.ex || pick.ex) === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div></div>
        <div class="field"><label>Topic</label><div id="pqSel" class="small" style="margin-bottom:6px">${node ? esc(topicName(node)) : '<span class="muted">Not chosen. Search below.</span>'}</div><input class="inp" id="pqS" placeholder="Search a topic, e.g. fundamental rights" autocomplete="off">${LU.aiTagTopic && LU.aiKey() ? `<button class="btn ghost sm" id="pqAi" type="button" style="margin-top:6px">${I('star')}Suggest topic with AI</button>` : ''}<div id="pqL" class="list" style="margin-top:6px;max-height:190px;overflow:auto"></div></div>`,
      foot: `${isNew ? `<button class="btn ghost" data-act="closeSheet">Cancel</button>` : `<button class="btn danger" id="pqD">Delete</button>`}<button class="btn" id="pqOk">Save</button>`,
      mount: (s) => {
        const L = LU.$('#pqL', s), S = LU.$('#pqS', s), all = allLeaves();
        S.oninput = () => {
          const w = S.value.trim().toLowerCase().split(/\s+/).filter(Boolean); if (!w.length) { L.innerHTML = ''; return; }
          const m = all.filter((x) => w.every((t) => (x.t + ' ' + x.sn).toLowerCase().includes(t))).slice(0, 25);
          L.innerHTML = m.map((x) => `<div class="li" data-pick="${x.id}"><div class="grow"><div class="lt" style="white-space:normal">${esc(x.t)}</div><div class="ls">${esc(x.sn)}</div></div></div>`).join('') || '<div class="li"><div class="grow small muted">No topic found.</div></div>';
        };
        const ai = LU.$('#pqAi', s);
        if (ai) ai.onclick = async () => {
          const txt = LU.$('#pqT', s).value.trim().split(/\n+/)[0]; if (!txt) { LU.toast('Write the question first.'); return; }
          const m = await LU.aiTagTopic(txt); if (!m) return;
          L.innerHTML = m.map((x) => `<div class="li" data-pick="${x.id}"><div class="grow"><div class="lt" style="white-space:normal">${esc(x.t)}</div><div class="ls">${esc(x.sn)}</div></div></div>`).join('') || '<div class="li"><div class="grow small muted">AI could not match a topic. Search by hand.</div></div>';
        };
        L.onclick = (e) => { const r = e.target.closest('[data-pick]'); if (!r) return; node = r.dataset.pick; LU.$('#pqSel', s).textContent = topicName(node); L.innerHTML = ''; S.value = ''; };
        LU.$('#pqOk', s).onclick = () => {
          const txt = LU.$('#pqT', s).value.trim(), yr = parseInt(LU.$('#pqY', s).value, 10), ex = LU.$('#pqE', s).value;
          if (!txt) { LU.toast('Write the question.'); return; } if (!(yr >= 1990)) { LU.toast('Enter the year.'); return; } if (!node) { LU.toast('Choose a topic.'); return; }
          const subj = (LU.subjOf(node) || {}).id || '';
          pick.node = node; pick.yr = yr; pick.ex = ex;
          if (isNew) txt.split(/\n+/).map((x) => x.trim()).filter((x) => x.length > 3).forEach((x) => Q().push({ id: LU.uid(), q: x, yr, ex, node, subj }));
          else Object.assign(Q().find((x) => x.id === q.id) || {}, { q: txt, yr, ex, node, subj });
          LU.save(); LU.closeSheet(); LU.render();
        };
        const dl = LU.$('#pqD', s); if (dl) dl.onclick = () => { LU.state.pyq = Q().filter((x) => x.id !== q.id); LU.save(); LU.closeSheet(); LU.render(); };
      },
    });
  };
  LU.actions.pqAdd = () => sheet({});
  LU.actions.pqEdit = (el) => { const q = Q().find((x) => x.id === el.dataset.id); if (q) { LU.closeSheet(true); setTimeout(() => sheet(q), 50); } };

  const prev = LU.more3;
  LU.more3 = () => `
      <div class="sec-title">Exam prep</div>
      <div class="list">
        <div class="li" data-act="openPYQ"><span class="lic">${I('flag')}</span><div class="grow"><div class="lt">Previous-year questions</div><div class="ls">${Q().length} saved · see which topics repeat</div></div><span class="chev">${I('chev')}</span></div>
        <div class="li" data-act="openPSearch"><span class="lic">${I('search')}</span><div class="grow"><div class="lt">Search all PDFs</div><div class="ls">Find a word in every note you have added</div></div><span class="chev">${I('chev')}</span></div>
      </div>` + prev();
})();
