/* Part 12b: flashcards with spaced repetition (own cards, highlight cards, Anthropology starter deck). */
(function () {
  const LU = window.LU, esc = LU.esc, I = LU.icon;
  const today = () => LU.todayKey();
  const head = (t, sub) => `<div class="topbar"><button class="iconbtn" data-act="back" aria-label="Back">${I('back')}</button><h1>${t}${sub ? `<span class="sub">${sub}</span>` : ''}</h1></div>`;
  const C = () => { const s = LU.state; if (!s.cards) s.cards = {}; const o = s.cards; if (!Array.isArray(o.list)) o.list = []; if (!o.xpDay) o.xpDay = {}; return o; };
  const imgs = new Map();

  /* ---------- scheduling (simple SM-2 style) ---------- */
  const label = (n) => (n < 1 ? 'today' : n === 1 ? '1 day' : n < 30 ? n + ' days' : Math.round(n / 30) + ' mo');
  const next = (c, g) => {
    let iv = c.iv || 0, ease = c.ease || 2.5;
    if (g === 0) { iv = 0; ease = Math.max(1.3, ease - 0.2); }
    else if (g === 1) iv = Math.max(1, Math.round((iv || 1) * 1.2));
    else if (g === 2) iv = !c.n ? 1 : c.n === 1 ? 3 : Math.max(iv + 1, Math.round(iv * ease));
    else { iv = !c.n ? 4 : Math.max(iv + 2, Math.round(iv * ease * 1.3)); ease += 0.15; }
    return { iv, ease };
  };
  LU.cardsDue = () => { const t = today(); return C().list.filter((c) => !c.due || c.due <= t); };
  const grade = (c, g) => {
    const r = next(c, g), t = today();
    c.iv = r.iv; c.ease = r.ease; c.n = g === 0 ? 0 : (c.n || 0) + 1; c.due = LU.addDays(t, r.iv); c.last = t;
    if (g === 0) c.lapse = (c.lapse || 0) + 1;
    const x = C().xpDay; if ((x[t] || 0) < 30) { x[t] = (x[t] || 0) + 1; LU.gainXP(1); }
    LU.save();
  };

  LU.cardsAdd = (deck, arr) => {
    let n = 0;
    (arr || []).forEach((x) => { const f = String(x.f || x.q || '').trim(), b = String(x.b || x.a || '').trim(); if (f && b) { C().list.push({ id: LU.uid(), deck, f: f.slice(0, 400), b: b.slice(0, 1200), iv: 0, ease: 2.5, n: 0, due: '' }); n++; } });
    if (n) LU.save(); return n;
  };

  /* ---------- decks ---------- */
  const deckNames = () => Array.from(new Set(C().list.map((c) => c.deck))).sort();
  const stats = (deck) => { const l = C().list.filter((c) => c.deck === deck), t = today(); return { n: l.length, due: l.filter((c) => !c.due || c.due <= t).length }; };
  const anthroAdded = () => { const have = new Set(C().list.map((c) => c.key).filter(Boolean)); return (window.ANTHRO_DECK || []).every((r) => have.has('an:' + r[1])); };
  const addAnthro = () => {
    const have = new Set(C().list.map((c) => c.key).filter(Boolean)); let n = 0;
    (window.ANTHRO_DECK || []).forEach((r) => { const key = 'an:' + r[1]; if (have.has(key)) return; C().list.push({ id: LU.uid(), deck: 'Anthropology · ' + r[0], f: r[1], b: r[2], key, iv: 0, ease: 2.5, n: 0, due: '' }); n++; });
    LU.save(); return n;
  };
  LU.views.cards = {
    render() {
      const dd = LU.cardsDue().length, names = deckNames();
      return head('Flashcards', 'Spaced repetition') + `
        <div class="card" style="text-align:center"><div class="small muted">Due now</div><div style="font:800 34px var(--fd)">${dd}</div>
          <button class="btn block" style="margin-top:10px" data-act="fcRun" data-deck="" ${dd ? '' : 'disabled'}>${I('play')}Study all due</button></div>
        <div class="sec-title">Decks <a class="link" data-act="cdAdd" data-deck="">New card</a></div>
        <div class="list">${names.map((n) => { const s = stats(n); return `<div class="li" data-act="openDeck" data-deck="${esc(n)}"><span class="lic">${I('book')}</span><div class="grow"><div class="lt">${esc(n)}</div><div class="ls">${s.n} cards · ${s.due} due</div></div><span class="chev">${I('chev')}</span></div>`; }).join('') || `<div class="li"><div class="grow small muted">No cards yet. Add one, add the Anthropology deck, or tap “+ Card” on any highlight in Revision mode.</div></div>`}</div>
        ${anthroAdded() ? '' : `<button class="btn ghost block" style="margin-top:12px" data-act="cdAnthro">${I('plus')}Add Anthropology starter deck (${(window.ANTHRO_DECK || []).length} cards)</button>`}
        <div class="card small muted" style="margin-top:12px">Pick Again, Hard, Good or Easy after each card. The next time you see it depends on your answer. You get 1 XP per card reviewed (up to 30 a day).</div><div style="height:20px"></div>`;
    },
  };
  LU.actions.openCards = () => LU.push('cards');
  LU.actions.cdAnthro = () => { const n = addAnthro(); LU.toast(n + ' Anthropology cards added.', { sys: false }); LU.render(); };

  LU.views.deck = {
    render(p) {
      const l = C().list.filter((c) => c.deck === p.deck), s = stats(p.deck);
      return head(esc(p.deck), s.n + ' cards · ' + s.due + ' due') + `
        <div style="display:flex;gap:10px"><button class="btn block" data-act="fcRun" data-deck="${esc(p.deck)}" ${s.due ? '' : 'disabled'}>${I('play')}Study ${s.due} due</button><button class="btn ghost block" data-act="cdAdd" data-deck="${esc(p.deck)}">${I('plus')}Add card</button></div>
        <div class="list" style="margin-top:12px">${l.map((c) => `<div class="li" data-act="cdEdit" data-id="${c.id}"><div class="grow"><div class="lt">${c.img ? '[Highlight] ' : ''}${esc((c.f || '').slice(0, 70)) || 'Image card'}</div><div class="ls">${c.due ? 'Due ' + LU.niceDate(c.due) : 'New'}</div></div><span class="chev">${I('chev')}</span></div>`).join('')}</div><div style="height:20px"></div>`;
    },
  };
  LU.actions.openDeck = (el) => LU.push('deck', { deck: el.dataset.deck });

  /* ---------- add / edit ---------- */
  const editor = (c, deck) => {
    const isNew = !c.id, ds = deckNames();
    LU.sheet({
      title: isNew ? 'New flashcard' : 'Edit flashcard',
      body: `<div class="field"><label>Deck</label><input class="inp" id="cdDk" list="cdDl" maxlength="40" value="${esc(c.deck || deck || 'My cards')}"><datalist id="cdDl">${ds.map((d) => `<option value="${esc(d)}">`).join('')}</datalist></div>
        ${c.img ? '<div class="small muted" style="margin-bottom:8px">This card shows your highlighted snapshot on the front.</div>' : `<div class="field"><label>Front (question)</label><textarea class="inp" id="cdF" rows="2" maxlength="400">${esc(c.f || '')}</textarea></div>`}
        <div class="field"><label>Back (answer)</label><textarea class="inp" id="cdB" rows="4" maxlength="1200">${esc(c.b || '')}</textarea></div>`,
      foot: `${isNew ? `<button class="btn ghost" data-act="closeSheet">Cancel</button>` : `<button class="btn danger" id="cdDel">Delete</button>`}<button class="btn" id="cdOk">Save</button>`,
      mount: (s) => {
        LU.$('#cdOk', s).onclick = () => {
          const deck = LU.$('#cdDk', s).value.trim() || 'My cards', f = c.img ? '' : LU.$('#cdF', s).value.trim(), b = LU.$('#cdB', s).value.trim();
          if (!c.img && (!f || !b)) { LU.toast('Write both the question and the answer.'); return; }
          if (isNew) C().list.push({ id: LU.uid(), deck, f, b, iv: 0, ease: 2.5, n: 0, due: '' }); else Object.assign(C().list.find((x) => x.id === c.id) || {}, { deck, f, b });
          LU.save(); LU.closeSheet(); LU.render();
        };
        const dl = LU.$('#cdDel', s); if (dl) dl.onclick = () => { C().list = C().list.filter((x) => x.id !== c.id); if (c.img) LU.idb.del('snaps', 'card:' + c.id).catch(() => {}); LU.save(); LU.closeSheet(); LU.render(); };
      },
    });
  };
  LU.actions.cdAdd = (el) => editor({}, el.dataset.deck);
  LU.actions.cdEdit = (el) => { const c = C().list.find((x) => x.id === el.dataset.id); if (c) editor(c); };

  /* a card from a highlight in Revision mode */
  LU.actions.fcSnap = async (el) => {
    const it = (LU._revItems || [])[+el.dataset.ck]; if (!it || it.kind !== 'snap') return;
    try {
      const url = await LU.snapshotFor(it), id = LU.uid(), d = it.d, subj = d.subj && LU.subject(d.subj);
      const deck = 'Highlights · ' + (subj ? subj.name : d.subj === 'qp' ? 'Question papers' : 'Unsorted');
      await LU.idb.put('snaps', 'card:' + id, url);
      C().list.push({ id, deck, f: '', b: '', img: 1, doc: d.id, pg: it.pg, node: d.node || '', iv: 0, ease: 2.5, n: 0, due: '' });
      LU.save(); LU.toast('Flashcard added to “' + deck + '”.', { sys: false });
    } catch (e) { LU.toast('Could not make the card.'); }
  };

  /* ---------- review ---------- */
  let run = null;
  LU.actions.fcRun = (el) => {
    const deck = el.dataset.deck, t = today();
    const q = C().list.filter((c) => (!deck || c.deck === deck) && (!c.due || c.due <= t)).sort(() => Math.random() - 0.5).slice(0, 60).map((c) => c.id);
    if (!q.length) { LU.toast('Nothing due.'); return; }
    run = { q, i: 0, show: false, done: 0 }; LU.push('cardrun');
  };
  LU.views.cardrun = {
    render() {
      if (!run) return head('Flashcards') + '<div class="empty">Nothing to study.</div>';
      const c = C().list.find((x) => x.id === run.q[0]);
      if (!c) { return head('Flashcards', 'Done') + `<div class="card" style="text-align:center"><div style="font:800 24px var(--fd)">Session done</div><div class="small muted" style="margin:6px 0 12px">${run.done} card${run.done === 1 ? '' : 's'} reviewed</div><button class="btn block" data-act="back">Finish</button></div>`; }
      const front = c.img ? `<div class="rimg" id="fcImg" style="min-height:80px"></div><div class="small muted" style="margin-top:6px">What does this highlight say? Recall it, then check.</div>` : `<div style="font:700 20px/1.35 var(--fd);white-space:pre-wrap">${esc(c.f)}</div>`;
      const btn = (g, name) => `<button class="btn ${g === 0 ? 'danger' : 'ghost'}" data-act="fcGrade" data-g="${g}" style="flex:1;display:block;padding:8px 2px"><div>${name}</div><div class="tiny" style="opacity:.7">${label(g === 0 ? 0 : next(c, g).iv)}</div></button>`;
      return head('Flashcards', run.q.length + ' left · ' + esc(c.deck)) + `<div class="card">${front}${run.show ? `<hr style="border:0;border-top:1px solid var(--line,#2a3140);margin:14px 0"><div style="white-space:pre-wrap;line-height:1.5">${c.b ? esc(c.b) : '<span class="muted">(no note on the back)</span>'}</div>` : ''}</div>
        ${run.show ? `<div style="display:flex;gap:8px;margin-top:12px">${btn(0, 'Again')}${btn(1, 'Hard')}${btn(2, 'Good')}${btn(3, 'Easy')}</div>` : `<button class="btn block" style="margin-top:12px" data-act="fcShow">Show answer</button>`}`;
    },
    mount() {
      if (!run) return; const c = C().list.find((x) => x.id === run.q[0]), box = document.getElementById('fcImg');
      if (c && c.img && box) LU.idb.get('snaps', 'card:' + c.id).then((u) => { if (box.isConnected) box.innerHTML = u ? `<img src="${u}" alt="Highlighted text" style="width:100%;border-radius:8px">` : '<span class="muted">Snapshot missing</span>'; }).catch(() => {});
    },
  };
  LU.actions.fcShow = () => { if (run) { run.show = true; LU.render(false); } };
  LU.actions.fcGrade = (el) => {
    if (!run) return; const g = +el.dataset.g, id = run.q.shift(), c = C().list.find((x) => x.id === id);
    if (c) { grade(c, g); run.done++; if (g === 0) run.q.splice(Math.min(3, run.q.length), 0, id); }
    run.show = false; LU.sfx && LU.sfx('tap'); LU.render(false);
  };

  /* ---------- Quests card + Study tools ---------- */
  const baseExtras = LU.questExtras;
  LU.questExtras = (k) => {
    const base = baseExtras ? baseExtras(k) : '';
    if (k !== today()) return base;
    const n = LU.cardsDue().length; if (!n) return base;
    return `<div class="card tap" data-act="openCards" style="display:flex;align-items:center;gap:12px"><span class="lic">${I('book')}</span><div class="grow"><div class="lt">Flashcards</div><div class="small muted">${n} card${n > 1 ? 's' : ''} due for review</div></div><span class="chev">${I('chev')}</span></div>` + base;
  };
  const prev = LU.more3;
  LU.more3 = () => `
      <div class="sec-title">Flashcards</div>
      <div class="list"><div class="li" data-act="openCards"><span class="lic">${I('book')}</span><div class="grow"><div class="lt">Flashcards</div><div class="ls">${LU.cardsDue().length} due · your cards, highlights, Anthropology deck</div></div><span class="chev">${I('chev')}</span></div></div>` + prev();
})();
