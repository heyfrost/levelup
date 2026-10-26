/* Part 20: Reference books (printed PDFs such as the Constitution). Offline lookup of the book's own text. */
(() => {
  const LU = window.LU, esc = LU.esc, I = LU.icon;
  const refs = () => (LU.state.refs = LU.state.refs || []);
  const key = (id) => 'ref:' + id;
  const DEV = /[ऀ-ॿ]/g;
  const STOP = new Set('the and for are was were with that this from have has had not but its his her their which who whom what when where into than then them they you your our out any all can may shall will would could should been being also such these those there here about over under upon per via one two'.split(' '));
  const cache = new Map();   // book id -> { pages: [text], low: [lowercase text] }

  const FOOT = /^\d{1,3}\.\s+(Ins\.|Subs\.|Rep\.|Added|Omitted|The words|The word|The entry|The Explanation|The figures|The proviso|The letters|The expression|The marginal|The original|Certain|Cl\.|Clause|Sub-|Entry|Para|Art\.|Article|Sch\.|Renumbered|Re-numbered|See |Now |Vide|\*)/;
  const HEAD = /^(\d{1,3})([A-Z]{0,2})\.\s+\S/;

  const clean = (raw) => {
    let lines = raw.split('\n').map((l) => l.replace(DEV, '').replace(/[ \t]+/g, ' ').trim()).filter((l) => l && !/^\d{1,3}$/.test(l) && !/^[\[\]]$/.test(l));
    const out = []; let foot = false;   /* drop footnotes (Ins. by…, Subs. by…) and their wrapped lines, keep everything else */
    lines.forEach((l) => {
      if (FOOT.test(l)) { foot = true; return; }
      if (/^_{4,}$/.test(l)) return;
      if (foot && (/^\((w\.|date|ibid)/i.test(l) || /^[a-z]/.test(l) || /^(ibid|s\.|ss\.)/i.test(l))) return;
      foot = false; out.push(l);
    });
    lines = out;
    return lines.join('\n');
  };
  LU.refClean = clean;

  const load = async (b) => {
    if (cache.has(b.id)) return cache.get(b.id);
    let t = await LU.idb.get('snaps', 'reftxt:' + b.id); if (typeof t === 'string') { try { t = JSON.parse(t); } catch (e) { t = null; } } const pages = Array.isArray(t) ? t : [];
    const e = { pages, low: pages.map((x) => x.toLowerCase()) }; cache.set(b.id, e); return e;
  };

  /* ---------- adding a book ---------- */
  const busy = (msg) => {
    const d = document.createElement('div'); d.className = 'aibusy';
    d.innerHTML = `<div class="aib"><div class="aispin"></div><div id="rfMsg">${esc(msg)}</div></div>`;
    document.body.appendChild(d);
    return { set: (m) => { const x = d.querySelector('#rfMsg'); if (x) x.textContent = m; }, done: () => d.remove() };
  };
  const addBook = async (file) => {
    const name = (file.name || 'Book').replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Book';
    const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
    if (String.fromCharCode.apply(null, Array.from(head)).indexOf('%PDF') < 0) { LU.toast('“' + name + '” is not a PDF file.'); return; }
    const id = 'r' + LU.uid(), bz = busy('Reading “' + name.slice(0, 30) + '”…');
    try {
      await LU.idb.put('files', key(id), file);
      const pdf = await LU.openDoc(key(id)), N = pdf.numPages, pages = []; let chars = 0;
      for (let n = 1; n <= N; n++) {
        const pg = await pdf.getPage(n), tc = await pg.getTextContent();
        let s = ''; tc.items.forEach((it) => { s += it.str + (it.hasEOL ? '\n' : ''); });
        const c = clean(s); pages.push(c); chars += c.length; pg.cleanup && pg.cleanup();
        if (n % 5 === 0 || n === N) { bz.set(`Reading “${name.slice(0, 22)}”… page ${n} of ${N}`); await new Promise((r) => setTimeout(r, 0)); }
      }
      LU.closeDoc(key(id));
      await LU.idb.put('snaps', 'reftxt:' + id, pages);
      const b = { id, name, pages: N, size: file.size, added: Date.now(), hasText: chars > N * 120 };
      refs().push(b); LU.save(true); cache.delete(id);
      LU.toast(b.hasText ? `Added “${name}”: ${N} pages ready to search.` : `Added “${name}”, but it has almost no text (a scanned book). Search will not find much.`, { ms: 5000 });
    } catch (e) {
      try { await LU.idb.del('files', key(id)); } catch (e2) {}
      LU.toast(/password/i.test(e && e.message) ? 'That PDF is password protected.' : 'Could not read that PDF.', { ms: 4000 });
    } finally { bz.done(); }
  };
  const delBook = async (id) => {
    LU.closeDoc(key(id)); cache.delete(id);
    LU.state.refs = refs().filter((b) => b.id !== id); (LU.state.tomb = LU.state.tomb || {})[id] = Date.now(); LU.save(true);
    await Promise.all([LU.idb.del('files', key(id)), LU.idb.del('snaps', 'reftxt:' + id)]);
  };

  /* ---------- page viewer ---------- */
  const viewPage = (id, pg) => {
    const b = refs().find((x) => x.id === id); if (!b) return;
    pg = LU.clamp(pg, 1, b.pages);
    LU.sheet({
      title: b.name.slice(0, 34),
      body: `<div class="row" style="gap:8px;margin-bottom:10px"><button class="btn ghost sm" id="rvP">${I('back')}</button><input class="inp grow" id="rvN" type="number" min="1" max="${b.pages}" value="${pg}" inputmode="numeric" style="text-align:center"><span class="small muted">of ${b.pages}</span><button class="btn ghost sm" id="rvX">Go</button><button class="btn ghost sm" id="rvF">${I('right')}</button></div><div id="rvI" style="min-height:200px;text-align:center"><div class="muted small">Loading…</div></div>`,
      foot: `<button class="btn" data-act="closeSheet">Done</button>`,
      mount: (s) => {
        const go = (n) => viewPage(id, +n || 1);
        LU.$('#rvP', s).onclick = () => go(pg - 1); LU.$('#rvF', s).onclick = () => go(pg + 1); LU.$('#rvX', s).onclick = () => go(LU.$('#rvN', s).value);
        LU.pageImage(key(id), pg, 1000).then((im) => { const h = LU.$('#rvI', s); if (h) h.innerHTML = `<img alt="" src="data:${im.mime};base64,${im.data}" style="width:100%;border-radius:8px;background:#fff">`; }).catch(() => { const h = LU.$('#rvI', s); if (h) h.textContent = 'Could not show that page.'; });
      },
    });
  };

  /* ---------- searching ---------- */
  const words = (q) => Array.from(new Set((q.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length >= 3 && !STOP.has(w))));
  const artNo = (q) => { const m = q.match(/\b(?:art(?:icles?)?\b\.?\s*)(\d{1,3})\s?([A-Za-z]{0,2})\b/i); return m ? m[1] + m[2].toUpperCase() : null; };

  /* paragraphs: a new one starts at (1), (a), Provided, Explanation */
  const paras = (text) => {
    const out = []; text.split('\n').forEach((l) => {
      if (!out.length || /^\(\s?\w{1,4}\s?\)/.test(l) || /^(Provided|Explanation|Illustration)/.test(l)) out.push(l); else out[out.length - 1] += ' ' + l;
    });
    return out;
  };

  const findArticle = async (num) => {
    const bs = refs().slice().sort((a, b) => (/constitution/i.test(b.name) ? 1 : 0) - (/constitution/i.test(a.name) ? 1 : 0));
    const mm = num.match(/^(\d+)([A-Z]*)$/), want = +mm[1];
    for (const b of bs) {
      const { pages } = await load(b); const flat = [];
      pages.forEach((t, i) => t.split('\n').forEach((l) => flat.push({ p: i + 1, l })));
      for (let i = 0; i < flat.length; i++) {
        if (!flat[i].l.startsWith(num + '. ')) continue;
        let j = i + 1, joined = flat[i].l;
        while (j < flat.length && j < i + 4 && !HEAD.test(flat[j].l)) { joined += ' ' + flat[j].l; j++; }
        if (!/\.?\s?[—–]/.test(joined.slice(0, 320))) continue;       /* the contents list has no dash after the title */
        let k = i + 1;
        for (; k < flat.length && flat[k].p <= flat[i].p + 8; k++) {
          const h = flat[k].l.match(HEAD); if (!h) continue;
          const nn = +h[1]; if ((nn > want && nn <= want + 8) || (nn === want && h[2] && h[2] > mm[2])) { if (/[—–]/.test((flat[k].l + ' ' + ((flat[k + 1] || {}).l || '') + ' ' + ((flat[k + 2] || {}).l || '')).slice(0, 320))) break; }
        }
        const lines = flat.slice(i, k).map((x) => x.l.replace(/[\[\]]/g, '').trim());
        while (lines.length > 1 && lines[lines.length - 1].length < 70 && !/[.;:—,]$/.test(lines[lines.length - 1]) && !/^\(/.test(lines[lines.length - 1])) lines.pop();   /* a chapter or part heading that follows the article */
        const title = (joined.match(/^\S+\s+(.*?)\.?\s?[—–]/) || [])[1] || '';
        return { book: b, pg: flat[i].p, num, title, text: paras(lines.join('\n')).join('\n') };
      }
    }
    return null;
  };

  const search = async (q) => {
    const ws = words(q), phrase = q.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 8).join(' ');
    const hits = [];
    if (!ws.length) return hits;
    for (const b of refs()) {
      const { pages, low } = await load(b);
      low.forEach((t, i) => {
        let sc = 0, got = 0; const flat = t.replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ');
        if (phrase.length > 6 && flat.includes(phrase)) sc += 40;
        ws.forEach((w) => { const c = flat.split(w).length - 1; if (c) { got++; sc += 3 + Math.min(c, 5) * 0.5; } });
        if (got < Math.ceil(ws.length * 0.6) && sc < 40) return;
        hits.push({ book: b, pg: i + 1, score: sc + got / ws.length * 10, text: pages[i] });
      });
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, 8);
  };
  const snippet = (text, ws) => {
    const flat = text.replace(/\s+/g, ' '), low = flat.toLowerCase(); let at = -1;
    for (const w of ws.slice().sort((a, b) => b.length - a.length)) { at = low.indexOf(w); if (at >= 0) break; }
    const s = Math.max(0, at - 90); return (s ? '…' : '') + flat.slice(s, s + 260) + (s + 260 < flat.length ? '…' : '');
  };
  const mark = (html, ws) => { let h = html; ws.slice(0, 8).forEach((w) => { h = h.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark>$1</mark>'); }); return h; };

  /* ---------- results ---------- */
  const detail = (r, ws, onNote, back) => {
    const label = r.num ? `Article ${r.num}${r.title ? ' · ' + r.title : ''}` : `${r.book.name} · page ${r.pg}`;
    const ps = r.num ? r.text.split('\n') : paras(r.text);
    LU.sheet({
      title: r.num ? 'Article ' + r.num : 'Page ' + r.pg,
      body: `${back ? `<button class="btn ghost sm" id="rfBack" style="margin-bottom:8px">${I('back')}All matches</button>` : ''}<div class="small muted" style="margin-bottom:8px">${esc(r.book.name)} · page ${r.pg}${r.num && r.title ? '<br><b style="color:var(--text)">' + esc(r.title) + '</b>' : ''}</div><div class="aires">${ps.map((p) => `<p style="margin:6px 0">${mark(esc(p), r.num ? [] : ws)}</p>`).join('')}</div>`,
      foot: `<button class="btn ghost" id="rfCp">Copy</button>${onNote ? `<button class="btn ghost" id="rfNote">Note</button>` : ''}<button class="btn ghost" id="rfOpen">Page</button><button class="btn" data-act="closeSheet">Done</button>`,
      mount: (s) => {
        const plain = (r.num ? `Article ${r.num}${r.title ? ': ' + r.title : ''} (${r.book.name}, p.${r.pg})\n` : `${r.book.name}, p.${r.pg}\n`) + ps.join('\n');
        LU.$('#rfCp', s).onclick = async () => LU.toast((await LU.copyText(plain)) ? 'Copied.' : 'Could not copy.', { sys: false });
        if (onNote) LU.$('#rfNote', s).onclick = () => { LU.closeSheet(true); onNote(plain); };
        LU.$('#rfOpen', s).onclick = () => viewPage(r.book.id, r.pg);
        if (back) LU.$('#rfBack', s).onclick = back;
      },
    });
  };
  LU.refLook = async (q, onNote) => {
    q = String(q || '').trim(); if (!q) return;
    if (!refs().length) { LU.toast('Add a reference book first: Notes › Reference books.', { ms: 3500 }); return; }
    const bz = busy('Looking in your books…');
    let art = null, hits = [];
    try { const a = artNo(q); if (a) art = await findArticle(a); if (!art) hits = await search(q); } catch (e) { hits = []; } finally { bz.done(); }
    const ws = words(q);
    if (art) { detail(art, ws, onNote, null); return; }
    if (!hits.length) { LU.sheet({ title: 'Look in books', body: `<p class="muted" style="margin:0">Nothing found for “${esc(q.slice(0, 80))}” in ${refs().length} book${refs().length === 1 ? '' : 's'}.</p>`, foot: `<button class="btn" data-act="closeSheet">Done</button>` }); return; }
    const list = () => LU.sheet({
      title: hits.length + ' match' + (hits.length === 1 ? '' : 'es'),
      body: `<div class="list">${hits.map((h, i) => `<div class="li" data-h="${i}" style="align-items:flex-start"><div class="grow"><div class="lt" style="font-size:13px">${esc(h.book.name.slice(0, 34))} · page ${h.pg}</div><div class="ls" style="white-space:normal">${mark(esc(snippet(h.text, ws)), ws)}</div></div></div>`).join('')}</div>`,
      foot: `<button class="btn" data-act="closeSheet">Done</button>`,
      mount: (s) => LU.$$('[data-h]', s).forEach((el) => (el.onclick = () => detail(hits[+el.dataset.h], ws, onNote, list))),
    });
    list();
  };
  LU.refTest = { findArticle, search, load, clean, addBook };

  /* ---------- the Reference books screen ---------- */
  let rq = '';
  LU.views.refs = {
    render() {
      const bs = refs();
      return `<div class="topbar"><button class="iconbtn" data-act="back">${I('back')}</button><h1>Reference books<span class="sub">${bs.length} book${bs.length === 1 ? '' : 's'} · works offline</span></h1></div>
        <div class="card small muted" style="margin-bottom:12px">Add printed PDF books such as the Constitution. In any PDF, select text and tap <b>Books</b> to see what your books say about it. Type “Article 110” to jump straight to that article.</div>
        <button class="btn block" data-act="rfAdd">${I('plus')}Add a book</button><input type="file" id="rfIn" accept="application/pdf,.pdf" multiple hidden>
        ${bs.length ? `<div class="search" style="margin-top:12px">${I('search')}<input id="rfq" type="text" placeholder="Search your books (or: Article 21)" value="${esc(rq)}" autocomplete="off" enterkeyhint="search"></div>` : ''}
        <div class="list" style="margin-top:12px">${bs.map((b) => `<div class="li" data-rb="${b.id}"><span class="lic">${I('book')}</span><div class="grow"><div class="lt">${esc(b.name)}</div><div class="ls">${b.pages} pages${b.hasText ? '' : ' · scanned: little text to search'}</div></div><button class="iconbtn" data-rdel="${b.id}" aria-label="Remove">${I('trash')}</button></div>`).join('')}</div>
        ${bs.length ? '<div class="tiny muted" style="margin-top:8px">Tap a book to read it. Books are stored on this phone only.</div>' : ''}<div style="height:20px"></div>`;
    },
    mount(el) {
      const f = LU.$('#rfIn', el);
      if (f) f.onchange = async () => { const fs = Array.from(f.files || []); f.value = ''; for (const x of fs) await addBook(x); LU.render(true); };
      const q = LU.$('#rfq', el);
      if (q) { q.oninput = () => { rq = q.value; }; q.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); q.blur(); LU.refLook(q.value, null); } }; }
      LU.$$('[data-rb]', el).forEach((r) => (r.onclick = (e) => { if (e.target.closest('[data-rdel]')) return; viewPage(r.dataset.rb, 1); }));
      LU.$$('[data-rdel]', el).forEach((r) => (r.onclick = (e) => { e.stopPropagation(); const b = refs().find((x) => x.id === r.dataset.rdel); LU.confirm('Remove this book?', '“' + (b ? b.name : '') + '” will be removed from this phone.', 'Remove', async () => { await delBook(r.dataset.rdel); LU.render(true); }, true); }));
    },
  };
  LU.actions.openRefs = () => LU.push('refs');
  LU.actions.rfAdd = () => { const f = LU.$('#rfIn'); if (f) f.click(); };

  /* ---------- finished PDFs ---------- */
  LU.markFinished = (id, on) => {
    const d = LU.doc(id); if (!d) return;
    if (on === undefined) on = !d.fin;
    if (on) d.fin = Date.now(); else delete d.fin;
    LU.save(true);
    LU.toast(on ? '“' + d.name.slice(0, 30) + '” marked as finished.' : 'Back to “reading”.', { ms: 2500 });
  };
  LU.actions.dmFin = (el) => { LU.closeSheet(true); LU.markFinished(el.dataset.id); LU.render(true); };

  /* every time a PDF file is rewritten (pages moved, scanned pages added) remember when, so sync knows which copy is newer */
  const put0 = LU.idb.put;
  LU.idb.put = function (store, k, v) { if (store === 'files' && v instanceof Blob && !LU._noStamp) { const d = LU.doc && LU.doc(k); if (d) d.fileAt = Date.now(); } return put0.apply(this, arguments); };
})();
