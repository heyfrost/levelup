/* Part 18: one combined "Collect from this PDF", strict AI reading, merge similar points,
   subject folders for MCQ and Important points, tap-to-bottom rotation, long-press opens the PDF */
(function () {
  const LU = window.LU, esc = LU.esc, I = LU.icon, P = LU.p16;
  if (!P) return;
  const { MB, IM, norm, sleep, dname, jsonOf, SYS, pageLines, prog, pickDoc, extractMcqs, impFromText, TYPES, TCOL, L } = P;
  const DAY = 86400000;

  /* ---------- subjects (an item follows its PDF's subject) ---------- */
  const subjOf = (docId) => { const d = LU.doc(docId); if (!d) return '_uns'; if (d.subj === 'qp') return 'qp'; return d.subj && LU.subject(d.subj) ? d.subj : '_uns'; };
  const sname = (id) => id === '_uns' ? 'Unsorted' : id === 'qp' ? LU.QP.name : (LU.subject(id) || { name: 'Unsorted' }).name;
  const scol = (id) => id === '_uns' ? '#8a93a6' : id === 'qp' ? LU.QP.color : (LU.subject(id) || { color: '#8a93a6' }).color;
  const itemSub = (x) => (x.doc && LU.doc(x.doc) ? subjOf(x.doc) : x.subj && (x.subj === 'qp' || LU.subject(x.subj)) ? x.subj : '_uns');
  const subjectIds = (items) => {
    const have = new Set(items.map((x) => itemSub(x))), out = [];
    LU.syllabus.forEach((s) => have.has(s.id) && out.push(s.id));
    if (have.has('qp')) out.push('qp');
    if (have.has('_uns')) out.push('_uns');
    return out;
  };

  /* ---------- pages and similarity ---------- */
  const pgsOf = (x) => (x.pgs && x.pgs.length ? x.pgs : x.pg ? [x.pg] : []);
  const pgLabel = (x) => { const a = pgsOf(x); return a.length ? a.slice(0, 4).map((n) => 'p' + n).join(', ') + (a.length > 4 ? ' +' + (a.length - 4) : '') : ''; };
  const toks = (t) => norm(t).split(' ').filter((w) => w.length > 1);
  const nums = (a) => a.filter((w) => /\d/.test(w)).sort().join(',');
  const similar = (a, b, same) => {
    const A = toks(a), B = toks(b); if (!A.length || !B.length) return false;
    if (nums(A) !== nums(B)) return false;
    const SA = new Set(A), SB = new Set(B); let n = 0; SA.forEach((w) => SB.has(w) && n++);
    const jac = n / (SA.size + SB.size - n), small = Math.min(SA.size, SB.size);
    return jac >= (same ? 0.7 : 0.88) || (same && small >= 2 && n === small && Math.max(SA.size, SB.size) <= small + 4);
  };
  const contain = (a, b) => { const A = new Set(toks(a)), B = new Set(toks(b)); if (!A.size || !B.size) return 0; let n = 0; A.forEach((w) => B.has(w) && n++); return n / Math.min(A.size, B.size); };
  const joinPg = (x, pgs) => { const s = new Set(pgsOf(x).concat(pgs.filter(Boolean))); x.pgs = [...s].sort((a, b) => a - b); x.pg = x.pgs[0] || x.pg || 0; };

  /* ---------- adding with merge ---------- */
  function addPoints(docId, pg, arr) {
    const bank = IM(), mine = bank.items.filter((x) => x.doc === docId); let added = 0, merged = 0;
    arr.forEach((z) => {
      if (!z || !z.s) return;
      const s = String(z.s).trim().slice(0, 400), t = TYPES.includes(z.t) ? z.t : 'Fact', p = z.pg || pg;
      const hit = mine.find((x) => similar(x.s, s, x.t === t));
      if (hit) { merged++; joinPg(hit, [p]); if (z.ai && !hit.ai) { hit.s = s; hit.h = z.h ? String(z.h).slice(0, 80) : hit.h; hit.ai = 1; hit.c = ''; return; } if (!hit.c && z.c) hit.c = z.c; if (!hit.h && z.h) hit.h = String(z.h).slice(0, 80); if (s.length > hit.s.length && similar(hit.s, s, true) && norm(hit.s) !== norm(s) && hit.s.length < 25) hit.s = s; return; }
      const it = { id: 'p' + LU.uid(), ai: z.ai ? 1 : 0, t, s, h: z.h ? String(z.h).slice(0, 80) : '', c: z.c || '', doc: docId, pg: p, pgs: p ? [p] : [], at: Date.now(), rot: 0 };
      bank.items.push(it); mine.push(it); added++;
    });
    return { added, merged };
  }
  function addMcqs(docId, pg, arr) {
    const bank = MB(); let added = 0, merged = 0;
    arr.forEach((z) => {
      const hit = bank.items.find((x) => x.doc === docId && (similar(x.q, z.q, false) || norm(x.q).slice(0, 80) === norm(z.q).slice(0, 80)) && similar(x.o.join(' '), z.o.join(' '), true));
      if (hit) { merged++; joinPg(hit, [pg]); if (hit.a < 0 && z.a >= 0) hit.a = z.a; return; }
      bank.items.push({ id: 'm' + LU.uid(), q: z.q, o: z.o, a: z.a, ai: false, e: '', doc: docId, pg, pgs: [pg], at: Date.now(), rot: 0 });
      added++;
    });
    return { added, merged };
  }
  /* MCQs written out in full by Gemini: replace the cut-off versions the free reader saved, add the missing ones */
  const MCQ_RULES = [
    "From this PDF, extract EVERY multiple-choice question (MCQ), exactly as written. Do not miss any.",
    "- Write the FULL question: if it has numbered statements (1, 2, 3, 4), an assertion and reason, or a match-the-following list, include all of them in \"q\", each on its own line (separate lines with \\n).",
    "- Give the options in \"o\" in order (usually four), without the letters. For 'Answer Codes' questions the options are the codes, e.g. \"1 and 3 only\".",
    "- \"a\" is the correct option letter (A, B, C or D). If the PDF itself marks the answer (a tick, bold, 'Ans:' or an answer key), use that and set \"src\":true. If it does not, work out the best answer yourself and set \"src\":false.",
    "- \"e\" is a one-line reason, using only what the PDF says where possible. \"pg\" is the page number.",
    "- Ignore Hindi words, emojis and decorations. Write in English. Do not invent questions that are not in the PDF.",
    'Reply only as JSON: [{"q":"full question with statements","o":["option","option","option","option"],"a":"B","src":true,"e":"reason","pg":PAGE_NUMBER}].',
  ].join('\n');
  function addAiMcqs(docId, arr, nPages) {
    const bank = MB(); let added = 0, fixed = 0;
    arr.forEach((z) => {
      if (!z || typeof z.q !== 'string' || !Array.isArray(z.o)) return;
      const q = z.q.replace(/\\n/g, '\n').replace(/[\u0900-\u097F]/g, '').replace(/[ \t]+/g, ' ').trim(), o = z.o.map((x) => cleanLine(String(x)).replace(/^[A-Da-d][).]\s*/, '')).filter(Boolean).slice(0, 5);
      if (q.length < 15 || o.length < 2) return;
      const pg = +z.pg >= 1 && +z.pg <= nPages ? +z.pg : 1, j = L.indexOf(String(z.a || '').trim().charAt(0).toUpperCase()), ok = j >= 0 && j < o.length;
      const hit = bank.items.find((x) => x.doc === docId && x.o.length === o.length && similar(x.o.join(' '), o.join(' '), true) && (Math.abs(x.pg - pg) <= 1 || similar(x.q, q, false) || contain(x.q, q) >= 0.8));
      if (hit) {
        if (q.length > hit.q.length + 5) { hit.q = q; fixed++; }
        hit.o = o; joinPg(hit, [pg]);
        if (ok && (hit.a < 0 || hit.ai)) { hit.a = j; hit.ai = !z.src; if (z.e) hit.e = String(z.e).slice(0, 300); }
        return;
      }
      bank.items.push({ id: 'm' + LU.uid(), q, o, a: ok ? j : -1, ai: ok ? !z.src : false, e: ok && z.e ? String(z.e).slice(0, 300) : '', doc: docId, pg, pgs: [pg], at: Date.now(), rot: 0 }); added++;
    });
    return { added, fixed };
  }
  /* second pass: merge whatever near-copies are left for one PDF */
  function consolidate(docId) {
    let n = 0;
    const bank = IM(), keep = [];
    bank.items.forEach((x) => {
      if (x.doc !== docId) { keep.push(x); return; }
      const hit = keep.find((k) => k.doc === docId && similar(k.s, x.s, k.t === x.t));
      if (hit) { joinPg(hit, pgsOf(x)); if (!hit.c && x.c) hit.c = x.c; n++; } else keep.push(x);
    });
    bank.items = keep;
    const mb = MB(), k2 = [];
    mb.items.forEach((x) => {
      if (x.doc !== docId) { k2.push(x); return; }
      const part = (k) => k.o.length === x.o.length && similar(k.o.join(' '), x.o.join(' '), true) && (norm(k.q).includes(norm(x.q).slice(0, 40)) || norm(x.q).includes(norm(k.q).slice(0, 40)) || contain(k.q, x.q) >= 0.8);
      const hit = k2.find((k) => k.doc === docId && ((similar(k.q, x.q, false) && similar(k.o.join(' '), x.o.join(' '), true)) || part(k)));
      if (hit && x.q.length > hit.q.length) hit.q = x.q;
      if (hit) { joinPg(hit, pgsOf(x)); if (hit.a < 0 && x.a >= 0) { hit.a = x.a; hit.ai = x.ai; } n++; } else k2.push(x);
    });
    mb.items = k2;
    return n;
  }

  /* ---------- Gemini answers for MCQs ---------- */
  async function getAnswers(todo, Pg, base, span) {
    let done = 0, fail = 0, err = null;
    for (let i = 0; i < todo.length; i += 8) {
      if (Pg.stopped) break;
      const batch = todo.slice(i, i + 8);
      Pg.set(base + span * (i / todo.length), `Getting answers ${i} of ${todo.length}`);
      const prompt = 'Answer these UPSC multiple choice questions. For each one give the single best option letter and a one-line reason. Reply only as JSON: [{"n":1,"a":"B","e":"short reason"}].\n\n' + batch.map((x, k) => `${k + 1}. ${x.q}\n` + x.o.map((o, j) => `${L[j]}) ${o}`).join('\n')).join('\n\n');
      try {
        const r = await LU.ai(prompt, { system: SYS, json: true, temp: 0.1 }), arr = jsonOf(r);
        if (Array.isArray(arr)) arr.forEach((z) => { const x = batch[(+z.n || 0) - 1], j = L.indexOf(String(z.a || '').trim().charAt(0).toUpperCase()); if (x && j >= 0 && j < x.o.length) { x.a = j; x.ai = true; if (!x.e && z.e) x.e = String(z.e).slice(0, 300); done++; } else fail++; });
        else fail += batch.length;
        LU.save();
      } catch (e) { err = e || new Error('AI error'); break; }
      if (i + 8 < todo.length) await sleep(4500);
    }
    return { done, fail, err };
  }

  /* =====================================================
     Collect from this PDF  (points + MCQs + AI answers)
     ===================================================== */
  const AI_RULES = [
    "From this PDF, I want to make short notes in bullet points on each and every important topic in the PDF. The points should be precise and concise, and each can be of a maximum of one to two lines. Please do not miss anything, and analyze the PDF thoroughly.",
    "",
    "Format: group the points under topic headings. Each bullet is \"Name (Article/Act if given): short explanation\", like this:",
    "Core Fiscal Concepts & Government Funds",
    " * Consolidated Fund of India (Art. 266): Receives incoming taxes and loans, and requires Parliamentary permission via an Appropriation Bill for withdrawals.",
    " * Contingency Fund (Art. 267): Managed by the Finance Secretary on the President's behalf for unforeseen events, holding a corpus of Rs 30,000 crore.",
    "",
    "Rules:",
    "- Ignore all Hindi words and any Hindi text, emojis, symbols and decorative marks completely. Write the notes only in English.",
    "- Cover every important topic, fact, provision, rule, number, date, body, case and definition on every page. Do not miss anything.",
    "- Use ONLY what is written in the PDF. Do not add any outside information and do not invent anything.",
    "- Each point must make sense on its own, with its context, and be at most two lines.",
    "- Do not repeat a point.",
    "",
    'Reply only as JSON: [{"t":"Article|Committee|Act|Bill|Case|Schedule|Scheme|Fund|Report|Doctrine|Definition|Date|Fact","h":"topic heading","s":"the bullet point","pg":PAGE_NUMBER}].',
  ].join('\n');
  const salvage = (t) => { const out = []; String(t || '').replace(/\{[^{}]*\}/g, (m) => { try { out.push(JSON.parse(m)); } catch (e) {} return m; }); return out; };
  /* clean a line from the PDF: no emoji, no Hindi, no dot leaders; give up if too much of it was garbage */
  const cleanLine = (t) => {
    const a = String(t || ''), b = a.replace(/[\u0900-\u097F]/g, '').replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').replace(/[.…·]{4,}/g, ' ').replace(/\s+/g, ' ').trim();
    return a.length && (a.length - b.length) / a.length > 0.2 ? '' : b;
  };
  /* quick scan (no AI): keep the whole sentence the name sits in, never the bare name */
  const words = (t) => String(t || '').trim().split(/\s+/).filter(Boolean).length;
  const quickPoints = (tx, pg) => impFromText(tx).map((z) => ({ t: z.t, h: z.s, s: cleanLine(z.c), pg })).filter((z) => z.s && words(z.s) >= 7 && z.s.length >= 40 && norm(z.s) !== norm(z.h));

  LU.collectAll = (docId) => {
    const d = LU.doc(docId); if (!d) return;
    const hasKey = !!(LU.aiKey && LU.aiKey()), resume = d.cnext && d.cnext > 1 && d.cnext <= d.pages ? d.cnext : 0;
    LU.sheet({
      title: 'Collect from this PDF',
      body: `<p class="small muted" style="margin:0 0 10px">${esc(d.name)} · ${d.pages} pages</p>
        <div class="list">
          <div class="li" id="caA"><span class="lic">${I('star')}</span><div class="grow"><div class="lt">${resume ? 'Resume with AI from page ' + resume : 'Read the whole PDF with AI'}</div><div class="ls">Finds important points and the MCQs written in the notes, then asks AI for the MCQ answers${hasKey ? '' : ' (needs your Gemini key)'}</div></div></div>
          <div class="li" id="caM"><span class="lic">${I('target')}</span><div class="grow"><div class="lt">Read only the MCQs again with AI</div><div class="ls">Fixes questions that came out cut (statements missing). Skips the points${hasKey ? '' : ' (needs your Gemini key)'}</div></div></div>
          <div class="li" id="caQ"><span class="lic">${I('search')}</span><div class="grow"><div class="lt">Quick scan (free, no AI)</div><div class="ls">Articles, Acts, Bills, Funds, Committees, Cases, Reports… and the MCQs, without answers</div></div></div>
        </div>
        <div class="row" style="gap:8px;margin-top:12px;align-items:center"><span class="small muted">Pages</span><input class="inp" id="caF" type="number" min="1" max="${d.pages}" value="${resume || 1}" style="width:80px" inputmode="numeric"><span class="small muted">to</span><input class="inp" id="caT" type="number" min="1" max="${d.pages}" value="${d.pages}" style="width:80px" inputmode="numeric"></div>
        <p class="small muted">Scanned pages are read as pictures. You can stop and come back later. Points that repeat are merged into one with all the page numbers.</p>`,
      mount: (s) => {
        const go = (ai) => {
          const f = LU.clamp(+LU.$('#caF', s).value || 1, 1, d.pages), t = LU.clamp(+LU.$('#caT', s).value || d.pages, f, d.pages);
          if (ai && !hasKey) { LU.closeSheet(true); LU.toast('Add your free Gemini key first: More › AI helper.', { ms: 3500 }); LU.push('aikey'); return; }
          LU.closeSheet(true); runCollect(docId, f, t, ai);
        };
        LU.$('#caA', s).onclick = () => go(true);
        LU.$('#caQ', s).onclick = () => go(false);
        LU.$('#caM', s).onclick = () => { LU.$('#caF', s).value = 1; LU.$('#caT', s).value = d.pages; go('mcq'); };
      },
    });
  };
  LU.mcqCollect = LU.impCollect = LU.collectAll;

  const toB64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = () => rej(new Error('read')); r.readAsDataURL(blob); });
  const LIMIT = 14 * 1024 * 1024;
  /* the whole PDF as base64. Big ones are re-drawn a little smaller (15% steps) until they fit. */
  async function pdfForGemini(docId, pdf, Pg) {
    const blob = await LU.idb.get('files', docId);
    if (blob && blob.size <= LIMIT) return { b64: await toB64(blob), shrunk: false };
    let scale = 1.6, q = 0.75;
    for (let round = 0; round < 5; round++) {
      const pages = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        if (Pg.stopped) return null;
        Pg.set(3 + 15 * (n / pdf.numPages), `Making the PDF smaller for Gemini… page ${n} of ${pdf.numPages}`);
        const pg = await pdf.getPage(n), vp = pg.getViewport({ scale }), c = document.createElement('canvas');
        c.width = Math.round(vp.width); c.height = Math.round(vp.height);
        const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
        await pg.render({ canvasContext: x, viewport: vp }).promise; try { pg.cleanup(); } catch (e) {}
        pages.push({ bytes: await LU.img.toBytes(c, q), w: c.width, h: c.height });
      }
      const out = await LU.img.buildPdf(pages);
      if (out.length <= LIMIT) return { b64: await toB64(new Blob([out], { type: 'application/pdf' })), shrunk: true };
      scale *= 0.85; q = Math.max(0.5, q - 0.05);
    }
    return null;
  }

  async function runCollect(docId, from, to, ai) {
    let pdf; try { pdf = await LU.openDoc(docId); } catch (e) { LU.toast('Could not open that PDF.'); return; }
    const d = LU.doc(docId), N = to - from + 1, Pg = prog('Collecting from this PDF', 100);
    const R = { pts: 0, mrg: 0, mq: 0, mqm: 0, ans: 0, ansFail: 0, textless: 0, imgs: 0 };
    const texts = {}; let err = null, stopAt = 0;
    /* 1. read every page: MCQs and a quick scan (no AI) */
    for (let i = from; i <= to; i++) {
      if (Pg.stopped) { stopAt = i; break; }
      Pg.set(((i - from) / N) * (ai ? 25 : 90), `Reading page ${i} of ${to} · ${R.pts} points · ${R.mq} MCQs`);
      let tx = ''; try { tx = await pageLines(pdf, i); } catch (e) {}
      texts[i] = tx;
      if (tx.replace(/\s/g, '').length < 20) { R.textless++; continue; }
      const m = addMcqs(docId, i, extractMcqs(tx)); R.mq += m.added; R.mqm += m.mrg === undefined ? m.merged : m.merged;
      if (!ai) { const p = addPoints(docId, i, quickPoints(tx, i)); R.pts += p.added; R.mrg += p.merged; }
      if (i % 6 === 0) await sleep(0);
    }
    LU.save();
    /* 2. strict AI reading of every page, a few pages at a time */
    let next = 0, wholeDone = false, startFrom = from;
    if (ai && !Pg.stopped && from === 1 && to === d.pages) {
      Pg.set(3, 'Preparing the PDF…');
      let pk = null; try { pk = await pdfForGemini(docId, pdf, Pg); } catch (e) { pk = null; }
      if (pk && !Pg.stopped) {
        Pg.set(22, 'Gemini is reading the whole PDF… this can take a minute or two');
        const ac = new AbortController(), iv = setInterval(() => { if (Pg.stopped) ac.abort(); }, 500);
        try {
          if (ai === 'mcq') { wholeDone = true; throw 0; }
          const r = await LU.ai(AI_RULES, { system: SYS, json: true, temp: 0.2, images: [{ mime: 'application/pdf', data: pk.b64 }], timeout: 300000, signal: ac.signal });
          const a0 = jsonOf(r), arr = Array.isArray(a0) ? a0 : salvage(r), trunc = !/\]\s*$/.test(String(r).trim());
          const good = arr.filter((z) => z && z.s && words(z.s) >= 4), maxPg = good.reduce((m, z) => Math.max(m, +z.pg || 0), 0);
          const res = addPoints(docId, 1, good.map((z) => ({ t: z.t, h: z.h, s: z.s, ai: 1, pg: +z.pg >= 1 && +z.pg <= d.pages ? +z.pg : 1 }))); R.pts += res.added; R.mrg += res.merged; LU.save();
          if (good.length && !trunc) wholeDone = true; else if (good.length) startFrom = Math.max(from, maxPg);
          R.shrunk = pk.shrunk;
        } catch (e) { if (!Pg.stopped) { if (e && (e.code === 'nokey' || e.code === 'limit')) err = e; } }
        finally { clearInterval(iv); }
        /* the questions, written out in full (a second call on the same PDF) */
        if (!Pg.stopped && !err) {
          Pg.set(60, 'Gemini is reading the MCQs…');
          const ac2 = new AbortController(), iv2 = setInterval(() => { if (Pg.stopped) ac2.abort(); }, 500);
          try {
            const r = await LU.ai(MCQ_RULES, { system: SYS, json: true, temp: 0.1, images: [{ mime: 'application/pdf', data: pk.b64 }], timeout: 300000, signal: ac2.signal });
            const a0 = jsonOf(r), arr = Array.isArray(a0) ? a0 : salvage(r), res = addAiMcqs(docId, arr, d.pages); R.mq += res.added; R.fixed = (R.fixed || 0) + res.fixed; R.aiMq = arr.length; LU.save();
          } catch (e) { if (!Pg.stopped && e && (e.code === 'nokey' || e.code === 'limit')) err = e; }
          finally { clearInterval(iv2); }
        }
      }
    }
    if (ai === true && !Pg.stopped && !err && wholeDone) delete d.cnext;
    if (ai === 'mcq' && !wholeDone && !err && !Pg.stopped) { err = new Error('Could not prepare this PDF for Gemini. Try the full “Read the whole PDF with AI”.'); }
    if (ai === true && !Pg.stopped && !err && !wholeDone) {
      let buf = '', pgs = [], imgs = [], np = 0, i = startFrom;
      const flush = async (lastPg) => {
        if (!buf.trim() && !imgs.length) return true;
        const withImg = imgs.length ? ' The attached page picture(s) are pages ' + imgs.map((x) => x.pg).join(', ') + '; read them too.' : '';
        const prompt = AI_RULES + withImg + (buf.trim() ? '\n\nMATERIAL:\n' + buf : '');
        try {
          const r = await LU.ai(prompt, { system: SYS, json: true, temp: 0.2, images: imgs.map((x) => x.im) }), arr = jsonOf(r);
          const all = [...new Set(pgs.concat(imgs.map((x) => x.pg)))].sort((a, b) => a - b);
          if (Array.isArray(arr)) { const res = addPoints(docId, all[0], arr.filter((z) => z && z.s && words(z.s) >= 4).map((z) => ({ t: z.t, h: z.h, s: z.s, ai: 1, pg: all.includes(+z.pg) ? +z.pg : all[0] }))); R.pts += res.added; R.mrg += res.merged; }
          if (/\bMCQ|Answer Codes|\(a\)|\ba\)/i.test(buf)) { try { const r2 = await LU.ai(MCQ_RULES + withImg + '\n\nMATERIAL:\n' + buf, { system: SYS, json: true, temp: 0.1, images: imgs.map((x) => x.im) }), a2 = jsonOf(r2); if (Array.isArray(a2)) { const res2 = addAiMcqs(docId, a2, d.pages); R.mq += res2.added; R.fixed = (R.fixed || 0) + res2.fixed; } } catch (e2) { if (e2 && (e2.code === 'nokey' || e2.code === 'limit')) throw e2; } }
          d.cnext = lastPg + 1; LU.save();
        } catch (e) { err = e || new Error('AI error'); return false; }
        buf = ''; pgs = []; imgs = []; np = 0; return true;
      };
      for (; i <= to; i++) {
        if (Pg.stopped) { next = i; break; }
        Pg.set(25 + ((i - from) / N) * 55, `AI is reading page ${i} of ${to} · ${R.pts} points`);
        const tx = (texts[i] || '').replace(/\s+/g, ' ').trim();
        if (tx.length >= 30) { buf += `\n[Page ${i}]\n` + tx.slice(0, 5000); pgs.push(i); }
        else R.imgs++;
        try { imgs.push({ pg: i, im: await LU.pageImage(docId, i) }); } catch (e) {}
        np++;
        if (buf.length > 7000 || np >= 2) {
          if (!(await flush(i))) { next = i - np + 1; break; }
          if (i < to) await sleep(4500);
        }
      }
      if (!err && !next && !Pg.stopped) { if (!(await flush(to))) next = startFrom; }
      if (err || Pg.stopped) { if (!next) next = Math.max(startFrom, d.cnext || startFrom); d.cnext = next; LU.save(); }
      else { delete d.cnext; LU.save(); }
    }
    /* 3. merge near-copies, then ask AI for MCQ answers */
    const merged2 = consolidate(docId); R.mrg += merged2; LU.save();
    if (ai && !err && !Pg.stopped) {
      const todo = MB().items.filter((x) => x.doc === docId && x.a < 0);
      if (todo.length) { const r = await getAnswers(todo, Pg, 80, 20); R.ans = r.done; R.ansFail = r.fail; if (r.err) err = r.err; }
    }
    const stopped = Pg.stopped; Pg.close(); LU.save();
    if (err && err.code === 'nokey') { LU.push('aikey'); return; }
    const noA = MB().items.filter((x) => x.doc === docId && x.a < 0).length;
    LU.sheet({
      title: stopped ? 'Stopped' : err ? 'Stopped early' : 'Done',
      body: `<div class="row" style="gap:10px"><div class="card grow" style="text-align:center"><div style="font:800 34px var(--fd)">${R.pts}</div><div class="small">new point${R.pts === 1 ? '' : 's'}</div></div><div class="card grow" style="text-align:center"><div style="font:800 34px var(--fd)">${R.mq}</div><div class="small">new MCQ${R.mq === 1 ? '' : 's'}</div></div></div>
        ${R.fixed ? `<p class="small muted" style="margin:8px 0 0">${R.fixed} cut-off question${R.fixed === 1 ? '' : 's'} replaced by the full version from Gemini.</p>` : ''}
        ${R.mrg || R.mqm ? `<p class="small muted" style="margin:8px 0 0">${R.mrg + R.mqm} repeated item${R.mrg + R.mqm === 1 ? '' : 's'} merged into existing ones.</p>` : ''}
        ${ai ? `<p class="small muted" style="margin:6px 0 0">${R.ans} MCQ answer${R.ans === 1 ? '' : 's'} written by AI${R.ansFail ? ', ' + R.ansFail + ' skipped' : ''}. AI can be wrong, check them against your notes.</p>` : noA ? `<p class="small muted" style="margin:6px 0 0">${noA} MCQ${noA === 1 ? ' has' : 's have'} no answer. Run “Read the whole PDF with AI” to get them.</p>` : ''}
        ${err ? `<p class="small" style="color:var(--red);margin:8px 0 0">${esc((err && err.message) || 'AI could not answer right now.')} What was found is saved${d.cnext ? '. Next time choose Resume (page ' + d.cnext + ').' : '.'}</p>` : stopped && d.cnext ? `<p class="small muted" style="margin:8px 0 0">You can resume from page ${d.cnext} later.</p>` : ''}
        ${R.imgs ? `<p class="small muted" style="margin:6px 0 0">${R.imgs} scanned page${R.imgs === 1 ? ' was' : 's were'} read as pictures.</p>` : R.textless > N * 0.6 && !ai ? `<p class="small muted" style="margin:6px 0 0">Most pages have no text (scanned). Use “Read the whole PDF with AI” to read them as pictures.</p>` : ''}`,
      foot: `<button class="btn ghost" id="cdM">MCQ folder</button><button class="btn" id="cdI">Important points</button>`,
      mount: (s) => {
        LU.$('#cdM', s).onclick = () => { LU.closeSheet(true); msub = subjOf(docId); LU.push('mcqsub'); };
        LU.$('#cdI', s).onclick = () => { LU.closeSheet(true); isub = subjOf(docId); LU.push('impsub'); };
      },
    });
    if (LU.currentTab && LU.currentTab() === 'notes') LU.render(true);
  }

  /* =====================================================
     Rotation helpers
     ===================================================== */
  let sel = null; /* bulk-delete selection: null = off, otherwise a Set of ids */
  const ordered = (items) => items.slice().sort((a, b) => (a.rot || 0) - (b.rot || 0));
  LU.mcqSeen = (id, ok) => { const x = MB().items.find((i) => i.id === id); if (x) x.rot = ok ? Date.now() : Date.now() - 2 * DAY; };

  /* a row: tap, long-press (opens the PDF page) and the small ⋯ button */
  function bindRows(el, onTap, onMore) {
    LU.$$('.rrow', el).forEach((row) => {
      let t = null, lp = false, sx = 0, sy = 0;
      const clear = () => { clearTimeout(t); t = null; };
      row.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.rmore') || sel) return;
        lp = false; sx = e.clientX; sy = e.clientY; clear();
        t = setTimeout(() => { lp = true; t = null; LU.vibrate && LU.vibrate(25); openPage(row.dataset.kind, row.dataset.id); }, 520);
      });
      row.addEventListener('pointermove', (e) => { if (t && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) clear(); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach((n) => row.addEventListener(n, clear));
      row.addEventListener('contextmenu', (e) => e.preventDefault());
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        if (e.target.closest('.rmore')) { e.preventDefault(); onMore(row.dataset.id); return; }
        if (lp) { lp = false; return; }
        onTap(row.dataset.id);
      });
    });
  }
  function openPage(kind, id) {
    const x = (kind === 'm' ? MB() : IM()).items.find((i) => i.id === id); if (!x) return;
    if (!LU.doc(x.doc)) { LU.toast('That PDF was removed.'); return; }
    LU.openReader(x.doc, { page: pgsOf(x)[0] || 1 });
  }
  const chk = (id) => (sel ? `<span class="rchk ${sel.has(id) ? 'on' : ''}">${sel.has(id) ? '✓' : ''}</span>` : '');
  const selBar = (shown, kind) => (sel ? `<div class="card" style="display:flex;align-items:center;gap:8px;position:sticky;top:0;z-index:5;margin-top:10px"><b class="grow">${sel.size} selected</b><button class="btn ghost sm" data-act="bkAll" data-kind="${kind}">${sel.size === shown ? 'None' : 'All'}</button><button class="btn danger sm" data-act="bkDel" data-kind="${kind}" ${sel.size ? '' : 'disabled'}>${I('trash')}Delete</button><button class="btn ghost sm" data-act="bkStop">Cancel</button></div>` : `<div class="row" style="margin-top:10px"><button class="btn ghost sm" data-act="bkStart">${I('trash')}Select</button></div>`);
  const rowCss = `<style>.rchk{flex:none;width:24px;height:24px;border-radius:7px;border:2px solid var(--line2);display:grid;place-items:center;font:800 14px var(--fd);color:#fff;margin-top:2px}.rchk.on{background:var(--green);border-color:var(--green)}.rrow{user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;touch-action:pan-y}.rrow.read{opacity:.5}.rrow .rmore{flex:none;width:36px;height:36px;border-radius:10px;display:grid;place-items:center;color:var(--muted);font:700 20px var(--fd);background:transparent;border:0}.rrow .rtick{color:var(--green);font-weight:800}</style>`;

  /* split a merged item back into one per page */
  const splitItem = (kind, x) => {
    const bank = kind === 'm' ? MB() : IM(), pgs = pgsOf(x);
    if (pgs.length < 2) return;
    const i = bank.items.indexOf(x); x.pgs = [pgs[0]]; x.pg = pgs[0];
    const extra = pgs.slice(1).map((p) => Object.assign({}, x, { id: (kind === 'm' ? 'm' : 'p') + LU.uid(), pg: p, pgs: [p], rot: 0 }));
    bank.items.splice(i + 1, 0, ...extra); LU.save(); LU.render(true); LU.toast('Split into ' + pgs.length + ' items.', { sys: false });
  };

  /* =====================================================
     Subject folder grids
     ===================================================== */
  const grid = (items, act, unit) => {
    const ids = subjectIds(items);
    return `<div class="fgrid">${ids.map((id) => { const n = items.filter((x) => itemSub(x) === id).length; return `<div class="fcard" data-act="${act}" data-id="${id}"><span class="fic" style="--c:${scol(id)}">${I('folder')}</span><div class="fnm">${esc(sname(id))}</div><div class="tiny muted">${n} ${unit}${n === 1 ? '' : 's'}</div></div>`; }).join('')}</div>`;
  };

  /* ---------- MCQ ---------- */
  let msub = '';
  LU.views.mcqfolder = {
    render() {
      const all = MB().items, noA = all.filter((x) => x.a < 0).length;
      return `<div class="topbar"><button class="iconbtn" data-act="back">${I('back')}</button><h1>MCQ<span class="sub">${all.length} question${all.length === 1 ? '' : 's'} from your notes</span></h1></div>
        <button class="btn block" data-act="mfCollect">${I('plus')}Collect from a PDF</button>
        ${noA ? `<div class="card tap" data-act="mfAnswers" data-all="1" style="margin-top:12px;display:flex;align-items:center;gap:12px"><span class="lic">${I('star')}</span><div class="grow"><div class="lt">${noA} without an answer</div><div class="small muted">Tap to get answers with AI (needs your Gemini key)</div></div><span class="chev">${I('chev')}</span></div>` : ''}
        <div style="margin-top:14px">${all.length ? grid(all, 'mcqOpenSub', 'question') : `<div class="card small muted">Nothing here yet. Tap “Collect from a PDF”, or open a PDF, tap ⋯ and choose “Collect from this PDF”.</div>`}</div>`;
    },
  };
  const showAns = () => !!LU.state.mcqShow;
  let solve = null;
  LU.actions.mqToggle = () => { LU.state.mcqShow = !LU.state.mcqShow; LU.save(); LU.render(true); };
  const cur = () => { if (!solve) return null; const x = MB().items.find((q) => q.id === solve.ids[solve.i]); return x || null; };
  LU.views.mcqsolve = {
    render() {
      const x = cur(); if (!x) return `<div class="topbar"><button class="iconbtn" data-act="back">${I('back')}</button><h1>Question</h1></div><div class="card small muted">This question is no longer here.</div>`;
      const st = (solve.st[x.id] = solve.st[x.id] || { pick: null, rev: false });
      if (!st.seen) { st.seen = 1; x.rot = Date.now(); LU.save(); }       /* opened: it goes to the bottom of the list */
      const rev = st.rev || showAns(), noA = x.a < 0, n = solve.ids.length;
      return `<div class="topbar"><button class="iconbtn" data-act="back">${I('back')}</button><h1>Question ${solve.i + 1} of ${n}<span class="sub">${esc(sname(msub))} · ${esc(dname(x.doc).slice(0, 22))} · ${pgLabel(x)}</span></h1></div>
        ${LU.bar((solve.i + 1) / n, 'thin')}
        <div class="card" style="margin-top:12px;line-height:1.5">${esc(x.q)}</div>
        <div class="list" style="margin-top:12px">${x.o.map((t, i) => {
          const good = rev && !noA && i === x.a, bad = rev && st.pick === i && i !== x.a;
          const sty = good ? 'style="border-color:var(--green);background:rgba(60,200,120,.14)"' : bad ? 'style="border-color:var(--red);background:rgba(240,80,100,.14)"' : st.pick === i ? 'style="border-color:var(--cy,#4ad)"' : '';
          return `<div class="li" ${rev ? '' : `data-act="mqsPick" data-i="${i}"`} ${sty}><span class="lic" style="font:700 14px var(--fd)">${L[i]}</span><div class="grow">${esc(t)}</div></div>`;
        }).join('')}</div>
        ${noA ? `<div class="card small muted" style="margin-top:12px">This question has no answer yet. Use “Get answers with AI” in the list, or set it with the ⋯ button.</div>`
          : rev ? `<div class="card" style="margin-top:12px"><b>${st.pick == null ? 'Answer: ' + L[x.a] + '.' : st.pick === x.a ? 'Correct.' : 'Not quite. Answer: ' + L[x.a] + '.'}</b>${x.ai ? ' <span class="tag ai">AI answer</span>' : ''}${x.e ? `<div class="small" style="margin-top:6px;line-height:1.45">${esc(x.e)}</div>` : ''}${x.ai ? `<div class="small muted" style="margin-top:6px">AI can be wrong, check it against your notes.</div>` : ''}</div>` : ''}
        ${!rev && !noA ? `<button class="btn ghost block" style="margin-top:12px" data-act="mqsShow">Show answer</button>` : ''}
        <div style="display:flex;gap:8px;margin-top:12px"><button class="btn ghost block" data-act="mqsPrev" ${solve.i ? '' : 'disabled'}>${I('back')}Previous</button><button class="btn block" data-act="mqsNext" ${solve.i + 1 < n ? '' : 'disabled'}>Next${I('chev')}</button></div>
        ${LU.doc(x.doc) ? `<div class="row" style="margin-top:10px"><button class="btn ghost sm" data-act="mqsPage">Open PDF page</button></div>` : ''}
        <div style="height:20px"></div>`;
    },
  };
  LU.actions.mqsPick = (el) => {
    const x = cur(); if (!x || x.a < 0) return; const st = solve.st[x.id]; if (st.rev) return;
    st.pick = +el.dataset.i; st.rev = true; LU.mcqSeen(x.id, st.pick === x.a);   /* a wrong guess comes back sooner */
    LU.vibrate && LU.vibrate(st.pick === x.a ? 10 : 30); LU.save(); LU.render(true);
  };
  LU.actions.mqsShow = () => { const x = cur(); if (!x) return; solve.st[x.id].rev = true; LU.save(); LU.render(true); };
  LU.actions.mqsNext = () => { if (solve && solve.i + 1 < solve.ids.length) { solve.i++; LU.render(false); } };
  LU.actions.mqsPrev = () => { if (solve && solve.i > 0) { solve.i--; LU.render(false); } };
  LU.actions.mqsPage = () => { const x = cur(); if (x) openPage('m', x.id); };
  const msItems = () => MB().items.filter((x) => itemSub(x) === msub);
  LU.views.mcqsub = {
    render() {
      const items = ordered(msItems()), withA = items.filter((x) => x.a >= 0).length, noA = items.length - withA, seen = items.filter((x) => x.rot).length;
      return `<div class="topbar"><button class="iconbtn" data-act="back">${I('back')}</button><h1>${esc(sname(msub))}<span class="sub">${items.length} question${items.length === 1 ? '' : 's'} · tap: answer · hold: PDF page</span></h1></div>
        <div style="display:flex;gap:8px"><button class="btn block" data-act="mfPractise" ${withA ? '' : 'disabled'}>${I('target')}Practise ${withA}</button><button class="btn ghost block" data-act="mfCollect">${I('plus')}From a PDF</button></div>
        <div class="row" style="margin-top:10px;gap:8px;align-items:center"><button class="btn ghost sm" data-act="mqToggle">${I('target')}Answers: ${showAns() ? 'Shown' : 'Hidden'}</button><span class="small muted">${showAns() ? 'Answers are visible in the list' : 'Think first, then tap an option'}</span></div>
        ${noA ? `<div class="card tap" data-act="mfAnswers" style="margin-top:12px;display:flex;align-items:center;gap:12px"><span class="lic">${I('star')}</span><div class="grow"><div class="lt">${noA} without an answer</div><div class="small muted">Tap to get answers with AI</div></div><span class="chev">${I('chev')}</span></div>` : ''}
        ${seen && !sel ? `<div class="row" style="margin-top:10px"><button class="btn ghost sm" data-act="mfReset">Reset order</button></div>` : ''}${items.length ? selBar(items.length, 'm') : ''}
        ${rowCss}<div class="list" style="margin-top:12px">${items.map((x) => `<div class="li rrow ${x.rot && !sel ? 'read' : ''}" data-kind="m" data-id="${x.id}" style="align-items:flex-start">${chk(x.id)}<div class="grow"><div class="lt" style="font-weight:500;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${x.rot ? '<span class="rtick">✓ </span>' : ''}${esc(x.q)}</div><div class="ls">${x.a < 0 ? '<span class="tag no">No answer</span> · ' : showAns() ? `<span class="tag ${x.ai ? 'ai' : 'ok'}">${x.ai ? 'AI answer' : 'Answer'} ${L[x.a]}</span> · ` : ''}${esc(dname(x.doc).slice(0, 24))} · ${pgLabel(x)}</div></div>${sel ? '' : '<button class="rmore" aria-label="More">⋯</button>'}</div>`).join('')}</div>
        <div style="height:20px"></div>`;
    },
    mount(el) {
      bindRows(el, (id) => {
        if (sel) { sel.has(id) ? sel.delete(id) : sel.add(id); LU.render(true); return; }
        const ids = ordered(msItems()).map((q) => q.id), at = ids.indexOf(id); if (at < 0) return;
        solve = { ids, i: at, st: {} }; LU.push('mcqsolve');
      }, (id) => moreSheet('m', id));
    },
  };
  const shownIds = (kind) => (kind === 'm' ? msItems() : isItems()).map((x) => x.id);
  LU.actions.bkStart = () => { sel = new Set(); LU.render(true); };
  LU.actions.bkStop = () => { sel = null; LU.render(true); };
  LU.actions.bkAll = (el) => { const ids = shownIds(el.dataset.kind); sel = sel && sel.size === ids.length ? new Set() : new Set(ids); LU.render(true); };
  LU.actions.bkDel = (el) => {
    if (!sel || !sel.size) return; const n = sel.size, kind = el.dataset.kind, ids = new Set(sel);
    LU.confirm('Delete ' + n + ' item' + (n === 1 ? '' : 's') + '?', 'This removes them from this folder. The PDF is not touched.', 'Delete', () => {
      const bank = kind === 'm' ? MB() : IM(); bank.items = bank.items.filter((x) => !ids.has(x.id)); sel = null; LU.save(); LU.render(true); LU.toast(n + ' deleted.', { sys: false });
    }, true);
  };
  LU.actions.openMcqFolder = () => { msub = ''; LU.push('mcqfolder'); };
  LU.actions.mcqOpenSub = (el) => { sel = null; msub = el.dataset.id; LU.push('mcqsub'); };
  LU.actions.mfCollect = () => pickDoc('Collect from…', (id) => LU.collectAll(id));
  LU.actions.mfReset = () => { msItems().forEach((x) => (x.rot = 0)); LU.save(); LU.render(true); LU.toast('Order restored.', { sys: false }); };
  LU.actions.mfPractise = () => {
    const items = ordered(msItems()).filter((x) => x.a >= 0); if (!items.length) { LU.toast('Add answers first.'); return; }
    const m = LU.state.mcq = Object.assign({ sets: [], log: [], stat: {}, wrong: {} }, LU.state.mcq || {});
    const qs = items.map((x) => ({ id: x.id, q: x.q, o: x.o, a: x.a, e: x.e || '', tag: dname(x.doc).slice(0, 24) }));
    const name = 'MCQ · ' + sname(msub); let set = m.sets.find((x) => x.id === 'mcqfolder');
    if (set) { set.name = name; set.qs = qs; } else m.sets.push({ id: 'mcqfolder', name, qs });
    LU.save(); LU.actions.mqSet({ dataset: { id: 'mcqfolder' } });
  };
  LU.actions.mfAnswers = async (el) => {
    if (!LU.aiKey || !LU.aiKey()) { LU.toast('Add your free Gemini key first: More › AI helper.', { ms: 3500 }); LU.push('aikey'); return; }
    const all = el && el.dataset && el.dataset.all, todo = (all ? MB().items : msItems()).filter((x) => x.a < 0); if (!todo.length) return;
    const Pg = prog('Getting answers', 100), r = await getAnswers(todo, Pg, 0, 100);
    Pg.close(); LU.save(); LU.render(true);
    if (r.err && r.err.code === 'nokey') { LU.push('aikey'); return; }
    LU.toast(r.done + ' answered by AI' + (r.fail ? ', ' + r.fail + ' skipped' : '') + (r.err ? '. ' + (r.err.message || 'AI stopped.') : '. Check them against your notes.'), { ms: 4500 });
  };

  /* ---------- Important points ---------- */
  let isub = '', ipT = '', ipQ = '';
  LU.views.impfolder = {
    render() {
      const all = IM().items;
      return `<div class="topbar"><button class="iconbtn" data-act="back">${I('back')}</button><h1>Important points<span class="sub">${all.length} point${all.length === 1 ? '' : 's'} from your notes</span></h1></div>
        <div style="display:flex;gap:8px"><button class="btn block" data-act="mfCollect">${I('plus')}Collect from a PDF</button><button class="btn ghost block" data-act="ipNew">${I('edit')}Add my own</button></div>
        <div style="margin-top:14px">${all.length ? grid(all, 'impOpenSub', 'point') : `<div class="card small muted">Nothing here yet. Tap “Collect from a PDF”, or open a PDF, tap ⋯ and choose “Collect from this PDF”.</div>`}</div>`;
    },
  };
  const isItems = () => { const q = ipQ.trim().toLowerCase(); return IM().items.filter((x) => itemSub(x) === isub && (!ipT || x.t === ipT) && (!q || (x.s + ' ' + x.c + ' ' + dname(x.doc)).toLowerCase().includes(q))); };
  LU.views.impsub = {
    render() {
      const mine = IM().items.filter((x) => itemSub(x) === isub), items = ordered(isItems()), types = TYPES.filter((t) => mine.some((x) => x.t === t)), seen = mine.filter((x) => x.rot).length;
      return `<div class="topbar"><button class="iconbtn" data-act="back">${I('back')}</button><h1>${esc(sname(isub))}<span class="sub">${mine.length} point${mine.length === 1 ? '' : 's'} · tap: done · hold: PDF page</span></h1></div>
        <div style="display:flex;gap:8px"><button class="btn block" data-act="mfCollect">${I('plus')}From a PDF</button><button class="btn ghost block" data-act="ipNew">${I('edit')}Add my own</button></div>
        <div class="search" style="margin-top:12px">${I('search')}<input id="ipq" type="text" placeholder="Search points" value="${esc(ipQ)}" autocomplete="off"></div>
        ${types.length > 1 ? `<div class="chips" style="margin-top:10px"><button class="chip ${ipT ? '' : 'on'}" data-act="ipType" data-t="">All</button>${types.map((t) => `<button class="chip ${ipT === t ? 'on' : ''}" data-act="ipType" data-t="${t}"><i class="cdot" style="background:${TCOL[t]}"></i>${t} ${mine.filter((x) => x.t === t).length}</button>`).join('')}</div>` : ''}
        ${mine.some((x) => x.doc && !x.ai) && !sel ? `<div class="card tap" data-act="ipClean" style="margin-top:10px"><div class="lt">Remove rough points</div><div class="small muted">Deletes points from the free scan and old versions. AI notes and your own points stay.</div></div>` : ''}${items.length ? selBar(items.length, 'p') : ''}${items.length && !sel ? `<div class="row" style="margin-top:10px;gap:8px;flex-wrap:wrap"><button class="btn ghost sm" data-act="ipCards">${I('book')}Make ${items.length > 40 ? '40' : items.length} flashcards</button><button class="btn ghost sm" data-act="ipCopy">${I('copy')}Copy list</button>${seen ? `<button class="btn ghost sm" data-act="ipReset">Reset order</button>` : ''}</div>` : ''}
        ${rowCss}<div class="list" style="margin-top:12px">${items.map((x) => `<div class="li rrow ${x.rot && !sel ? 'read' : ''}" data-kind="p" data-id="${x.id}" style="align-items:flex-start">${chk(x.id)}<span class="tag" style="background:${TCOL[x.t] || '#8a93a6'}22;color:${TCOL[x.t] || '#8a93a6'};flex:none;margin-top:2px">${x.t}</span><div class="grow">${x.h ? `<div class="tiny" style="color:${TCOL[x.t] || '#8a93a6'};font-weight:700;margin-bottom:2px">${esc(x.h)}</div>` : ''}<div style="font:500 14.5px/1.45 var(--fu)">${x.rot ? '<span class="rtick">✓ </span>' : ''}${esc(x.s)}</div>${x.c ? `<div class="small muted" style="margin-top:2px;line-height:1.4">${esc(x.c)}</div>` : ''}<div class="ls">${esc(dname(x.doc).slice(0, 24))}${pgLabel(x) ? ' · ' + pgLabel(x) : ''}</div></div>${sel ? '' : '<button class="rmore" aria-label="More">⋯</button>'}</div>`).join('') || `<div class="li"><div class="grow small muted">Nothing matches.</div></div>`}</div>
        <div style="height:20px"></div>`;
    },
    mount(el) {
      const inp = LU.$('#ipq', el);
      if (inp) { let t; inp.oninput = () => { clearTimeout(t); t = setTimeout(() => { ipQ = inp.value; LU.render(true); const n = LU.$('#ipq'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 200); }; }
      bindRows(el, (id) => {
        if (sel) { sel.has(id) ? sel.delete(id) : sel.add(id); LU.render(true); return; }
        const x = IM().items.find((i) => i.id === id); if (!x) return;
        x.rot = Date.now(); LU.save(); LU.vibrate && LU.vibrate(8); LU.render(true);
      }, (id) => moreSheet('p', id));
    },
  };
  LU.actions.openImpFolder = () => { isub = ''; ipT = ''; ipQ = ''; LU.push('impfolder'); };
  LU.actions.impOpenSub = (el) => { sel = null; isub = el.dataset.id; ipT = ''; ipQ = ''; LU.push('impsub'); };
  LU.actions.ipNew = () => P.ipForm({ id: 'p' + LU.uid(), t: 'Fact', s: '', c: '', doc: '', pg: 0, pgs: [], subj: isub && isub !== '_uns' ? isub : '', at: Date.now(), rot: 0 }, true);
  LU.actions.ipType = (el) => { ipT = el.dataset.t || ''; LU.render(true); };
  LU.actions.ipClean = () => {
    const b = IM(), bad = b.items.filter((x) => x.doc && !x.ai); if (!bad.length) return;
    LU.confirm('Remove ' + bad.length + ' rough points?', 'These came from the free scan or older versions. Notes made by AI and points you added yourself stay.', 'Remove', () => {
      b.items = b.items.filter((x) => !bad.includes(x)); LU.save(); LU.render(true); LU.toast(bad.length + ' removed.', { sys: false });
    }, true);
  };
  LU.actions.ipReset = () => { IM().items.filter((x) => itemSub(x) === isub).forEach((x) => (x.rot = 0)); LU.save(); LU.render(true); LU.toast('Order restored.', { sys: false }); };
  LU.actions.ipCopy = async () => { const t = ordered(isItems()).map((x) => `• ${x.h ? x.h + ': ' : ''}${x.s}${x.c ? ' — ' + x.c : ''}`).join('\n'); LU.toast((await LU.copyText(t)) ? 'Copied ' + isItems().length + ' points.' : 'Could not copy.', { sys: false }); };
  LU.actions.ipCards = () => {
    const items = ordered(isItems()).slice(0, 40); if (!items.length || !LU.cardsAdd) return;
    const n = LU.cardsAdd('Important points', items.map((x) => ({ f: x.h ? `Recall: ${x.h}` : `Recall this ${x.t.toLowerCase()} point`, b: x.s + (x.c ? ' — ' + x.c : '') })));
    LU.toast((n || items.length) + ' flashcards added. Find them in More › Flashcards.', { ms: 3500 });
  };

  /* small ⋯ menu on a row: edit, open page, split a merged item, delete */
  function moreSheet(kind, id) {
    const bank = kind === 'm' ? MB() : IM(), x = bank.items.find((i) => i.id === id); if (!x) return;
    const pgs = pgsOf(x);
    LU.sheet({
      title: kind === 'm' ? 'Question' : 'Point',
      body: `<div class="list">
        <div class="li" id="mrE"><span class="lic">${I('edit')}</span><div class="grow"><div class="lt">${kind === 'm' ? 'Edit or set the answer' : 'Edit'}</div></div></div>
        ${LU.doc(x.doc) && pgs.length ? `<div class="li" id="mrP"><span class="lic">${I('notes')}</span><div class="grow"><div class="lt">Open the PDF page</div><div class="ls">${pgLabel(x)}</div></div></div>` : ''}
        ${pgs.length > 1 ? `<div class="li" id="mrS"><span class="lic">${I('loop')}</span><div class="grow"><div class="lt">Split into ${pgs.length} separate items</div><div class="ls">Use this if two different things were merged by mistake</div></div></div>` : ''}
        <div class="li" id="mrD"><span class="lic">${I('trash')}</span><div class="grow"><div class="lt" style="color:var(--red)">Delete</div></div></div></div>`,
      mount: (s) => {
        LU.$('#mrE', s).onclick = () => { LU.closeSheet(true); kind === 'm' ? LU.actions.mfItem({ dataset: { id } }) : P.ipForm(x); };
        const p = LU.$('#mrP', s); if (p) p.onclick = () => { LU.closeSheet(true); openPage(kind, id); };
        const sp = LU.$('#mrS', s); if (sp) sp.onclick = () => { LU.closeSheet(true); splitItem(kind, x); };
        LU.$('#mrD', s).onclick = () => { LU.closeSheet(true); bank.items = bank.items.filter((i) => i.id !== id); LU.save(); LU.render(true); LU.toast('Removed.', { sys: false }); };
      },
    });
  }

  /* =====================================================
     Quests nobody touched for a whole day are marked Missed (same red cross, no XP change)
     ===================================================== */
  const baseRoll = LU.rollover;
  LU.autoMiss = () => {
    const st = LU.state, today = LU.todayKey(), yest = LU.addDays(today, -1);
    if (!st.autoMissDone) { st.autoMissDone = yest; LU.save(); return 0; }   /* nothing is marked backwards */
    let k = LU.addDays(st.autoMissDone, 1), n = 0;
    const lim = LU.addDays(today, -30); if (k < lim) k = lim;
    while (k <= yest) {
      const d0 = st.days[k];
      if (!(d0 && d0.rest)) {
        const qs = LU.questsFor(k).filter((q) => !q.info && !q.skipped && !q.done && !q.missed);
        if (qs.length) { const d = LU.day(k); qs.forEach((q) => { d.miss[q.id] = { t: q.title, kind: q.kind, xp: q.xp || 0, at: Date.now(), auto: 1 }; n++; }); }
      }
      k = LU.addDays(k, 1);
    }
    st.autoMissDone = yest; LU.save();
    return n;
  };
  LU.rollover = () => { baseRoll(); try { LU.autoMiss(); } catch (e) { console.error(e); } };
  LU.p18 = { addPoints, addMcqs, consolidate, similar, subjOf };
})();
