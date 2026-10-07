/* Part 10: MCQ practice. Paste or type questions, practise one by one, see weak topics. All offline. */
(function () {
  const LU = window.LU, esc = LU.esc, I = LU.icon;
  const Q = () => { const s = LU.state; s.mcq = Object.assign({ sets: [], log: [], stat: {}, wrong: {} }, s.mcq || {}); return s.mcq; };
  const L = ['A', 'B', 'C', 'D', 'E'];
  const today = () => LU.todayKey();

  /* ---------- reading pasted text ----------
     Q: question text            (a number or "Q1." also works)
     A) option  B) option  C) option  D) option
     Ans: B
     Exp: why (optional)    Tag: Polity (optional)
     Leave a blank line between questions. */
  LU.mcqParse = (text) => {
    const out = []; let skipped = 0;
    String(text || '').replace(/\r/g, '').split(/\n\s*\n+/).forEach((blk) => {
      const lines = blk.split('\n').map((l) => l.trim()).filter(Boolean);
      if (!lines.length) return;
      const q = [], o = [], r = { e: '', tag: '', a: -1 };
      let mode = 'q';
      lines.forEach((ln) => {
        let m;
        if ((m = ln.match(/^(?:ans(?:wer)?|correct(?: answer)?)\s*[:\-.]?\s*\(?([a-eA-E])\)?\b/i))) { r.a = L.indexOf(m[1].toUpperCase()); mode = 'x'; }
        else if ((m = ln.match(/^(?:exp(?:lanation)?|why|note)\s*[:\-]\s*(.*)$/i))) { r.e = m[1]; mode = 'e'; }
        else if ((m = ln.match(/^(?:tag|subject|topic)\s*[:\-]\s*(.*)$/i))) { r.tag = m[1].trim(); mode = 'x'; }
        else if ((m = ln.match(/^\(?([a-eA-E])[\).:]\s+(.*)$/))) { o.push(m[2].trim()); mode = 'o'; }
        else if (mode === 'q') q.push(ln);
        else if (mode === 'o' && o.length) o[o.length - 1] += ' ' + ln;
        else if (mode === 'e') r.e += ' ' + ln;
      });
      const qt = q.join(' ').replace(/^(?:q(?:uestion)?\s*)?\d*\s*[\).:\-]?\s*/i, '').trim();
      if (qt && o.length >= 2 && r.a >= 0 && r.a < o.length) out.push({ id: LU.uid() + out.length, q: qt, o, a: r.a, e: r.e.trim(), tag: r.tag });
      else skipped++;
    });
    return { qs: out, skipped };
  };

  const weakTags = () => Object.entries(Q().stat).filter(([, v]) => v.n >= 3).map(([t, v]) => ({ t, n: v.n, p: Math.round((v.ok / v.n) * 100) })).sort((a, b) => a.p - b.p);
  const wrongCount = () => Object.keys(Q().wrong).length;

  LU.views.mcq = {
    render() {
      const m = Q(), wk = weakTags(), logs = m.log.slice(0, 6);
      return `<div class="topbar"><button class="iconbtn" data-act="back">${I('back')}</button><h1>Practice MCQs<span class="sub">Your own questions, offline</span></h1></div>
        <div style="display:flex;gap:8px"><button class="btn block" data-act="mqImport">${I('upload')}Paste questions</button><button class="btn ghost block" data-act="mqOne">${I('plus')}Add one</button></div>
        ${wrongCount() ? `<div class="card tap" data-act="mqStart" data-id="wrong" style="margin-top:12px;display:flex;align-items:center;gap:12px"><span class="lic">${I('target')}</span><div class="grow"><div class="lt">Practise questions I got wrong</div><div class="small muted">${wrongCount()} waiting</div></div><span class="chev">${I('chev')}</span></div>` : ''}
        <div class="sec-title">My question sets</div>
        <div class="list">${m.sets.map((s) => `<div class="li" data-act="mqSet" data-id="${s.id}"><span class="lic">${I('list')}</span><div class="grow"><div class="lt">${esc(s.name)}</div><div class="ls">${s.qs.length} question${s.qs.length === 1 ? '' : 's'}${s.last != null ? ' · last ' + s.last + '%' : ''}</div></div><span class="chev">${I('chev')}</span></div>`).join('') || `<div class="li"><div class="grow small muted">No sets yet. Tap “Paste questions” and follow the format shown.</div></div>`}</div>
        ${wk.length ? `<div class="sec-title">Weak topics (needs 3+ answers)</div><div class="card">${wk.slice(0, 8).map((w) => `<div style="margin:6px 0"><div style="display:flex;justify-content:space-between"><span class="small">${esc(w.t)} <span class="muted">· ${w.n} answered</span></span><b class="num">${w.p}%</b></div>${LU.bar(w.p / 100, w.p < 50 ? 'red' : w.p < 70 ? 'gold' : 'thin')}</div>`).join('')}</div>` : ''}
        ${logs.length ? `<div class="sec-title">Recent practice</div><div class="list">${logs.map((g) => `<div class="li"><div class="grow"><div class="lt">${esc(g.name)}</div><div class="ls">${LU.niceDate(g.k)}</div></div><b class="num">${g.ok}/${g.n}</b></div>`).join('')}</div>` : ''}
        <div style="height:20px"></div>`;
    },
  };
  LU.actions.openMcq = () => LU.push('mcq');

  /* ---------- import / add ---------- */
  LU.actions.mqImport = () => LU.sheet({
    title: 'Paste questions',
    body: `<div class="field"><label>Name of this set</label><input class="inp" id="mqN" maxlength="40" placeholder="e.g. Polity test 1"></div>
      <div class="field"><label>Questions</label><textarea class="inp" id="mqT" style="min-height:190px" placeholder="Q1. Which Article deals with equality before law?&#10;A) Article 12&#10;B) Article 14&#10;C) Article 19&#10;D) Article 21&#10;Ans: B&#10;Exp: Article 14 gives equality before law.&#10;Tag: Polity&#10;&#10;Q2. ..."></textarea></div>
      <p class="small muted">Put a blank line between questions. Each needs options A, B, C, D and a line “Ans: B”. “Exp:” and “Tag:” are optional.</p>`,
    foot: `<button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn" id="mqOk">Import</button>`,
    mount: (s) => {
      LU.$('#mqOk', s).onclick = () => {
        const r = LU.mcqParse(LU.$('#mqT', s).value);
        if (!r.qs.length) { LU.toast(r.skipped ? 'No question had options and an answer line.' : 'Paste some questions first.'); return; }
        const name = LU.$('#mqN', s).value.trim() || 'Set ' + (Q().sets.length + 1);
        const ex = Q().sets.find((x) => x.name.toLowerCase() === name.toLowerCase());
        if (ex) ex.qs = ex.qs.concat(r.qs); else Q().sets.push({ id: LU.uid(), name, qs: r.qs });
        LU.save(); LU.closeSheet(); LU.toast(r.qs.length + ' added' + (r.skipped ? ', ' + r.skipped + ' skipped (check the format)' : '') + '.'); LU.render();
      };
    },
  });
  LU.actions.mqOne = () => LU.sheet({
    title: 'Add a question',
    body: `<div class="field"><label>Set</label><input class="inp" id="m1S" maxlength="40" placeholder="Set name" value="${esc((Q().sets[0] || {}).name || 'My questions')}"></div>
      <div class="field"><label>Question</label><textarea class="inp" id="m1Q" style="min-height:70px"></textarea></div>
      ${L.slice(0, 4).map((l, i) => `<div class="field"><label>Option ${l}</label><input class="inp" id="m1o${i}" maxlength="200"></div>`).join('')}
      <div class="field"><label>Correct answer</label><div class="seg" id="m1A">${L.slice(0, 4).map((l, i) => `<button type="button" data-i="${i}" class="${i === 0 ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div class="field"><label>Explanation (optional)</label><input class="inp" id="m1E" maxlength="300"></div>
      <div class="field"><label>Topic tag (optional)</label><input class="inp" id="m1T" maxlength="30" placeholder="e.g. Polity"></div>`,
    foot: `<button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn" id="m1Ok">Save</button>`,
    mount: (s) => {
      let a = 0;
      LU.$$('#m1A button', s).forEach((b) => (b.onclick = () => { a = +b.dataset.i; LU.$$('#m1A button', s).forEach((x) => x.classList.toggle('on', x === b)); }));
      LU.$('#m1Ok', s).onclick = () => {
        const q = LU.$('#m1Q', s).value.trim(), o = [0, 1, 2, 3].map((i) => LU.$('#m1o' + i, s).value.trim());
        if (!q || o.filter(Boolean).length < 2 || !o[a]) { LU.toast('Add the question, at least two options, and mark a filled option as correct.'); return; }
        const name = LU.$('#m1S', s).value.trim() || 'My questions';
        const opts = o.filter(Boolean), ans = opts.indexOf(o[a]);
        const rec = { id: LU.uid(), q, o: opts, a: ans, e: LU.$('#m1E', s).value.trim(), tag: LU.$('#m1T', s).value.trim() };
        const ex = Q().sets.find((x) => x.name.toLowerCase() === name.toLowerCase());
        if (ex) ex.qs.push(rec); else Q().sets.push({ id: LU.uid(), name, qs: [rec] });
        LU.save(); LU.closeSheet(); LU.render();
      };
    },
  });
  LU.actions.mqSet = (el) => {
    const s = Q().sets.find((x) => x.id === el.dataset.id); if (!s) return;
    LU.sheet({
      title: s.name,
      body: `<p class="muted" style="margin:0 0 12px">${s.qs.length} questions</p>
        <div class="mini" data-act="mqStart" data-id="${s.id}" data-n="10"><span>▶</span><span class="grow">${s.id === 'mcqfolder' ? 'Practise the next 10 (unseen first)' : 'Practise 10 random questions'}</span></div>
        <div class="mini" data-act="mqStart" data-id="${s.id}" data-n="0"><span>▶</span><span class="grow">Practise all, in order</span></div>
        <div class="mini" data-act="mqRename" data-id="${s.id}"><span>✎</span><span class="grow">Rename this set</span></div>
        <div class="mini" data-act="mqDel" data-id="${s.id}"><span>✕</span><span class="grow">Delete this set</span></div>`,
    });
  };
  LU.actions.mqRename = (el) => {
    const s = Q().sets.find((x) => x.id === el.dataset.id); if (!s) return; LU.closeSheet(true);
    LU.sheet({ title: 'Rename set', body: `<div class="field"><input class="inp" id="mrN" maxlength="40" value="${esc(s.name)}"></div>`, foot: `<button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn" id="mrOk">Save</button>`,
      mount: (sh) => { LU.$('#mrOk', sh).onclick = () => { const v = LU.$('#mrN', sh).value.trim(); if (v) s.name = v; LU.save(); LU.closeSheet(); LU.render(); }; } });
  };
  LU.actions.mqDel = (el) => { const id = el.dataset.id; LU.closeSheet(true); LU.confirm('Delete this set?', 'The questions in it will be removed.', 'Delete', () => { const m = Q(); m.sets = m.sets.filter((x) => x.id !== id); LU.save(); LU.render(); }, true); };

  /* ---------- practice ---------- */
  let run = null;
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  LU.actions.mqStart = (el) => {
    const id = el.dataset.id, n = +el.dataset.n || 0, m = Q();
    let qs, name, setId = null;
    if (id === 'wrong') { qs = []; m.sets.forEach((s) => s.qs.forEach((q) => { if (m.wrong[q.id]) qs.push(q); })); name = 'Questions I got wrong'; qs = shuffle(qs).slice(0, 20); }
    else { const s = m.sets.find((x) => x.id === id); if (!s) return; setId = s.id; name = s.name; qs = s.id === 'mcqfolder' ? (n ? s.qs.slice(0, n) : s.qs.slice()) : n ? shuffle(s.qs).slice(0, n) : s.qs.slice(); }
    if (!qs.length) { LU.toast('No questions to practise.'); return; }
    run = { qs, i: 0, sel: null, ok: 0, name, setId, done: false, xp: 0 };
    LU.closeSheet(true); LU.push('mcqrun');
  };
  LU.views.mcqrun = {
    render() {
      if (!run) return `<div class="topbar"><button class="iconbtn" data-act="back">${I('back')}</button><h1>Practice</h1></div>`;
      if (run.done) {
        const p = Math.round((run.ok / run.qs.length) * 100);
        return `<div class="topbar"><button class="iconbtn" data-act="back">${I('back')}</button><h1>Finished<span class="sub">${esc(run.name)}</span></h1></div>
          <div class="card" style="text-align:center"><div style="font:800 54px var(--fd)">${run.ok}<span class="muted" style="font-size:22px"> / ${run.qs.length}</span></div><div class="lt">${p}% correct</div><div class="small muted" style="margin-top:6px">${run.xp ? '+' + run.xp + ' XP' : 'Daily MCQ XP limit reached'}</div></div>
          <button class="btn block" style="margin-top:14px" data-act="back">Done</button>`;
      }
      const q = run.qs[run.i], sel = run.sel;
      return `<div class="topbar"><button class="iconbtn" data-act="back">${I('back')}</button><h1>Question ${run.i + 1} of ${run.qs.length}<span class="sub">${esc(run.name)}${q.tag ? ' · ' + esc(q.tag) : ''}</span></h1></div>
        ${LU.bar(run.i / run.qs.length, 'thin')}
        <div class="card" style="margin-top:12px;line-height:1.5">${esc(q.q)}</div>
        <div class="list" style="margin-top:12px">${q.o.map((t, i) => {
          const st = sel == null ? '' : i === q.a ? 'style="border-color:var(--green);background:rgba(60,200,120,.14)"' : i === sel ? 'style="border-color:var(--red);background:rgba(240,80,100,.14)"' : '';
          return `<div class="li" ${sel == null ? `data-act="mqPick" data-i="${i}"` : ''} ${st}><span class="lic" style="font:700 14px var(--fd)">${L[i]}</span><div class="grow">${esc(t)}</div></div>`;
        }).join('')}</div>
        ${sel != null ? `<div class="card" style="margin-top:12px"><b>${sel === q.a ? 'Correct.' : 'Not quite. Answer: ' + L[q.a] + '.'}</b>${q.e ? `<div class="small" style="margin-top:6px;line-height:1.45">${esc(q.e)}</div>` : ''}</div>
          <button class="btn block" style="margin-top:12px" data-act="mqNext">${run.i + 1 >= run.qs.length ? 'See result' : 'Next question'}</button>` : ''}
        <div style="height:20px"></div>`;
    },
  };
  LU.actions.mqPick = (el) => {
    if (!run || run.sel != null) return;
    const q = run.qs[run.i], i = +el.dataset.i, m = Q(); run.sel = i;
    const ok = i === q.a;
    if (ok) { run.ok++; delete m.wrong[q.id]; } else m.wrong[q.id] = 1;
    if (q.tag) { const t = (m.stat[q.tag] = m.stat[q.tag] || { n: 0, ok: 0 }); t.n++; if (ok) t.ok++; }
    if (run.setId === 'mcqfolder' && LU.mcqSeen) LU.mcqSeen(q.id, ok);
    LU.vibrate && LU.vibrate(ok ? 10 : 30); LU.save(); LU.render();
  };
  LU.actions.mqNext = () => {
    if (!run) return;
    if (run.i + 1 < run.qs.length) { run.i++; run.sel = null; LU.render(false); return; }
    const m = Q(), d = LU.day(today()), cap = 40, want = run.ok * 2, give = Math.max(0, Math.min(want, cap - (d.mcqXp || 0)));
    if (give) { d.mcqXp = (d.mcqXp || 0) + give; LU.gainXP(give); LU.log('MCQ practice ' + run.ok + '/' + run.qs.length, give); }
    run.xp = give; run.done = true;
    const pct = Math.round((run.ok / run.qs.length) * 100);
    m.log.unshift({ k: today(), name: run.name, n: run.qs.length, ok: run.ok });
    if (m.log.length > 40) m.log.length = 40;
    const s = m.sets.find((x) => x.id === run.setId); if (s) s.last = pct;
    LU.save(); LU.render(false);
  };
})();
