/* Study: syllabus overview, search, focus subjects; subject tree with editing */
(function () {
  const LU = window.LU, esc = LU.esc, I = LU.icon;
  let query = '';
  const openN = new Set();
  const PAPERS = [['GS1', 'GS Paper I: History, Geography, Society'], ['GS2', 'GS Paper II: Polity, Governance, IR'], ['GS3', 'GS Paper III: Economy, S&T, Environment, Security'], ['GS4', 'GS Paper IV: Ethics'], ['Optional', 'Optional: Anthropology'], ['Prelims II', 'Prelims Paper II'], ['Mains', 'Mains essay']];

  const pctTxt = (p) => (p.t ? Math.floor((p.d / p.t) * 100) : 0) + '%';
  const hl = (t, q) => { const i = t.toLowerCase().indexOf(q.toLowerCase()); if (i < 0) return esc(t); return esc(t.slice(0, i)) + '<mark>' + esc(t.slice(i, i + q.length)) + '</mark>' + esc(t.slice(i + q.length)); };

  const searchHits = () => {
    const q = query.trim().toLowerCase(); const hits = [];
    if (q.length < 2) return hits;
    for (const s of LU.syllabus) {
      for (const leaf of LU.subjLeaves(s)) { if (leaf.t.toLowerCase().includes(q)) { hits.push(leaf); if (hits.length >= 80) return hits; } }
    }
    return hits;
  };
  const hitsHtml = () => {
    const hits = searchHits();
    if (!hits.length) return `<div class="empty">${I('search')}No topic matches “${esc(query)}”.</div>`;
    return hits.map((n) => {
      const path = LU.pathOf(n.i).slice(0, -1).map((x) => x.t), sub = LU.subjOf(n.i);
      return `<div class="hit" data-act="topic" data-id="${n.i}"><div class="tn leaf" style="border:0;padding:0;flex:1;min-width:0"><span class="box ${LU.isDone(n.i) ? 'on' : ''}">${I('check')}</span><div class="tl2">${hl(n.t, query.trim())}<div class="crumb ell">${esc(sub.name)} › ${esc(path.slice(1).join(' › '))}</div></div></div></div>`;
    }).join('') + (hits.length >= 80 ? '<div class="small muted" style="padding:10px 2px">Showing the first 80 matches. Type more to narrow down.</div>' : '');
  };

  LU.views.study = {
    render() {
      const s = LU.state, pace = LU.pace(), k = LU.todayKey(), d = LU.peekDay(k) || {};
      const fg = LU.subject(s.syl.focus.gs), fo = LU.subject(s.syl.focus.opt);
      const ng = fg && LU.nextTopic(fg.id), no = fo && LU.nextTopic(fo.id);
      const studied = (d.studyMin || 0) + (d.extraMin || 0);
      let body;
      if (query.trim().length >= 2) body = `<div class="sec-title">Search results</div>${hitsHtml()}`;
      else {
        body = `
        <section class="win"><div class="win-in"><div class="win-h">SYLLABUS</div>
          <div class="pace"><div class="big num">${(pace.pct * 100).toFixed(1)}%</div><div class="grow small"><b>${LU.fmt(pace.d)} of ${LU.fmt(pace.t)}</b> GS and Anthropology micro-topics<div class="muted">${pace.diff >= 0 ? `${pace.diff} ahead of plan` : `${-pace.diff} behind plan`}. Target: ${LU.niceDate(s.settings.syllabusTarget, false)}, about ${pace.perDay} topics a day.</div></div></div>
          <div style="margin-top:12px">${LU.bar(pace.pct)}</div>
          <div class="st-foot"><div><b class="num">${LU.dur(studied)}</b><span>Studied today</span></div><div><b class="num">${d.topics || 0}</b><span>Topics today</span></div><div><b class="num">${LU.dur(LU.weekStudy())}</b><span>This week</span></div></div>
        </div></section>

        <div class="sec-title">Focus subjects <span class="muted">feed your daily quests</span></div>
        ${[['gs', 'Morning GS', fg, ng], ['opt', 'Evening optional', fo, no]].map(([slot, lbl, sub, nx]) => `
          <div class="card"><div class="row"><div class="grow"><div class="tiny muted">${lbl}</div><div style="font:700 16px var(--fd);margin-top:2px">${sub ? esc(sub.name) : 'Not set'}</div>
          <div class="small muted ell" style="margin-top:2px">${nx ? 'Next: ' + esc(nx.t) : 'All topics done'}</div></div>
          <button class="btn ghost sm" data-act="setFocus" data-slot="${slot}">Change</button></div>
          ${nx ? `<div class="row" style="margin-top:12px;gap:8px"><button class="btn sm" data-act="topicNext" data-id="${nx.i}">${I('check')}Mark next topic done</button><button class="btn ghost sm" data-act="openSubj" data-id="${sub.id}">Open</button></div>` : ''}</div>`).join('')}

        ${PAPERS.map(([p, name]) => {
          const subs = LU.syllabus.filter((x) => x.paper === p); if (!subs.length) return '';
          return `<div class="paper">${name}</div>` + subs.map((x) => { const pr = LU.subjProgress(x); return `<div class="subj" data-act="openSubj" data-id="${x.id}"><span class="sw" style="background:${x.color};box-shadow:0 0 10px ${x.color}55"></span><div class="grow"><div class="nm">${esc(x.name)}</div><div style="margin:7px 0 3px">${LU.bar(pr.pct, 'thin')}</div><div class="tiny muted">${LU.fmt(pr.d)} / ${LU.fmt(pr.t)} topics</div></div><span class="pc num">${pctTxt(pr)}</span><span class="dim">${I('chev')}</span></div>`; }).join('');
        }).join('')}
        <div style="height:16px"></div>`;
      }
      return `<div class="topbar"><h1>Study<span class="sub">${LU.phase().name} phase</span></h1></div>
        <div class="search">${I('search')}<input id="sq" type="text" enterkeyhint="search" placeholder="Search 4,500+ micro-topics" value="${esc(query)}" autocomplete="off">${query ? `<button class="iconbtn" style="width:30px;height:30px" data-act="sqClear">${I('x')}</button>` : ''}</div>${body}`;
    },
    mount(el) {
      const inp = LU.$('#sq', el); if (!inp) return;
      let t; inp.oninput = () => { clearTimeout(t); t = setTimeout(() => { query = inp.value; const pos = inp.selectionStart; LU.render(); const n = LU.$('#sq'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } }, 220); };
    },
  };
  LU.actions.sqClear = () => { query = ''; LU.render(false); };

  /* tick a topic from anywhere */
  const tick = (id, el) => {
    const n = LU.node(id); if (!n) return;
    const r = LU.toggleTopic(id); if (!r) return;
    if (r.count === 1) {
      if (r.done) { LU.sfx('done'); LU.vibrate(14); el && LU.floatXP(el, '+5 XP'); } else LU.sfx('undo');
    } else {
      LU.sfx(r.done ? 'done' : 'undo');
      const snapshot = r;
      LU.toast(`${r.done ? 'Marked' : 'Unmarked'} ${r.count} topics`, { undo: () => { LU.toggleTopic(id); if (snapshot.done) LU.leaves(n).forEach((x) => delete LU.state.syl.done[x.i]); LU.save(); LU.render(); } });
    }
    LU.render();
  };
  LU.actions.topic = (el, e) => {
    if (e.target.closest('[data-act="nodeMore"],[data-act="nodeDocs"]')) return;
    tick(el.dataset.id, el.querySelector('.box') || el);
  };
  LU.actions.topicNext = (el) => tick(el.dataset.id, el);
  LU.actions.setFocus = (el) => {
    const slot = el.dataset.slot, cur = LU.state.syl.focus[slot];
    LU.sheet({
      title: slot === 'gs' ? 'Morning GS focus' : 'Evening optional focus',
      body: `<p class="small muted" style="margin:0 0 8px">Your study quest will show the next unticked micro-topic from this subject.</p>` + LU.syllabus.map((x) => `<div class="subj" data-act="pickFocus" data-slot="${slot}" data-id="${x.id}"><span class="sw" style="background:${x.color}"></span><div class="grow nm">${esc(x.name)}<div class="tiny muted">${x.paper}</div></div>${x.id === cur ? `<span class="pill">Current</span>` : ''}</div>`).join(''),
    });
  };
  LU.actions.pickFocus = (el) => { LU.state.syl.focus[el.dataset.slot] = el.dataset.id; LU.save(); LU.closeSheet(); LU.render(); LU.toast('Focus updated'); };

  /* ---------- subject tree ---------- */
  let NODEDOCS = {};
  const pdfBtn = (n) => NODEDOCS[n.i] ? `<button class="pdfic" data-act="nodeDocs" data-id="${n.i}" aria-label="Open notes">${I('notes')}<b>${NODEDOCS[n.i]}</b></button>` : '';
  const nodeHtml = (n) => {
    const kids = n.c && n.c.length;
    if (!kids) return `<div class="tn leaf ${LU.isDone(n.i) ? 'on' : ''}" data-act="topic" data-id="${n.i}"><span class="tw"><i class="bul"></i></span><div class="tl2">${esc(n.t)}</div>${pdfBtn(n)}<button class="more" data-act="nodeMore" data-id="${n.i}" aria-label="Options">${I('dots')}</button><span class="box ${LU.isDone(n.i) ? 'on' : ''}">${I('check')}</span></div>`;
    const p = LU.nodeProgress(n), op = openN.has(n.i);
    const box = p.d === p.t ? 'on' : p.d ? 'part' : '';
    return `<div class="tn grp ${op ? 'open' : ''}" data-act="nodeOpen" data-id="${n.i}"><span class="tw">${I('chev')}</span><div class="tl2">${esc(n.t)}<div class="cnt">${p.d}/${p.t}</div></div>${pdfBtn(n)}<button class="more" data-act="nodeMore" data-id="${n.i}" aria-label="Options">${I('dots')}</button><span class="box ${box}" data-act="topicAll" data-id="${n.i}">${box === 'on' ? I('check') : ''}</span></div>${op ? `<div class="tkids">${n.c.map(nodeHtml).join('')}</div>` : ''}`;
  };

  LU.views.subject = {
    render({ id }) {
      const s = LU.subject(id);
      if (!s) return `<div class="topbar"><button class="iconbtn" data-act="back">${I('back')}</button><h1>Not found</h1></div>`;
      const pr = LU.subjProgress(s), nx = LU.nextTopic(id), f = LU.state.syl.focus;
      NODEDOCS = {}; const sdocs = LU.docs().filter((d) => d.subj === id);
      sdocs.forEach((d) => { if (d.node) NODEDOCS[d.node] = (NODEDOCS[d.node] || 0) + 1; });
      const marks = sdocs.reduce((a, d) => a + (d.marks || 0), 0);
      const notesBlk = `<div class="sec-title">Notes <span class="muted">${sdocs.length} PDF${sdocs.length === 1 ? '' : 's'}</span>${sdocs.length ? `<a class="link" data-act="revise" data-scope="subj" data-id="${id}">Revise ${marks} marks</a>` : ''}</div>
        ${sdocs.length ? `<div class="list">${sdocs.slice(0, 6).map((d) => `<div class="li" data-act="openDoc" data-id="${d.id}"><span class="lic">${I('notes')}</span><div class="grow"><div class="lt ell">${esc(d.name)}</div><div class="ls ell">${d.node && LU.node(d.node) ? esc(LU.node(d.node).t) + ' · ' : ''}${d.pages} pages${d.marks ? ' · ' + d.marks + ' marks' : ''}</div></div></div>`).join('')}${sdocs.length > 6 ? `<div class="li" data-act="tab" data-tab="notes"><div class="grow lt" style="color:var(--cyan)">See all ${sdocs.length} in Notes</div></div>` : ''}</div>`
        : `<div class="small muted" style="margin:0 2px 6px">No PDFs attached yet. Add academy notes and pick ${esc(s.name)} as the subject.</div><button class="btn ghost sm" data-act="addPdf">${I('plus')}Add PDF</button>`}`;
      const isFocus = f.gs === id || f.opt === id;
      return `<div class="topbar"><button class="iconbtn" data-act="back" aria-label="Back">${I('back')}</button><h1>${esc(s.name)}<span class="sub">${LU.fmt(pr.d)} / ${LU.fmt(pr.t)} topics · ${pctTxt(pr)}</span></h1></div>
        ${LU.bar(pr.pct)}
        ${nx ? `<div class="card" style="margin-top:14px"><div class="tiny muted">Continue from</div><div class="row" style="margin-top:4px"><div class="grow"><div style="font:600 15px/1.35 Inter">${esc(nx.t)}</div><div class="crumb">${esc(LU.pathOf(nx.i).slice(0, -1).map((x) => x.t).join(' › '))}</div></div><button class="chk" data-act="topicNext" data-id="${nx.i}" aria-label="Mark done">${I('check')}</button></div></div>` : `<div class="card" style="margin-top:14px">${I('star')} Every topic in ${esc(s.name)} is ticked.</div>`}
        <div class="row" style="gap:8px;margin:4px 0 2px">${isFocus ? `<span class="pill">Focus subject</span>` : `<button class="btn ghost sm" data-act="focusThis" data-id="${id}">Make this my ${s.paper === 'Optional' ? 'evening' : 'morning'} focus</button>`}<span class="grow"></span><button class="btn ghost sm" data-act="openAll" data-id="${id}">${openN.has('all:' + id) ? 'Collapse' : 'Expand'} all</button></div>
        ${notesBlk}
        <div class="sec-title">Syllabus</div>
        ${(s.c || []).map((sec) => {
          const p = LU.nodeProgress(sec), op = openN.has(sec.i);
          return `<div class="secblk"><div class="sechead ${op ? 'open' : ''}" data-act="nodeOpen" data-id="${sec.i}"><span class="tw" style="transform:rotate(${op ? 90 : 0}deg)">${I('chev')}</span><span class="nm">${esc(sec.t)}</span><span class="small muted">${p.d}/${p.t}</span></div>
            ${op ? `<div class="tree">${(sec.c || []).map(nodeHtml).join('')}<button class="btn ghost sm" style="margin:10px 0" data-act="nodeAdd" data-id="${sec.i}">${I('plus')}Add topic</button></div>` : ''}</div>`;
        }).join('')}
        <button class="btn ghost sm" style="margin-top:16px" data-act="secAdd" data-id="${id}">${I('plus')}Add section</button>
        <div style="height:20px"></div>`;
    },
  };
  LU.actions.focusThis = (el) => { const s = LU.subject(el.dataset.id); LU.state.syl.focus[s.paper === 'Optional' ? 'opt' : 'gs'] = s.id; LU.save(); LU.render(); LU.toast(`${s.name} is now your ${s.paper === 'Optional' ? 'evening' : 'morning'} focus`); };
  LU.actions.nodeOpen = (el, e) => {
    if (e.target.closest('[data-act="topicAll"],[data-act="nodeMore"],[data-act="nodeDocs"]')) return;
    const id = el.dataset.id; openN.has(id) ? openN.delete(id) : openN.add(id); LU.sfx('tap'); LU.render();
  };
  LU.actions.topicAll = (el) => tick(el.dataset.id, el);
  LU.actions.nodeDocs = (el, e) => {
    e.stopPropagation();
    const ds = LU.docs().filter((d) => d.node === el.dataset.id);
    if (ds.length === 1) { LU.openReader(ds[0].id); return; }
    LU.sheet({ title: 'Notes for ' + LU.node(el.dataset.id).t, body: `<div class="list">${ds.map((d) => `<div class="li" data-act="dmOpen" data-id="${d.id}"><span class="lic">${I('notes')}</span><div class="grow"><div class="lt">${esc(d.name)}</div><div class="ls">${d.pages} pages</div></div></div>`).join('')}</div>` });
  };
  LU.actions.openAll = (el) => {
    const s = LU.subject(el.dataset.id), key = 'all:' + s.id, walk = (n, fn) => { if (n.c && n.c.length) { fn(n); n.c.forEach((c) => walk(c, fn)); } };
    if (openN.has(key)) { openN.delete(key); s.c.forEach((x) => walk(x, (n) => openN.delete(n.i))); }
    else { openN.add(key); s.c.forEach((x) => walk(x, (n) => openN.add(n.i))); }
    LU.render();
  };

  /* ---------- editing the syllabus ---------- */
  const own = () => { if (LU.syllabus === window.SYLLABUS) LU.syllabus = LU.clone(window.SYLLABUS); };
  const commit = () => { LU.saveSyllabus(); LU.indexSyllabus(); LU.render(); };
  const findParentList = (id) => {
    let res = null;
    const walk = (list) => { for (const n of list) { if (n.i === id) { res = list; return; } if (n.c) walk(n.c); if (res) return; } };
    LU.syllabus.forEach((s) => { if (!res) walk(s.c); });
    return res;
  };
  const textSheet = (title, val, label, onSave) => LU.sheet({
    title, body: `<div class="field"><label>${label}</label><textarea class="inp" id="tsv" rows="3">${esc(val || '')}</textarea></div>`,
    foot: `<button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn" id="tsOk">Save</button>`,
    mount: (sh) => { const t = LU.$('#tsv', sh); setTimeout(() => t.focus(), 250); LU.$('#tsOk', sh).onclick = () => { const v = t.value.trim(); if (!v) return t.focus(); LU.closeSheet(); onSave(v); }; },
  });
  LU.actions.nodeMore = (el) => {
    const id = el.dataset.id, n = LU.node(id); if (!n) return;
    const p = LU.nodeProgress(n);
    LU.sheet({
      title: n.t,
      body: `<div class="list">
        <div class="li" data-act="nmToggle" data-id="${id}"><span class="lic">${I('check')}</span><div class="grow lt">${p.d === p.t ? 'Mark as not done' : 'Mark as done'}${p.t > 1 ? ` (${p.t} topics)` : ''}</div></div>
        <div class="li" data-act="nmRename" data-id="${id}"><span class="lic">${I('edit')}</span><div class="grow lt">Rename</div></div>
        <div class="li" data-act="nmAdd" data-id="${id}"><span class="lic">${I('plus')}</span><div class="grow lt">Add a sub-topic inside</div></div>
        <div class="li" data-act="nmDel" data-id="${id}"><span class="lic" style="color:var(--red);background:rgba(255,93,122,.12)">${I('trash')}</span><div class="grow lt">Delete${p.t > 1 ? ` with ${p.t} topics` : ''}</div></div></div>`,
    });
  };
  LU.actions.nmToggle = (el) => { LU.closeSheet(); tick(el.dataset.id); };
  LU.actions.nmRename = (el) => { const id = el.dataset.id; textSheet('Rename topic', LU.node(id).t, 'Topic name', (v) => { own(); LU.indexSyllabus(); LU.node(id).t = v; commit(); }); };
  LU.actions.nmAdd = (el) => { const id = el.dataset.id; textSheet('Add sub-topic', '', 'Sub-topic name (one per line to add several)', (v) => { own(); LU.indexSyllabus(); const n = LU.node(id); n.c = n.c || []; v.split('\n').map((x) => x.trim()).filter(Boolean).forEach((t) => n.c.push({ i: 'u' + LU.uid(), t })); delete LU.state.syl.done[id]; openN.add(id); commit(); }); };
  LU.actions.nodeAdd = LU.actions.nmAdd;
  LU.actions.nmDel = (el) => {
    const id = el.dataset.id;
    LU.confirm('Delete this topic?', `“${LU.node(id).t}” and everything inside it will be removed from your syllabus.`, 'Delete', () => {
      own(); LU.indexSyllabus(); const list = findParentList(id); if (!list) return;
      const i = list.findIndex((x) => x.i === id); const [gone] = list.splice(i, 1);
      LU.leaves(gone).forEach((x) => delete LU.state.syl.done[x.i]); LU.save(); commit(); LU.toast('Topic deleted');
    }, true);
  };
  LU.actions.secAdd = (el) => { const sid = el.dataset.id; textSheet('Add section', '', 'Section name', (v) => { own(); LU.subject(sid).c.push({ i: 'u' + LU.uid(), t: v, c: [] }); commit(); }); };
})();
