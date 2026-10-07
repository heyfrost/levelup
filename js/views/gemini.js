/* Part 13: optional AI helper (Google Gemini). Needs the person's own API key and internet. Nothing is sent unless they use a feature. */
(function () {
  const LU = window.LU, esc = LU.esc, I = LU.icon;
  const KEY = 'levelup.gkey', MOD = 'levelup.gmodel', DEF_MODEL = 'gemini-flash-latest';
  const head = (t, sub) => `<div class="topbar"><button class="iconbtn" data-act="back" aria-label="Back">${I('back')}</button><h1>${t}${sub ? `<span class="sub">${sub}</span>` : ''}</h1></div>`;
  const li = (act, icon, t, sub, data) => `<div class="li" data-act="${act}" ${data || ''}><span class="lic">${I(icon)}</span><div class="grow"><div class="lt">${t}</div>${sub ? `<div class="ls">${sub}</div>` : ''}</div><span class="chev">${I('chev')}</span></div>`;
  const get = (k) => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  const set = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) {} };
  LU.aiKey = () => get(KEY);
  LU.aiModel = () => get(MOD) || DEF_MODEL;

  /* ---------- the one call that talks to Gemini ---------- */
  const BASE = 'https://generativelanguage.googleapis.com/v1beta/';
  const cancelled = () => Object.assign(new Error('Cancelled.'), { code: 'cancel' });
  const sleep = (ms, sig) => new Promise((res) => { const t = setTimeout(res, ms); if (sig) sig.addEventListener('abort', () => { clearTimeout(t); res(); }); });
  /* the models this key may use (generateContent only) */
  LU.aiList = async (signal) => {
    const key = LU.aiKey(); if (!key) throw Object.assign(new Error('Add your Gemini key first.'), { code: 'nokey' });
    let r; try { r = await fetch(BASE + 'models?pageSize=200', { headers: { 'x-goog-api-key': key }, signal }); } catch (e) { throw new Error('No internet, or Gemini could not be reached.'); }
    if (!r.ok) throw new Error('Could not list models (error ' + r.status + '). Check your key.');
    const j = await r.json();
    return (j.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => String(m.name || '').replace('models/', '')).filter(Boolean);
  };
  let autoModel = '';   // a working model found automatically, kept until the app closes
  LU.aiUsed = '';
  LU.ai = async (prompt, o = {}) => {
    const key = LU.aiKey();
    if (!key) { const e = new Error('Add your Gemini key first.'); e.code = 'nokey'; throw e; }
    const parts = [{ text: prompt }].concat((o.images || []).map((im) => ({ inline_data: { mime_type: im.mime, data: im.data } })));
    const contents = (o.history || []).map((h) => ({ role: h.role, parts: [{ text: h.text }] })).concat([{ role: 'user', parts }]);
    const body = { contents, generationConfig: Object.assign({ temperature: o.temp == null ? 0.4 : o.temp }, o.json ? { responseMimeType: 'application/json' } : {}) };
    if (o.system) body.systemInstruction = { parts: [{ text: o.system }] };
    const once = async (model) => {
      const ac = new AbortController(), t = setTimeout(() => ac.abort(), o.timeout || 90000), onAbort = () => ac.abort();
      if (o.signal) o.signal.addEventListener('abort', onAbort);
      try {
        const r = await fetch(BASE + 'models/' + encodeURIComponent(model) + ':generateContent', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body), signal: ac.signal });
        let j = null, m = ''; try { j = await r.json(); m = ((j || {}).error || {}).message || ''; } catch (e) {}
        return { ok: r.ok, status: r.status, j, m };
      } catch (e) {
        if (o.signal && o.signal.aborted) throw cancelled();
        throw new Error(ac.signal.aborted ? 'Gemini took too long. Try again.' : 'No internet, or Gemini could not be reached.');
      } finally { clearTimeout(t); if (o.signal) o.signal.removeEventListener('abort', onAbort); }
    };
    const queue = [autoModel || LU.aiModel(), 'gemini-flash-latest', 'gemini-flash-lite-latest'], tried = new Set();
    let listed = false, last = 0, limitMsg = '';
    while (queue.length) {
      const model = queue.shift(); if (!model || tried.has(model)) continue; tried.add(model);
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await once(model);
        if (res.ok) {
          const text = (((res.j.candidates || [])[0] || {}).content || { parts: [] }).parts.map((p) => p.text || '').join('').trim();
          if (!text) throw new Error(res.j.promptFeedback && res.j.promptFeedback.blockReason ? 'Gemini declined this one (' + res.j.promptFeedback.blockReason + ').' : 'Gemini sent an empty answer. Try again.');
          LU.aiUsed = model; if (model !== LU.aiModel()) autoModel = model;
          return text;
        }
        last = res.status;
        if (res.status === 429) { limitMsg = res.m || 'limit'; break; }                  // this model is out of free quota: try the next one
        if (res.status === 400 && /api key/i.test(res.m)) throw Object.assign(new Error('Your key was not accepted. Check it in AI settings.'), { code: 'nokey' });
        if (res.status === 403) throw Object.assign(new Error('This key is not allowed to use Gemini. Check it in AI settings.'), { code: 'nokey' });
        if (res.status === 404) break;                                   // wrong or retired model: try the next one
        if (res.status >= 500) {                                         // Google is busy: wait and retry, then try the next model
          if (attempt < 2) { await sleep(2500 * (attempt + 1), o.signal); if (o.signal && o.signal.aborted) throw cancelled(); continue; }
          break;
        }
        throw new Error('Gemini error ' + res.status + (res.m ? ': ' + res.m.slice(0, 120) : ''));
      }
      if (!queue.length && !listed) {
        listed = true;
        try { (await LU.aiList(o.signal)).filter((n) => /flash/.test(n) && !/image|tts|live|audio|embed|thinking|exp|-\d{3}$/.test(n)).sort().reverse().slice(0, 4).forEach((n) => queue.push(n)); } catch (e) { if (e.code === 'nokey') throw e; }
      }
    }
    if (limitMsg) {
      const why = /per ?day|daily/i.test(limitMsg) ? 'Daily free limit reached on every model of your key. It resets around 12:30 PM IST.' : /limit: ?0|not available|no free/i.test(limitMsg) ? 'Your key has no free quota for these models. Check aistudio.google.com (usage / rate limits).' : 'Free limit reached for now. Wait a minute and try again.';
      throw Object.assign(new Error(why + (limitMsg.length > 5 ? ' Google says: ' + limitMsg.slice(0, 140) : '')), { code: 'limit' });
    }
    throw new Error(last >= 500 ? 'Gemini is very busy right now. Wait a minute and try again.' : 'No working Gemini model was found for your key. Open AI settings and tap “Show models for my key”.');
  };

  /* ---------- small UI helpers ---------- */
  const fmt = (t) => {
    let out = '', ul = false;
    esc(String(t || '')).split('\n').forEach((raw) => {
      const ln = raw.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'), m = ln.match(/^\s*[*\-•]\s+(.*)/);
      if (m) { if (!ul) { out += '<ul style="margin:6px 0 6px 18px;padding:0">'; ul = true; } out += '<li>' + m[1] + '</li>'; return; }
      if (ul) { out += '</ul>'; ul = false; }
      const h = ln.match(/^#{1,4}\s+(.*)/);
      out += h ? `<div style="font-weight:700;margin:10px 0 4px">${h[1]}</div>` : ln.trim() ? `<p style="margin:6px 0">${ln}</p>` : '';
    });
    return out + (ul ? '</ul>' : '');
  };
  LU.aiFmt = fmt;
  const busy = (msg) => {
    const d = document.createElement('div'); d.className = 'aibusy';
    d.innerHTML = `<div class="aib"><div class="aispin"></div><div>${esc(msg)}</div><button class="btn ghost sm" type="button">Cancel</button></div>`;
    document.body.appendChild(d); const ac = new AbortController(); d.querySelector('button').onclick = () => ac.abort();
    return { signal: ac.signal, done: () => d.remove() };
  };
  const fail = (e) => {
    if (e && e.code === 'cancel') return;
    LU.toast((e && e.message) || 'Something went wrong.', { ms: 5000 });
    if (e && e.code === 'nokey') LU.push('aikey');
  };
  /* run a call with a "thinking" overlay; returns null on failure */
  const task = async (msg, prompt, o) => {
    const b = busy(msg);
    try { return await LU.ai(prompt, Object.assign({ signal: b.signal }, o)); } catch (e) { fail(e); return null; } finally { b.done(); }
  };
  LU.aiTask = task;
  const result0 = (title, text, extra) => LU.sheet({
    title, body: `<div class="aires">${fmt(text)}</div>${extra ? extra.html : ''}`,
    foot: `<button class="btn ghost" id="aiCp">Copy</button>${extra && extra.note ? `<button class="btn ghost" id="aiNote">Note</button>` : ''}<button class="btn" data-act="closeSheet">Done</button>`,
    mount: (s) => { if (extra && extra.note) LU.$('#aiNote', s).onclick = () => { LU.closeSheet(true); extra.note(); }; LU.$('#aiCp', s).onclick = async () => LU.toast((await LU.copyText(text)) ? 'Copied.' : 'Could not copy.', { sys: false }); if (extra && extra.mount) extra.mount(s); },
  });
  const result = result0;
  const jsonOf = (t) => { try { return JSON.parse(t); } catch (e) { const m = String(t).match(/[\[{][\s\S]*[\]}]/); try { return m ? JSON.parse(m[0]) : null; } catch (e2) { return null; } } };
  const SYS = 'You are a careful, concise mentor for an Indian UPSC Civil Services aspirant (Prelims and Mains). Use simple words. Be accurate. If you are not sure of a fact, say so instead of guessing. Never invent facts, figures, article numbers or case names.';

  /* images */
  const fileImage = (file, max = 1600) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onerror = () => rej(new Error('Could not read the photo.'));
    r.onload = () => { const im = new Image(); im.onerror = () => rej(new Error('Not an image.')); im.onload = () => {
      const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res({ mime: 'image/jpeg', data: c.toDataURL('image/jpeg', 0.85).split(',')[1] });
    }; im.src = r.result; };
    r.readAsDataURL(file);
  });
  LU.pageImage = async (docId, pg, width = 1100) => {
    const pdf = await LU.openDoc(docId), page = await pdf.getPage(pg), v1 = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: width / v1.width });
    const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: x, viewport: vp }).promise; page.cleanup && page.cleanup();
    return { mime: 'image/jpeg', data: c.toDataURL('image/jpeg', 0.8).split(',')[1] };
  };
  const pageText = async (docId, pg) => { const pdf = await LU.openDoc(docId), p = await pdf.getPage(pg), tc = await p.getTextContent(); return tc.items.map((x) => x.str).join(' ').replace(/\s+/g, ' ').trim(); };
  const pickPhoto = (cb) => {
    const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*'; f.style.display = 'none'; document.body.appendChild(f);
    f.onchange = async () => { const file = f.files[0]; f.remove(); if (!file) return; try { cb(await fileImage(file)); } catch (e) { LU.toast(e.message); } };
    f.click();
  };

  /* ---------- importing what Gemini writes ---------- */
  const addMcqs = (text, setName) => {
    const r = LU.mcqParse(text.replace(/\*\*/g, '').replace(/^\s*```\w*\s*$/gm, ''));
    if (!r.qs.length) return 0;
    const s = LU.state; s.mcq = Object.assign({ sets: [], log: [], stat: {}, wrong: {} }, s.mcq || {});
    const ex = s.mcq.sets.find((x) => x.name.toLowerCase() === setName.toLowerCase());
    if (ex) ex.qs = ex.qs.concat(r.qs); else s.mcq.sets.push({ id: LU.uid(), name: setName, qs: r.qs });
    LU.save(); return r.qs.length;
  };
  const MCQ_FORMAT = 'Write each question in exactly this plain text format (no markdown, no numbering), with one blank line between questions:\nQ: question text\nA) option\nB) option\nC) option\nD) option\nAnswer: B\nExp: one short line why\nTag: subject name';

  /* =========================================================
     Tools that work on a piece of text or a page image
     ctx = { label, text, images }
     ========================================================= */
  const material = (ctx) => (ctx.text ? '\n\nMATERIAL:\n' + ctx.text.slice(0, 12000) : ctx.images && ctx.images.length ? '\n\n(The material is in the attached page image.)' : '');
  const textTools = (ctx) => {
    const plain = (t) => String(t).replace(/\*\*/g, '').replace(/^\s*[*-]\s+/gm, '• ').trim();
    const result = (title, text, extra) => result0(title, text, extra || (ctx.onNote && !/MCQs added|flashcards added/.test(title) ? { html: '', note: () => ctx.onNote(plain(text)) } : null));
    LU.sheet({
      title: 'Ask AI',
      body: `<p class="small muted" style="margin:0 0 10px">${esc(ctx.label)}${ctx.text ? ' · ' + ctx.text.length + ' characters' : ctx.images ? ' · scanned page (sent as a picture)' : ''}</p>
        <div class="list">${[['explain', 'Explain simply', 'star'], ['summary', 'Short summary', 'list'], ['mnem', 'Memory trick', 'star'], ['mcq', 'Make 5 MCQs', 'target'], ['cards', 'Make flashcards', 'book']].map(([k, t, ic]) => `<div class="li" data-ai="${k}"><span class="lic">${I(ic)}</span><div class="grow lt">${t}</div></div>`).join('')}</div>
        <div class="field" style="margin-top:12px"><label>Or ask your own question about it</label><textarea class="inp" id="aiQ" rows="2" maxlength="500" placeholder="e.g. Why was this important?"></textarea><button class="btn block" id="aiAsk" style="margin-top:8px">Ask</button></div>
        <p class="small muted">The text above is sent to Google Gemini. Do not use this for private things.</p>`,
      mount: (s) => {
        const imgs = ctx.images || [];
        const run = async (k) => {
          LU.closeSheet(true);
          if (k === 'explain') { const r = await task('Explaining…', 'Explain the material below simply for a UPSC aspirant. Use short bullet points and simple words. End with "Exam angle:" and 2 points that could be asked.' + material(ctx), { system: SYS, images: imgs }); if (r) result('Explained', r); }
          else if (k === 'summary') { const r = await task('Summarising…', 'Summarise the material below in at most 6 short bullet points, keeping names, dates and numbers exactly.' + material(ctx), { system: SYS, images: imgs }); if (r) result('Summary', r); }
          else if (k === 'mnem') { const r = await task('Thinking…', 'Make 2 easy memory tricks (mnemonic, story or acronym) for the key facts in the material below. Show what each letter or part stands for.' + material(ctx), { system: SYS, images: imgs }); if (r) result('Memory trick', r); }
          else if (k === 'mcq') {
            const r = await task('Writing MCQs…', 'Write 5 UPSC Prelims style MCQs based only on the material below. Make wrong options plausible. ' + MCQ_FORMAT + material(ctx), { system: SYS, images: imgs, temp: 0.5 });
            if (r) { const n = addMcqs(r, 'AI · ' + ctx.label.slice(0, 30)); if (n) result(n + ' MCQs added', 'They are in Study tools › Practice MCQs, in the set “AI · ' + ctx.label.slice(0, 30) + '”.\n\nAI can make mistakes. Check the answers against your notes.'); else result('Could not read the questions', r); }
          } else if (k === 'cards') {
            const r = await task('Making flashcards…', 'Make 6 to 10 flashcards from the material below. Each has a short question on the front and a short answer on the back. Reply as JSON: [{"f":"question","b":"answer"}].' + material(ctx), { system: SYS, images: imgs, json: true });
            if (r) { const a = jsonOf(r); const n = Array.isArray(a) ? LU.cardsAdd('AI · ' + ctx.label.slice(0, 30), a) : 0; if (n) result(n + ' flashcards added', 'Find them in More › Flashcards, deck “AI · ' + ctx.label.slice(0, 30) + '”.'); else result('Could not read the cards', r); }
          }
        };
        LU.$$('[data-ai]', s).forEach((b) => (b.onclick = () => run(b.dataset.ai)));
        LU.$('#aiAsk', s).onclick = async () => {
          const q = LU.$('#aiQ', s).value.trim(); if (!q) { LU.toast('Type your question.'); return; }
          LU.closeSheet(true);
          const r = await task('Thinking…', 'Question: ' + q + '\nAnswer using the material below where it helps. Keep it short.' + material(ctx), { system: SYS, images: imgs }); if (r) result('Answer', r);
        };
      },
    });
  };
  LU.aiTextTools = textTools;

  /* from the PDF reader: this page */
  LU.aiPage = async (docId, pg) => {
    const d = LU.doc(docId); if (!d) return;
    if (!LU.aiKey()) { fail(Object.assign(new Error('Add your Gemini key first.'), { code: 'nokey' })); return; }
    let text = ''; try { text = await pageText(docId, pg); } catch (e) {}
    const label = d.name.slice(0, 24) + ' p' + pg;
    if (text.length >= 40) { textTools({ label, text }); return; }
    try { textTools({ label, images: [await LU.pageImage(docId, pg)] }); } catch (e) { LU.toast('Could not read this page.'); }
  };

  /* ---------- hub ---------- */
  LU.views.ai = {
    render() {
      const on = !!LU.aiKey();
      return head('AI helper', 'Google Gemini') + `
        <div class="list">${li('openAiKey', 'lock', 'AI settings', on ? 'Key saved on this phone · model ' + esc(LU.aiModel()) : 'Add your free key to start')}</div>
        <div class="sec-title">Write and check</div>
        <div class="list">${li('openAiAns', 'pen', 'Check my answer', 'Score, gaps and a better structure')}${li('aiPhoto', 'image', 'Handwriting to text', 'Photo of your answer, typed out')}${li('openAiChat', 'news', 'Ask a doubt', 'Short chat with a UPSC mentor')}</div>
        <div class="sec-title">Make study material</div>
        <div class="list">${li('aiPaste', 'book', 'Explain, summarise or make MCQs and cards', 'Paste a topic or text')}${li('openPSearch', 'search', 'Read scanned PDFs', 'Inside Search all PDFs')}</div>
        <div class="sec-title">Planning</div>
        <div class="list">${li('aiToday', 'target', 'What should I study today?', 'From your progress and weak spots')}${li('aiReview', 'chart', 'Review my month', 'Written summary of your report')}</div>
        <div class="card small muted" style="margin-top:12px">Also: open any PDF, tap ⋯ and choose “Ask AI about this page”. In Previous-year questions, the Add sheet can suggest the topic.<br><br>What you choose to send goes to Google. Your diary, money and recordings are never sent. AI can be wrong, so check facts against your notes.</div><div style="height:20px"></div>`;
    },
  };
  LU.actions.openAi = () => LU.push('ai');

  /* ---------- key screen ---------- */
  LU.views.aikey = {
    render() {
      return head('AI settings', 'Gemini key') + `
        <div class="card"><div class="small" style="line-height:1.5">1. On any browser open <b>aistudio.google.com/apikey</b> and sign in with Google.<br>2. Tap <b>Create API key</b> and copy it.<br>3. Paste it below. It stays on this phone only.</div></div>
        <div class="field" style="margin-top:12px"><label>Gemini API key</label><input class="inp" id="gkK" type="password" autocomplete="off" value="${esc(LU.aiKey())}" placeholder="AIza…"></div>
        <div class="field"><label>Model</label><input class="inp" id="gkM" value="${esc(LU.aiModel())}" autocomplete="off"><div class="small muted" style="margin-top:4px">Leave as is. If a model is busy or retired, LevelUp tries others by itself.</div><button class="btn ghost sm" type="button" data-act="gkModels" style="margin-top:8px">Show models for my key</button></div>
        <div style="display:flex;gap:10px"><button class="btn block" data-act="gkSave">Save</button><button class="btn ghost block" data-act="gkTest">Test</button></div>
        ${LU.aiKey() ? `<button class="btn danger block" style="margin-top:10px" data-act="gkDel">Remove key</button>` : ''}
        <div class="card small muted" style="margin-top:12px">On the free plan Google may use what you send to improve its products. Only send study text.</div><div style="height:20px"></div>`;
    },
  };
  LU.actions.openAiKey = () => LU.push('aikey');
  LU.actions.gkSave = () => { set(KEY, LU.$('#gkK').value.trim()); const m = LU.$('#gkM').value.trim(); set(MOD, m && m !== DEF_MODEL ? m : ''); LU.toast('Saved.', { sys: false }); LU.render(); };
  LU.actions.gkTest = async () => { LU.actions.gkSave(); const r = await task('Testing…', 'Reply with the single word: ready', { temp: 0 }); if (r) LU.toast('Works with ' + (LU.aiUsed || LU.aiModel()) + '. Gemini said: ' + r.slice(0, 30), { sys: false, ms: 4500 }); };
  LU.actions.gkModels = async () => {
    LU.actions.gkSave();
    const b = busy('Asking Gemini which models your key can use…');
    try {
      const names = (await LU.aiList(b.signal)).filter((n) => /^gemini/.test(n) && !/embed|image|tts|live|audio/.test(n)).sort().reverse();
      b.done();
      LU.sheet({ title: 'Models for your key', body: `<p class="small muted" style="margin:0 0 8px">Tap one to use it. Names with “flash” are fast and cheap.</p><div class="list">${names.map((n) => `<div class="li" data-m="${esc(n)}"><div class="grow lt">${esc(n)}</div></div>`).join('') || '<div class="li"><div class="grow small muted">None found.</div></div>'}</div>`,
        mount: (s) => LU.$$('[data-m]', s).forEach((r) => (r.onclick = () => { set(MOD, r.dataset.m === DEF_MODEL ? '' : r.dataset.m); LU.closeSheet(); LU.toast('Model: ' + r.dataset.m, { sys: false }); LU.render(); })) });
    } catch (e) { b.done(); fail(e); }
  };
  LU.actions.gkDel = () => LU.confirm('Remove the key?', 'AI features stop until you add a key again.', 'Remove', () => { set(KEY, ''); LU.render(); }, true);

  /* ---------- answer checker ---------- */
  const A = { q: '', a: '', marks: 10, out: '' };
  LU.views.aians = {
    render() {
      return head('Check my answer', 'Mains answer feedback') + `
        <div class="field"><label>Question</label><textarea class="inp" id="anQ" rows="3" maxlength="800" placeholder="Paste the question">${esc(A.q)}</textarea></div>
        <div class="field"><label>Marks</label><div class="seg" id="anM">${[10, 15, 20].map((m) => `<button type="button" data-m="${m}" class="${A.marks === m ? 'on' : ''}">${m}</button>`).join('')}</div></div>
        <div class="field"><label>Your answer</label><textarea class="inp" id="anA" rows="10" maxlength="6000" placeholder="Type or paste your answer">${esc(A.a)}</textarea></div>
        <div style="display:flex;gap:10px"><button class="btn block" data-act="anGo">${I('check')}Check</button><button class="btn ghost block" data-act="anPhoto">${I('image')}From photo</button></div>
        ${A.out ? `<div class="card" style="margin-top:12px">${fmt(A.out)}<div style="display:flex;gap:10px;margin-top:8px"><button class="btn ghost sm" data-act="anCopy">Copy</button><button class="btn ghost sm" data-act="anLog">Count as written</button></div></div>` : ''}
        <div style="height:20px"></div>`;
    },
    mount(el) {
      const sync = () => { A.q = LU.$('#anQ', el).value; A.a = LU.$('#anA', el).value; };
      LU.$('#anQ', el).oninput = sync; LU.$('#anA', el).oninput = sync;
      LU.$$('#anM button', el).forEach((b) => (b.onclick = () => { A.marks = +b.dataset.m; LU.$$('#anM button', el).forEach((x) => x.classList.toggle('on', x === b)); }));
    },
  };
  LU.actions.openAiAns = () => LU.push('aians');
  LU.actions.anPhoto = () => pickPhoto(async (im) => {
    const r = await task('Reading your handwriting…', 'Transcribe the handwritten text in the image exactly as written, keeping line breaks. Do not correct or add anything. Reply with the text only.', { images: [im], temp: 0 });
    if (r) { A.a = (A.a ? A.a + '\n' : '') + r; LU.render(); }
  });
  LU.actions.anGo = async () => {
    A.q = LU.$('#anQ').value.trim(); A.a = LU.$('#anA').value.trim();
    if (!A.q || A.a.length < 40) { LU.toast('Add the question and an answer of a few lines.'); return; }
    const words = A.a.split(/\s+/).length, lim = A.marks === 10 ? 150 : A.marks === 15 ? 250 : 300;
    const r = await task('Checking your answer…', `Question (${A.marks} marks, about ${lim} words expected):\n${A.q}\n\nStudent's answer (${words} words):\n${A.a}\n\nAct as a strict but fair UPSC Mains examiner. Reply in this format:\n**Score:** x/${A.marks}\n**What is good:** 2 bullets\n**What is missing:** up to 5 bullets (facts, dimensions, examples, keywords, data)\n**Structure:** one line on intro, body and conclusion\n**Better opening line:** one sentence\n**Add these 3 points:** 3 bullets\nBe specific to this question. Keep it short.`, { system: SYS, temp: 0.3 });
    if (r) { A.out = r; LU.render(); }
  };
  LU.actions.anCopy = async () => LU.toast((await LU.copyText(A.out)) ? 'Copied.' : 'Could not copy.', { sys: false });
  LU.actions.anLog = () => { const k = LU.todayKey(), s = LU.state; s.aw = Object.assign({ target: 1, log: {} }, s.aw || {}); const n = s.aw.log[k] || 0; s.aw.log[k] = n + 1; if (n + 1 <= s.aw.target) { LU.gainXP(10); LU.log('Answer written', 10); } LU.save(); LU.toast('Counted in Answer writing.', { sys: false }); };

  /* photo to text on its own */
  LU.actions.aiPhoto = () => { if (!LU.aiKey()) { fail(Object.assign(new Error('Add your Gemini key first.'), { code: 'nokey' })); return; } pickPhoto(async (im) => { const r = await task('Reading the photo…', 'Transcribe all text in the image exactly as written, keeping line breaks. Reply with the text only.', { images: [im], temp: 0 }); if (r) result('Text from photo', r); }); };

  /* ---------- doubt chat ---------- */
  const chat = [];
  LU.views.aichat = {
    render() {
      return head('Ask a doubt', 'UPSC mentor') + `<div id="chLog">${chat.map((m) => `<div class="card" style="${m.role === 'user' ? 'margin-left:32px;background:var(--card2,rgba(120,160,255,.08))' : 'margin-right:16px'}">${m.role === 'user' ? esc(m.text) : fmt(m.text)}</div>`).join('') || '<div class="card small muted">Ask anything about a topic. Answers are kept short.</div>'}</div>
        <div class="field" style="margin-top:12px"><textarea class="inp" id="chQ" rows="2" maxlength="800" placeholder="Type your doubt"></textarea></div>
        <div style="display:flex;gap:10px"><button class="btn block" data-act="chSend">Send</button>${chat.length ? `<button class="btn ghost" data-act="chClear">Clear</button>` : ''}</div><div style="height:20px"></div>`;
    },
  };
  LU.actions.openAiChat = () => LU.push('aichat');
  LU.actions.chClear = () => { chat.length = 0; LU.render(); };
  LU.actions.chSend = async () => {
    const q = LU.$('#chQ').value.trim(); if (!q) return;
    const hist = chat.slice(-8).map((m) => ({ role: m.role === 'user' ? 'user' : 'model', text: m.text }));
    const r = await task('Thinking…', q, { system: SYS + ' Keep answers under 150 words unless asked for more.', history: hist });
    if (r) { chat.push({ role: 'user', text: q }, { role: 'model', text: r }); LU.render(false); const m = LU.$('#main'); if (m) m.scrollTop = m.scrollHeight; }
  };

  /* ---------- paste text / topic ---------- */
  LU.actions.aiPaste = () => LU.sheet({
    title: 'Topic or text',
    body: `<div class="field"><label>Type a topic (e.g. “Fundamental Duties”) or paste text</label><textarea class="inp" id="apT" rows="6" maxlength="12000"></textarea></div>`,
    foot: `<button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn" id="apOk">Next</button>`,
    mount: (s) => { LU.$('#apOk', s).onclick = () => { const v = LU.$('#apT', s).value.trim(); if (!v) { LU.toast('Write a topic or paste text.'); return; } LU.closeSheet(true); setTimeout(() => textTools(v.length > 200 ? { label: v.slice(0, 24), text: v } : { label: v, text: 'Topic: ' + v + '. Use your own knowledge of this topic for UPSC and say if unsure.' }), 60); }; },
  });

  /* ---------- planning ---------- */
  LU.aiSummary = () => {
    const s = LU.state, t = LU.todayKey(), m7 = LU.subjMinutes ? LU.subjMinutes(LU.addDays(t, -6), t) : {};
    const subs = LU.syllabus.filter((x) => x.id !== 'essay').map((x) => { const p = LU.subjProgress(x); return `${x.name}: ${Math.round(p.pct * 100)}% topics done, ${Math.round((m7[x.id] || 0) / 60 * 10) / 10}h in last 7 days`; });
    const mq = s.mcq || { stat: {} }, weak = Object.entries(mq.stat || {}).filter(([, v]) => v.n >= 3).map(([k, v]) => ({ k, p: Math.round((v.ok / v.n) * 100) })).sort((a, b) => a.p - b.p).slice(0, 4).map((w) => `${w.k} ${w.p}%`);
    const mocks = (s.mocks || []).slice(-3).map((x) => Math.round((x.score / x.max) * 100) + '%');
    const L = LU.levelInfo();
    return [`Prelims exam in ${LU.daysToExam()} days.`, 'Syllabus progress:', ...subs.map((x) => '- ' + x), `Streak ${LU.streak()} days. Missed quests this week: ${LU.missedCounts().week}. Revision topics due: ${LU.revDue ? LU.revDue().length : 0}. Flashcards due: ${LU.cardsDue ? LU.cardsDue().length : 0}.`, weak.length ? 'Weak MCQ topics: ' + weak.join(', ') : '', mocks.length ? 'Last mock scores: ' + mocks.join(', ') : '', `Level ${L.level}.`].filter(Boolean).join('\n');
  };
  LU.actions.aiToday = async () => {
    const r = await task('Planning your day…', 'Here is a UPSC aspirant\'s progress:\n' + LU.aiSummary() + '\n\nSuggest what to study today in 5 short bullets. Name the subjects, what to revise, and one thing to fix. Be realistic for an office worker with about 3 hours of study on a weekday. No long intro.', { system: SYS });
    if (r) result('Today', r);
  };
  LU.actions.aiReview = async () => {
    const m = LU.todayKey().slice(0, 7);
    const r = await task('Reviewing your month…', 'Here is the monthly report of a UPSC aspirant:\n' + LU.reportText(m) + '\n\nGive a short honest review: 2 things going well, 3 things to fix, and one target for next week. Use bullets, no long intro.', { system: SYS });
    if (r) result('Month review', r);
  };

  /* ---------- PYQ: suggest the topic ---------- */
  LU.aiTagTopic = async (question) => {
    const subs = LU.syllabus.map((s) => s.id + '=' + s.name).join('; ');
    const r = await task('Finding the topic…', `Previous-year UPSC question:\n${question}\n\nSubjects (id=name): ${subs}\nReply as JSON {"subject":"<id>","keywords":"3 to 6 words naming the specific syllabus topic"}.`, { system: SYS, json: true, temp: 0 });
    if (!r) return null;
    const j = jsonOf(r) || {}, words = String(j.keywords || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
    const qw = question.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
    let pool = LU.syllabus.filter((s) => !j.subject || s.id === j.subject);
    if (!pool.length) pool = LU.syllabus;
    const score = (t) => { const x = t.toLowerCase(); return words.reduce((a, w) => a + (x.includes(w) ? 3 : 0), 0) + qw.reduce((a, w) => a + (x.includes(w) ? 1 : 0), 0); };
    const all = pool.flatMap((s) => LU.subjLeaves(s).map((l) => ({ id: l.i, t: l.t, sn: s.name, sc: score(l.t) })));
    return all.filter((x) => x.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, 6);
  };

  /* ---------- menu entries ---------- */
  const prev = LU.more3;
  LU.more3 = () => `
      <div class="sec-title">AI helper</div>
      <div class="list">${li('openAi', 'star', 'AI helper (Gemini)', LU.aiKey() ? 'Answer check, doubts, MCQs, scan reading' : 'Add a free key to unlock')}</div>` + prev();
})();
