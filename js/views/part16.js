/* Part 16: MCQ folder (questions found in your PDFs) and Important points folder */
(function () {
  const LU = window.LU, esc = LU.esc, I = LU.icon;
  const L = ['A', 'B', 'C', 'D'];
  const MB = () => { const s = LU.state; s.mcqbank = Object.assign({ items: [] }, s.mcqbank || {}); return s.mcqbank; };
  const IM = () => { const s = LU.state; s.imp = Object.assign({ items: [] }, s.imp || {}); return s.imp; };
  const norm = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, ' ').trim();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const dname = (id) => { const d = LU.doc(id); return d ? d.name.replace(/\.pdf$/i, '') : 'PDF removed'; };
  const jsonOf = (t) => { try { return JSON.parse(t); } catch (e) { const m = String(t).match(/[\[{][\s\S]*[\]}]/); try { return m ? JSON.parse(m[0]) : null; } catch (e2) { return null; } } };
  const SYS = 'You are a careful, concise mentor for an Indian UPSC Civil Services aspirant. Be accurate. Never invent facts, article numbers or case names that are not in the material.';

  /* ---------- reading a page as lines of text ---------- */
  async function pageLines(pdf, n) {
    const pg = await pdf.getPage(n), tc = await pg.getTextContent();
    let out = '', py = null;
    tc.items.forEach((it) => {
      if (!it.str && !it.hasEOL) return;
      const y = it.transform ? it.transform[5] : 0;
      if (py !== null && Math.abs(y - py) > 2.5) out += '\n';
      else if (out && !/[\s\n]$/.test(out) && it.str && !/^\s/.test(it.str)) out += ' ';
      out += it.str; py = y;
    });
    try { pg.cleanup(); } catch (e) {}
    return out;
  }
  const prog = (title, total) => {
    let stop = false;
    LU.sheet({
      title, body: `<div id="cpT" class="small muted">Starting…</div><div id="cpB" style="margin-top:10px">${LU.bar(0, 'thin')}</div><p class="small muted" style="margin-top:10px">You can stop at any time. What was found so far is kept.</p>`,
      foot: `<button class="btn ghost" id="cpX">Stop</button>`,
      mount: (s) => { LU.$('#cpX', s).onclick = () => { stop = true; LU.closeSheet(); }; },
    });
    return {
      set(i, msg) { const t = LU.$('#cpT'), b = LU.$('#cpB'); if (t) t.textContent = msg || `Page ${i} of ${total}`; if (b) b.innerHTML = LU.bar(Math.min(1, i / Math.max(1, total)), 'thin'); },
      get stopped() { return stop || !LU.$('#cpT'); },
      close() { if (LU.$('#cpT')) LU.closeSheet(true); },
    };
  };
  const pickDoc = (title, cb) => {
    const docs = LU.docs().slice().sort((a, b) => (b.opened || 0) - (a.opened || 0));
    if (!docs.length) { LU.toast('Add a PDF in Notes first.'); return; }
    LU.sheet({
      title, body: `<div class="list">${docs.map((d) => `<div class="li" data-pd="${d.id}"><span class="lic">${I('notes')}</span><div class="grow"><div class="lt ell">${esc(d.name)}</div><div class="ls">${d.pages} pages · ${esc(LU.docLabel(d))}</div></div></div>`).join('')}</div>`,
      mount: (s) => LU.$$('[data-pd]', s).forEach((b) => (b.onclick = () => { LU.closeSheet(true); cb(b.dataset.pd); })),
    });
  };

  /* =====================================================
     MCQs found inside the PDF text
     ===================================================== */
  function extractMcqs(text) {
    const t = text.replace(/[ \t ]+/g, ' '), raw = [];
    const find = (ch, start, gap) => { const re = new RegExp('(?:^|\\s)\\(?' + ch + '[\\)\\.]\\s', 'g'); re.lastIndex = start; const x = re.exec(t); return x && x.index - start < gap ? x : null; };
    /* every place that looks like options a) b) c) d)  (also A) B) C) D)) */
    [true, false].forEach((lower) => {
      const A = lower ? 'a' : 'A', B = lower ? 'b' : 'B', C = lower ? 'c' : 'C', D = lower ? 'd' : 'D';
      const reA = new RegExp('(?:^|\\s)\\(?' + A + '[\\)\\.]\\s', 'g'); let m;
      while ((m = reA.exec(t))) {
        const ia = m.index, aEnd = ia + m[0].length;
        const b = find(B, aEnd, 500); if (!b) continue;
        const bEnd = b.index + b[0].length, c = find(C, bEnd, 500); if (!c) continue;
        const cEnd = c.index + c[0].length, d = find(D, cEnd, 500); if (!d) continue;
        const dEnd = d.index + d[0].length;
        /* last option runs to the end of its line, and on if the next line continues it */
        let e = t.indexOf('\n', dEnd); if (e < 0) e = t.length;
        for (let k = 0; k < 2 && e < t.length; k++) {
          const ln = t.slice(dEnd, e), nx = t.indexOf('\n', e + 1), nl = t.slice(e + 1, nx < 0 ? t.length : nx);
          if (ln.length > 30 && !/[.?!:]\s*$/.test(ln) && /^[a-z(]/.test(nl.trim())) e = nx < 0 ? t.length : nx; else break;
        }
        if (e - dEnd > 260) e = dEnd + 260;
        const opts = [t.slice(aEnd, b.index), t.slice(bEnd, c.index), t.slice(cEnd, d.index), t.slice(dEnd, e)].map((x) => x.replace(/\s+/g, ' ').trim());
        if (opts.some((x) => !x || x.length > 300)) continue;
        raw.push({ ia, e, opts });
      }
    });
    raw.sort((x, y) => x.ia - y.ia);
    const out = []; let lastEnd = 0;
    raw.forEach((r) => {
      if (r.ia < lastEnd) return;
      const seg = t.slice(Math.max(lastEnd, r.ia - 1400), r.ia);
      let q = '';
      const qm = /(?:^|\n|\s)(?:MCQ|Q\s?\d{0,3}|Question\s?\d{0,3})\s*[.:)\-]\s*/gi; let last = null, z;
      while ((z = qm.exec(seg))) last = z;
      if (last) q = seg.slice(last.index + last[0].length);
      else q = seg.split('\n').map((x) => x.trim()).filter(Boolean).slice(-2).join(' ');
      q = q.replace(/\s+/g, ' ').replace(/^[^\w“"'‘(ऀ-ॿ]+/, '').trim();
      if (q.length < 12) return;
      let a = -1;
      const am = /^\s*\n?\s*(?:ans(?:wer)?|correct(?: answer)?)\s*[:\-.]?\s*\(?([a-dA-D])\)?\b/i.exec(t.slice(r.e, r.e + 60));
      if (am) a = 'abcd'.indexOf(am[1].toLowerCase());
      out.push({ q, o: r.opts, a }); lastEnd = r.e;
    });
    return out;
  }

  /* find MCQs in a PDF and put them in the MCQ folder */
  LU.mcqCollect = async (docId) => {
    const d = LU.doc(docId); if (!d) return;
    let pdf; try { pdf = await LU.openDoc(docId); } catch (e) { LU.toast('Could not open that PDF.'); return; }
    const n = pdf.numPages, P = prog('Looking for MCQs', n), bank = MB(), have = new Set(bank.items.map((x) => norm(x.q).slice(0, 80) + '|' + norm(x.o[0]).slice(0, 20)));
    let added = 0, dup = 0, textless = 0;
    for (let i = 1; i <= n; i++) {
      if (P.stopped) break;
      P.set(i, `Page ${i} of ${n} · ${added} found`);
      let tx = ''; try { tx = await pageLines(pdf, i); } catch (e) {}
      if (tx.replace(/\s/g, '').length < 20) textless++;
      extractMcqs(tx).forEach((x) => {
        const k = norm(x.q).slice(0, 80) + '|' + norm(x.o[0]).slice(0, 20);
        if (have.has(k)) { dup++; return; }
        have.add(k); bank.items.push({ id: 'm' + LU.uid(), q: x.q, o: x.o, a: x.a, ai: false, e: '', doc: docId, pg: i, at: Date.now() }); added++;
      });
      if (i % 6 === 0) await sleep(0);
    }
    const stopped = P.stopped; P.close(); LU.save();
    const nA = bank.items.filter((x) => x.doc === docId && x.a < 0).length;
    LU.sheet({
      title: stopped ? 'Stopped' : 'Done',
      body: `<div class="card" style="text-align:center"><div style="font:800 40px var(--fd)">${added}</div><div class="lt">MCQ${added === 1 ? '' : 's'} added to the MCQ folder</div>${dup ? `<div class="small muted" style="margin-top:4px">${dup} already saved, skipped</div>` : ''}</div>
        ${added === 0 && textless > n * 0.6 ? `<p class="small muted">Most pages have no text, so this PDF looks scanned. Use ⋯ › Ask AI about this page to read a page with AI.</p>` : added === 0 ? `<p class="small muted">No question with options a) b) c) d) was found. Questions written another way cannot be picked up automatically.</p>` : ''}
        ${nA ? `<p class="small muted">${nA} of them have no answer yet, because notes usually do not print answers.</p>` : ''}`,
      foot: `<button class="btn ghost" data-act="closeSheet">Close</button>${added ? `<button class="btn" id="cdOpen">Open MCQ folder</button>` : ''}`,
      mount: (s) => { const b = LU.$('#cdOpen', s); if (b) b.onclick = () => { LU.closeSheet(true); mf = docId; LU.push('mcqfolder'); }; },
    });
    if (LU.currentTab && LU.currentTab() === 'notes') LU.render(true);
  };

  /* ---------- MCQ folder ---------- */
  let mf = '', openedFrom = null;
  const mfItems = () => MB().items.filter((x) => !mf || x.doc === mf);
  LU.views.mcqfolder = {
    render() {
      const all = MB().items, items = mfItems(), docs = [...new Set(all.map((x) => x.doc))];
      const noA = items.filter((x) => x.a < 0).length, withA = items.length - noA;
      if (mf && !docs.includes(mf)) mf = '';
      return `<div class="topbar"><button class="iconbtn" data-act="back">${I('back')}</button><h1>MCQ<span class="sub">${all.length} question${all.length === 1 ? '' : 's'} from your notes</span></h1></div>
        <div style="display:flex;gap:8px"><button class="btn block" data-act="mfPractise" ${withA ? '' : 'disabled'}>${I('target')}Practise ${withA}</button><button class="btn ghost block" data-act="mfCollect">${I('plus')}From a PDF</button></div>
        ${noA ? `<div class="card tap" data-act="mfAnswers" style="margin-top:12px;display:flex;align-items:center;gap:12px"><span class="lic">${I('star')}</span><div class="grow"><div class="lt">${noA} without an answer</div><div class="small muted">Tap to get answers with AI (needs your Gemini key)</div></div><span class="chev">${I('chev')}</span></div>` : ''}
        ${docs.length > 1 ? `<div class="chips" style="margin-top:12px"><button class="chip ${mf ? '' : 'on'}" data-act="mfFilter" data-id="">All</button>${docs.map((id) => `<button class="chip ${mf === id ? 'on' : ''}" data-act="mfFilter" data-id="${id}">${esc(dname(id).slice(0, 22))}</button>`).join('')}</div>` : ''}
        <div class="list" style="margin-top:12px">${items.map((x, i) => `<div class="li" data-act="mfItem" data-id="${x.id}" style="align-items:flex-start"><span class="lic" style="font:700 13px var(--fd)">${i + 1}</span><div class="grow"><div class="lt" style="font-weight:500;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${esc(x.q)}</div><div class="ls">${x.a >= 0 ? `<span class="tag ${x.ai ? 'ai' : 'ok'}">${x.ai ? 'AI answer' : 'Answer'} ${L[x.a]}</span> · ` : '<span class="tag no">No answer</span> · '}${esc(dname(x.doc).slice(0, 26))} · p${x.pg}</div></div><span class="chev">${I('chev')}</span></div>`).join('') || `<div class="li"><div class="grow small muted">Nothing here yet. Tap “From a PDF”, or open a PDF, tap ⋯ and choose “Collect MCQs”.</div></div>`}</div>
        <div style="height:20px"></div>`;
    },
  };
  LU.actions.openMcqFolder = () => { mf = ''; LU.push('mcqfolder'); };
  LU.actions.mfFilter = (el) => { mf = el.dataset.id || ''; LU.render(true); };
  LU.actions.mfCollect = () => pickDoc('Collect MCQs from…', (id) => LU.mcqCollect(id));
  LU.actions.mfPractise = () => {
    const items = mfItems().filter((x) => x.a >= 0); if (!items.length) { LU.toast('Add answers first.'); return; }
    const m = LU.state.mcq = Object.assign({ sets: [], log: [], stat: {}, wrong: {} }, LU.state.mcq || {});
    let set = m.sets.find((x) => x.id === 'mcqfolder');
    const qs = items.map((x) => ({ id: x.id, q: x.q, o: x.o, a: x.a, e: x.e || '', tag: dname(x.doc).slice(0, 24) }));
    const name = mf ? 'MCQ · ' + dname(mf).slice(0, 26) : 'MCQ folder';
    if (set) { set.name = name; set.qs = qs; } else m.sets.push({ id: 'mcqfolder', name, qs });
    LU.save(); LU.actions.mqSet({ dataset: { id: 'mcqfolder' } });
  };
  LU.actions.mfItem = (el) => {
    const x = MB().items.find((i) => i.id === el.dataset.id); if (!x) return;
    let a = x.a;
    LU.sheet({
      title: 'Question',
      body: `<div class="card" style="line-height:1.5">${esc(x.q)}</div>
        <div class="list" style="margin-top:10px" id="mfO">${x.o.map((t, i) => `<div class="li" data-i="${i}"><span class="lic" style="font:700 14px var(--fd)">${L[i]}</span><div class="grow">${esc(t)}</div></div>`).join('')}</div>
        <p class="small muted" id="mfH" style="margin:8px 2px"></p>
        <div class="field"><label>Explanation (optional)</label><textarea class="inp" id="mfE" rows="2" maxlength="400">${esc(x.e || '')}</textarea></div>`,
      foot: `<button class="btn danger" id="mfD">${I('trash')}</button><button class="btn ghost" id="mfP">Open page</button><button class="btn" id="mfS">Save</button>`,
      mount: (s) => {
        const paint = () => {
          LU.$$('#mfO .li', s).forEach((r) => { const i = +r.dataset.i; r.style.borderColor = i === a ? 'var(--green)' : ''; r.style.background = i === a ? 'rgba(60,200,120,.14)' : ''; });
          LU.$('#mfH', s).textContent = a < 0 ? 'Tap the correct option.' : (x.ai && a === x.a ? 'This answer was written by AI. Tap an option to change it if it is wrong.' : 'Correct answer: ' + L[a]);
        };
        LU.$$('#mfO .li', s).forEach((r) => (r.onclick = () => { a = +r.dataset.i; paint(); }));
        paint();
        LU.$('#mfS', s).onclick = () => { if (a !== x.a) { x.a = a; x.ai = false; } x.e = LU.$('#mfE', s).value.trim(); LU.save(); LU.closeSheet(); LU.render(true); };
        LU.$('#mfP', s).onclick = () => { LU.closeSheet(true); if (LU.doc(x.doc)) LU.openReader(x.doc, { page: x.pg }); else LU.toast('That PDF was removed.'); };
        LU.$('#mfD', s).onclick = () => { LU.closeSheet(true); const b = MB(); b.items = b.items.filter((i) => i.id !== x.id); LU.save(); LU.render(true); LU.toast('Removed.', { sys: false }); };
      },
    });
  };
  /* ask Gemini for the answer to every question that has none */
  LU.actions.mfAnswers = async () => {
    if (!LU.aiKey || !LU.aiKey()) { LU.toast('Add your free Gemini key first: More › AI helper.', { ms: 3500 }); LU.push('aikey'); return; }
    const todo = mfItems().filter((x) => x.a < 0); if (!todo.length) return;
    const P = prog('Getting answers', todo.length); let done = 0, fail = 0;
    for (let i = 0; i < todo.length; i += 8) {
      if (P.stopped) break;
      const batch = todo.slice(i, i + 8);
      P.set(done, `Answered ${done} of ${todo.length}`);
      const prompt = 'Answer these UPSC multiple choice questions. For each one give the single best option letter and a one-line reason. Reply only as JSON: [{"n":1,"a":"B","e":"short reason"}].\n\n' + batch.map((x, k) => `${k + 1}. ${x.q}\n` + x.o.map((o, j) => `${L[j]}) ${o}`).join('\n')).join('\n\n');
      try {
        const r = await LU.ai(prompt, { system: SYS, json: true, temp: 0.1 }), arr = jsonOf(r);
        if (Array.isArray(arr)) arr.forEach((z) => { const x = batch[(+z.n || 0) - 1], j = L.indexOf(String(z.a || '').trim().charAt(0).toUpperCase()); if (x && j >= 0 && j < x.o.length) { x.a = j; x.ai = true; if (!x.e && z.e) x.e = String(z.e).slice(0, 300); done++; } else fail++; });
        else fail += batch.length;
        LU.save();
      } catch (e) {
        P.close(); if (e && e.code === 'nokey') { LU.push('aikey'); return; }
        LU.toast((e && e.message) || 'AI could not answer right now. Try again later.', { ms: 4500 }); break;
      }
      if (i + 8 < todo.length) await sleep(4500);
    }
    P.close(); LU.save(); LU.render(true);
    LU.toast(done + ' answered by AI' + (fail ? ', ' + fail + ' skipped' : '') + '. AI can be wrong, check them against your notes.', { ms: 4500 });
  };

  /* =====================================================
     Important points
     ===================================================== */
  const TYPES = ['Article', 'Committee', 'Act', 'Case', 'Schedule', 'Scheme', 'Fund', 'Bill', 'Report', 'Doctrine', 'Definition', 'Date', 'Fact'];
  const TCOL = { Article: '#5b8cff', Committee: '#2fc6a0', Act: '#f5b942', Case: '#ff7a90', Schedule: '#a06bff', Scheme: '#49c4ee', Fund: '#3ecf6e', Bill: '#e07be0', Report: '#8fb3ff', Doctrine: '#ffb36b', Definition: '#6bd6d6', Date: '#ff9f43', Fact: '#8a93a6' };
  const STOP = /^(?:The|This|That|These|Those|Of|In|A|An|And|For|By|With|Which|Is|Are|From|To|On|As|At|Its|It|His|Her|Their|Our|Under|After|Before|Also|Each|Every|Any|All|Such|Some|Many|Most|Other|Same|One|Two|New|Old|First|Second|Third|Last|Next|Said|Now|Then|When|While|If|But|Or|Not)\s+/;
  function impFromText(text) {
    /* skip MCQ option lines, they only repeat things that are not facts */
    const flat = text.split('\n').filter((ln) => !/^\s*\(?[a-dA-D][\).]\s/.test(ln) && !/(?:^|\s)\(?[aA][\).]\s.*\s\(?[bB][\).]\s/.test(ln) && !/^\s*(?:ans(?:wer)?|exp)\s*[:\-]/i.test(ln)).join('\n').replace(/[ \t]+/g, ' '), out = [], seen = new Set();
    const ctxOf = (idx, len) => {
      const sb = (() => { const h = flat.slice(0, idx), r = /(?<![A-Z])[.?!]\s+/g; let last = -1, q; while ((q = r.exec(h))) last = q.index + q[0].length; return last; })();
      let a = Math.max(sb, flat.lastIndexOf('\n', idx) + 1, 0);
      if (idx - a > 120) { const sp = flat.indexOf(' ', idx - 120); a = sp < 0 ? a : sp + 1; }
      const eq = /(?<![A-Z])[.?!](?=\s|$)/g; eq.lastIndex = idx + len; const em = eq.exec(flat); let b = em ? em.index + 1 : flat.length;
      const nl = flat.indexOf('\n', idx + len); if (nl >= 0 && nl < b) b = nl;
      if (b - idx > 150) { const sp = flat.lastIndexOf(' ', idx + 150); b = sp > idx ? sp : b; }
      return flat.slice(a, b).replace(/\s+/g, ' ').trim();
    };
    const add = (t, s, idx, len) => { const k = t + '|' + s.toLowerCase(); if (seen.has(k)) return; seen.add(k); out.push({ t, s, c: ctxOf(idx, len) }); };
    let m;
    const art = /\bArt(?:icles?|\.)\s*(\d{1,3}[A-Z]{0,2}(?:\s*\([0-9a-z]{1,3}\))?)(?:\s*(?:to|-|–|and)\s*(\d{1,3}[A-Z]{0,2}))?/g;
    while ((m = art.exec(flat))) add('Article', 'Art. ' + m[1].replace(/\s+/g, '') + (m[2] ? '–' + m[2] : ''), m.index, m[0].length);
    const com = /\b((?:\d{1,3}(?:st|nd|rd|th)\s+)?(?:[A-Z][A-Za-z'’\-\.]*\s+){1,5}(?:Committee|Commission|Panel|Tribunal|Council|Authority|Board))\b(?:\s*\((\d{4})\))?/g;
    while ((m = com.exec(flat))) { let nm = m[1]; while (STOP.test(nm)) nm = nm.replace(STOP, ''); if (nm.split(' ').length < 2) continue; add('Committee', nm + (m[2] ? ' (' + m[2] + ')' : ''), m.index, m[0].length); }
    const act = /\b((?:[A-Z][A-Za-z'’\-\.]*\s+(?:(?:of|for|and|to|on|in)\s+)?){1,6}Act),?\s*(?:of\s+)?(\d{4})\b/g;
    while ((m = act.exec(flat))) { let nm = m[1]; while (STOP.test(nm)) nm = nm.replace(STOP, ''); if (nm.split(' ').length < 2) continue; add('Act', nm + ', ' + m[2], m.index, m[0].length); }
    const am = /\b(\d{1,3})(?:st|nd|rd|th)\s+(?:Constitutional\s+)?Amendment(?:\s+Act)?(?:,?\s*\(?(\d{4})\)?)?/g;
    while ((m = am.exec(flat))) add('Act', m[1] + ordSuf(m[1]) + ' Amendment' + (m[2] ? ' (' + m[2] + ')' : ''), m.index, m[0].length);
    const cs = /\b([A-Z][A-Za-z\.'’\-]*(?:\s+[A-Z][A-Za-z\.'’\-]*){0,3}\s+(?:v\.|vs\.?|v)\s+(?:[A-Z][A-Za-z\.'’\-&]*\s*){1,4})(?:\s*\(?(\d{4})\)?)?/g;
    while ((m = cs.exec(flat))) { let nm = m[1].trim(); nm = nm.replace(/^[^]*?\.\s+(?=[^.]*\sv(?:s)?\.?\s)/, ''); while (STOP.test(nm)) nm = nm.replace(STOP, ''); if (!/\s(?:v\.|vs\.?|v)\s/.test(nm)) continue; add('Case', nm + (m[2] ? ' (' + m[2] + ')' : ''), m.index, m[0].length); }
    const sc = /\b(\d{1,2})(?:st|nd|rd|th)\s+Schedule\b/g;
    while ((m = sc.exec(flat))) add('Schedule', m[1] + ordSuf(m[1]) + ' Schedule', m.index, m[0].length);
    const fd = /\b((?:Consolidated|Contingency) Fund of (?:India|the State|[A-Z][a-z]+)|Public Account of (?:India|the State|[A-Z][a-z]+)|(?:[A-Z][A-Za-z'’\-]*\s+){1,4}Fund(?:\s+of\s+India)?)\b/g;
    while ((m = fd.exec(flat))) { let nm = m[1]; while (STOP.test(nm)) nm = nm.replace(STOP, ''); if (nm.split(' ').length < 2) continue; add('Fund', nm, m.index, m[0].length); }
    const bl = /\b((?:[A-Z][A-Za-z'’\-]*\s+(?:(?:of|for|and)\s+)?){1,6}Bill),?\s*(?:\(?(\d{4})\)?)?/g;
    while ((m = bl.exec(flat))) { let nm = m[1]; while (STOP.test(nm)) nm = nm.replace(STOP, ''); if (nm.split(' ').length < 2) continue; add('Bill', nm + (m[2] ? ', ' + m[2] : ''), m.index, m[0].length); }
    const rp = /\b((?:[A-Z][A-Za-z'’\-]*\s+){1,5}(?:Report|White Paper))\b/g;
    while ((m = rp.exec(flat))) { let nm = m[1]; while (STOP.test(nm)) nm = nm.replace(STOP, ''); if (nm.split(' ').length < 2) continue; add('Report', nm, m.index, m[0].length); }
    const dc = /\b(Doctrine of (?:[A-Z][a-z]+)(?:\s+(?:and|of)?\s*[A-Z][a-z]+){0,3}|(?:[A-Z][a-z]+\s+){1,3}(?:Doctrine|Theory of [A-Z][a-z]+))\b/g;
    while ((m = dc.exec(flat))) { let nm = m[1]; while (STOP.test(nm)) nm = nm.replace(STOP, ''); if (nm.split(' ').length < 2) continue; add('Doctrine', nm, m.index, m[0].length); }
    return out;
  }
  const ordSuf = (n) => { n = +n; const r = n % 100; return r >= 11 && r <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10 > 3 ? 0 : n % 10] || 'th'; };
  const impAdd = (docId, pg, arr) => {
    const bank = IM(), have = new Set(bank.items.map((x) => x.doc + '|' + x.t + '|' + norm(x.s))); let added = 0, dup = 0;
    arr.forEach((z) => { const k = docId + '|' + z.t + '|' + norm(z.s); if (have.has(k)) { dup++; return; } have.add(k); bank.items.push({ id: 'p' + LU.uid(), t: z.t, s: z.s, c: z.c || '', doc: docId, pg: z.pg || pg, at: Date.now() }); added++; });
    return { added, dup };
  };
  LU.impCollect = (docId) => {
    const d = LU.doc(docId); if (!d) return;
    const from0 = Math.max(1, Math.min(d.pages, d.page || 1));
    LU.sheet({
      title: 'Collect important points',
      body: `<p class="small muted" style="margin:0 0 10px">${esc(d.name)}</p>
        <div class="list"><div class="li" id="ipQ"><span class="lic">${I('search')}</span><div class="grow"><div class="lt">Quick scan (free, no AI)</div><div class="ls">Finds Articles, Committees, Commissions, Acts, Amendments, Cases and Schedules in the whole PDF</div></div></div>
        <div class="li" id="ipA"><span class="lic">${I('star')}</span><div class="grow"><div class="lt">Short notes with AI</div><div class="ls">Clean one-line points from the pages you choose (needs Gemini key)</div></div></div></div>
        <div class="row" style="gap:8px;margin-top:12px;align-items:center"><span class="small muted">AI pages</span><input class="inp" id="ipF" type="number" min="1" max="${d.pages}" value="${from0}" style="width:80px" inputmode="numeric"><span class="small muted">to</span><input class="inp" id="ipT" type="number" min="1" max="${d.pages}" value="${Math.min(d.pages, from0 + 9)}" style="width:80px" inputmode="numeric"></div>
        <p class="small muted">About 4 pages are sent per AI call, so a long range takes a while and uses your free quota.</p>`,
      mount: (s) => {
        LU.$('#ipQ', s).onclick = () => { LU.closeSheet(true); quickScan(docId); };
        LU.$('#ipA', s).onclick = () => {
          const f = LU.clamp(+LU.$('#ipF', s).value || 1, 1, d.pages), t = LU.clamp(+LU.$('#ipT', s).value || f, f, d.pages);
          LU.closeSheet(true); aiScan(docId, f, t);
        };
      },
    });
  };
  async function quickScan(docId) {
    let pdf; try { pdf = await LU.openDoc(docId); } catch (e) { LU.toast('Could not open that PDF.'); return; }
    const n = pdf.numPages, P = prog('Finding important points', n); let added = 0, dup = 0, textless = 0;
    for (let i = 1; i <= n; i++) {
      if (P.stopped) break;
      P.set(i, `Page ${i} of ${n} · ${added} found`);
      let tx = ''; try { tx = await pageLines(pdf, i); } catch (e) {}
      if (tx.replace(/\s/g, '').length < 20) { textless++; continue; }
      const r = impAdd(docId, i, impFromText(tx).map((z) => Object.assign(z, { pg: i }))); added += r.added; dup += r.dup;
      if (i % 6 === 0) await sleep(0);
    }
    const stopped = P.stopped; P.close(); LU.save(); finishImp(added, dup, textless > n * 0.6, stopped);
  }
  async function aiScan(docId, from, to) {
    if (!LU.aiKey || !LU.aiKey()) { LU.toast('Add your free Gemini key first: More › AI helper.', { ms: 3500 }); LU.push('aikey'); return; }
    let pdf; try { pdf = await LU.openDoc(docId); } catch (e) { LU.toast('Could not open that PDF.'); return; }
    const P = prog('Making short notes', to - from + 1); let added = 0, dup = 0, textless = 0, buf = '', pgs = [], err = false;
    const flush = async () => {
      if (!buf.trim()) return;
      const prompt = 'From the notes below, pick only short facts worth memorising for UPSC: article numbers, committees and commissions (with year and chair if given), acts and amendments, landmark cases, schemes, important dates and numbers. Write each as ONE short line, at most 15 words. Use only what is in the notes. Reply only as JSON: [{"t":"Article|Committee|Act|Case|Scheme|Date|Fact","s":"short line","pg":PAGE_NUMBER}].\n\nNOTES:\n' + buf;
      try {
        const r = await LU.ai(prompt, { system: SYS, json: true, temp: 0.2 }), arr = jsonOf(r);
        if (Array.isArray(arr)) { const res = impAdd(docId, pgs[0], arr.filter((z) => z && z.s).map((z) => ({ t: TYPES.includes(z.t) ? z.t : 'Fact', s: String(z.s).slice(0, 160), pg: pgs.includes(+z.pg) ? +z.pg : pgs[0] }))); added += res.added; dup += res.dup; LU.save(); }
      } catch (e) { err = true; P.close(); if (e && e.code === 'nokey') LU.push('aikey'); else LU.toast((e && e.message) || 'AI could not answer right now.', { ms: 4500 }); }
      buf = ''; pgs = [];
    };
    for (let i = from; i <= to && !err; i++) {
      if (P.stopped) break;
      P.set(i - from, `Page ${i} (${from}–${to}) · ${added} points`);
      let tx = ''; try { tx = (await pageLines(pdf, i)).replace(/\s+/g, ' ').trim(); } catch (e) {}
      if (tx.length < 30) { textless++; continue; }
      buf += `\n[Page ${i}]\n` + tx.slice(0, 5000); pgs.push(i);
      if (buf.length > 7000 || pgs.length >= 4) { await flush(); if (!err && i < to) await sleep(4500); }
    }
    if (!err && !P.stopped) await flush();
    const stopped = P.stopped; if (!err) { P.close(); LU.save(); finishImp(added, dup, textless === to - from + 1, stopped); }
  }
  function finishImp(added, dup, scanned, stopped) {
    LU.sheet({
      title: stopped ? 'Stopped' : 'Done',
      body: `<div class="card" style="text-align:center"><div style="font:800 40px var(--fd)">${added}</div><div class="lt">point${added === 1 ? '' : 's'} added to Important points</div>${dup ? `<div class="small muted" style="margin-top:4px">${dup} already saved, skipped</div>` : ''}</div>
        ${added === 0 && scanned ? `<p class="small muted">These pages have no text (scanned). Read them with AI first: ⋯ › Ask AI about this page.</p>` : ''}
        <p class="small muted">Delete anything you do not need, or edit it, inside the folder.</p>`,
      foot: `<button class="btn ghost" data-act="closeSheet">Close</button>${added ? `<button class="btn" id="ipOpen">Open Important points</button>` : ''}`,
      mount: (s) => { const b = LU.$('#ipOpen', s); if (b) b.onclick = () => { LU.closeSheet(true); LU.push('impfolder'); }; },
    });
    if (LU.currentTab && LU.currentTab() === 'notes') LU.render(true);
  }

  /* ---------- Important points folder ---------- */
  let ipT = '', ipQ = '';
  const ipItems = () => { const q = ipQ.trim().toLowerCase(); return IM().items.filter((x) => (!ipT || x.t === ipT) && (!q || (x.s + ' ' + x.c + ' ' + dname(x.doc)).toLowerCase().includes(q))); };
  LU.views.impfolder = {
    render() {
      const all = IM().items, items = ipItems(), types = TYPES.filter((t) => all.some((x) => x.t === t));
      return `<div class="topbar"><button class="iconbtn" data-act="back">${I('back')}</button><h1>Important points<span class="sub">${all.length} point${all.length === 1 ? '' : 's'} from your notes</span></h1></div>
        <div style="display:flex;gap:8px"><button class="btn block" data-act="ipCollect">${I('plus')}From a PDF</button><button class="btn ghost block" data-act="ipNew">${I('edit')}Add my own</button></div>
        <div class="search" style="margin-top:12px">${I('search')}<input id="ipq" type="text" placeholder="Search points" value="${esc(ipQ)}" autocomplete="off"></div>
        ${types.length ? `<div class="chips" style="margin-top:10px"><button class="chip ${ipT ? '' : 'on'}" data-act="ipType" data-t="">All</button>${types.map((t) => `<button class="chip ${ipT === t ? 'on' : ''}" data-act="ipType" data-t="${t}"><i class="cdot" style="background:${TCOL[t]}"></i>${t} ${all.filter((x) => x.t === t).length}</button>`).join('')}</div>` : ''}
        ${items.length ? `<div class="row" style="margin-top:10px;gap:8px"><button class="btn ghost sm" data-act="ipCards">${I('book')}Make ${items.length > 40 ? '40' : items.length} flashcards</button><button class="btn ghost sm" data-act="ipCopy">${I('copy')}Copy list</button></div>` : ''}
        <div class="list" style="margin-top:12px">${items.map((x) => `<div class="li" data-act="ipItem" data-id="${x.id}" style="align-items:flex-start"><span class="tag" style="background:${TCOL[x.t] || '#8a93a6'}22;color:${TCOL[x.t] || '#8a93a6'};flex:none;margin-top:2px">${x.t}</span><div class="grow"><div class="lt" style="font-weight:600">${esc(x.s)}</div>${x.c ? `<div class="small muted" style="margin-top:2px;line-height:1.4">${esc(x.c)}</div>` : ''}<div class="ls">${esc(dname(x.doc).slice(0, 26))}${x.pg ? ' · p' + x.pg : ''}</div></div></div>`).join('') || `<div class="li"><div class="grow small muted">${all.length ? 'Nothing matches.' : 'Nothing here yet. Tap “From a PDF”, or open a PDF, tap ⋯ and choose “Collect important points”.'}</div></div>`}</div>
        <div style="height:20px"></div>`;
    },
    mount(el) {
      const inp = LU.$('#ipq', el);
      if (inp) { let t; inp.oninput = () => { clearTimeout(t); t = setTimeout(() => { ipQ = inp.value; LU.render(true); const n = LU.$('#ipq'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 200); }; }
    },
  };
  LU.actions.openImpFolder = () => { ipT = ''; ipQ = ''; LU.push('impfolder'); };
  LU.actions.ipType = (el) => { ipT = el.dataset.t || ''; LU.render(true); };
  LU.actions.ipCollect = () => pickDoc('Collect points from…', (id) => LU.impCollect(id));
  LU.actions.ipCopy = async () => { const t = ipItems().map((x) => `• [${x.t}] ${x.s}${x.c ? ' — ' + x.c : ''}`).join('\n'); LU.toast((await LU.copyText(t)) ? 'Copied ' + ipItems().length + ' points.' : 'Could not copy.', { sys: false }); };
  LU.actions.ipCards = () => {
    const items = ipItems().slice(0, 40); if (!items.length || !LU.cardsAdd) return;
    const n = LU.cardsAdd('Important points', items.map((x) => ({ f: x.t === 'Article' || x.t === 'Schedule' ? `What is ${x.s}?` : x.t === 'Fact' || x.t === 'Date' ? x.s : `About: ${x.s}`, b: x.c || x.s })));
    LU.toast((n || items.length) + ' flashcards added. Find them in More › Flashcards.', { ms: 3500 });
  };
  const ipForm = (x, forceNew) => {
    const isNew = !x || !!forceNew; x = x || { id: 'p' + LU.uid(), t: 'Fact', s: '', c: '', doc: '', pg: 0, at: Date.now() };
    let t = x.t;
    LU.sheet({
      title: isNew ? 'Add a point' : 'Point',
      body: `<div class="field"><label>Type</label><div class="seg" id="ipTs" style="flex-wrap:wrap">${TYPES.map((k) => `<button type="button" data-t="${k}" class="${k === t ? 'on' : ''}">${k}</button>`).join('')}</div></div>
        <div class="field"><label>Point (short)</label><input class="inp" id="ipS" maxlength="160" value="${esc(x.s)}" placeholder="e.g. Art. 266 – Consolidated Fund of India"></div>
        <div class="field"><label>Detail (optional)</label><textarea class="inp" id="ipC" rows="3" maxlength="400">${esc(x.c || '')}</textarea></div>
        ${x.doc ? `<p class="small muted">From ${esc(dname(x.doc))}${x.pg ? ', page ' + x.pg : ''}</p>` : ''}`,
      foot: `${isNew ? '' : `<button class="btn danger" id="ipD">${I('trash')}</button>`}${x.doc ? `<button class="btn ghost" id="ipP">Open page</button>` : ''}<button class="btn" id="ipS2">Save</button>`,
      mount: (s) => {
        LU.$$('#ipTs button', s).forEach((b) => (b.onclick = () => { t = b.dataset.t; LU.$$('#ipTs button', s).forEach((z) => z.classList.toggle('on', z === b)); }));
        LU.$('#ipS2', s).onclick = () => { const v = LU.$('#ipS', s).value.trim(); if (!v) { LU.toast('Write the point first.'); return; } x.t = t; x.s = v; x.c = LU.$('#ipC', s).value.trim(); if (isNew) IM().items.unshift(x); LU.save(); LU.closeSheet(); LU.render(true); };
        const d = LU.$('#ipD', s); if (d) d.onclick = () => { LU.closeSheet(true); const b = IM(); b.items = b.items.filter((i) => i.id !== x.id); LU.save(); LU.render(true); LU.toast('Removed.', { sys: false }); };
        const p = LU.$('#ipP', s); if (p) p.onclick = () => { LU.closeSheet(true); if (LU.doc(x.doc)) LU.openReader(x.doc, { page: x.pg || 1 }); else LU.toast('That PDF was removed.'); };
      },
    });
  };
  LU.actions.ipNew = () => ipForm(null);
  LU.actions.ipItem = (el) => ipForm(IM().items.find((i) => i.id === el.dataset.id));

  LU.p16 = { MB, IM, norm, sleep, dname, jsonOf, SYS, pageLines, prog, pickDoc, extractMcqs, impFromText, TYPES, TCOL, ipForm, L };
  /* a PDF that is deleted keeps its questions and points, but they stop linking to a page */
})();
