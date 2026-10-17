/* Notes data layer: PDF storage (IndexedDB), pdf.js loading, ink storage, thumbnails, topic suggestions */
(function () {
  const LU = window.LU;

  /* ---------- IndexedDB ---------- */
  const STORES = ['files', 'thumbs', 'ink', 'snaps'];
  let dbp = null;
  const db = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('levelup-notes', 1);
    r.onupgradeneeded = () => STORES.forEach((s) => { if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s); });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const tx = async (store, mode, fn) => {
    const d = await db();
    return new Promise((res, rej) => {
      const t = d.transaction(store, mode), s = t.objectStore(store);
      const req = fn(s);
      t.oncomplete = () => res(req && req.result);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error || new Error('Storage is full'));
    });
  };
  LU.idb = {
    get: (s, k) => tx(s, 'readonly', (st) => st.get(k)),
    put: (s, k, v) => tx(s, 'readwrite', (st) => st.put(v, k)),
    del: (s, k) => tx(s, 'readwrite', (st) => st.delete(k)),
    keys: (s) => tx(s, 'readonly', (st) => st.getAllKeys()),
    clearPrefix: async (s, prefix) => { const ks = await LU.idb.keys(s); await Promise.all(ks.filter((k) => String(k).startsWith(prefix)).map((k) => LU.idb.del(s, k))); },
  };

  /* ---------- pdf.js ---------- */
  const abs = (p) => new URL(p, document.baseURI).href;
  let libP = null;
  LU.pdfLib = () => libP || (libP = (async () => {
    const lib = await import(abs('vendor/pdfjs/pdf.min.mjs'));
    try {
      const src = await (await fetch(abs('vendor/pdfjs/pdf.worker.min.mjs'))).text();
      const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
      lib.GlobalWorkerOptions.workerPort = new Worker(url, { type: 'module' });
    } catch (e) {
      lib.GlobalWorkerOptions.workerSrc = abs('vendor/pdfjs/pdf.worker.min.mjs');
    }
    return lib;
  })());
  /* pdf.js shares one worker: run opens and closes one at a time so they never race */
  let chain = Promise.resolve();
  const serial = (fn) => { const r = chain.then(fn, fn); chain = r.catch(() => {}); return r; };
  const destroy = (pdf) => serial(() => pdf.loadingTask.destroy()).catch(() => {});
  LU.destroyPdf = destroy;
  const openFromData = (data) => serial(async () => {
    const lib = await LU.pdfLib();
    return lib.getDocument({
      data, useWorkerFetch: false, isEvalSupported: false, enableXfa: false,
      cMapUrl: abs('vendor/pdfjs/cmaps/'), cMapPacked: true,
      standardFontDataUrl: abs('vendor/pdfjs/standard_fonts/'),
      wasmUrl: abs('vendor/pdfjs/wasm/'), iccUrl: abs('vendor/pdfjs/iccs/'),
    }).promise;
  });
  /* small cache of open documents (revision mode renders many snapshots) */
  const open = new Map();
  LU.openDoc = async (id) => {
    if (open.has(id)) { const v = open.get(id); open.delete(id); open.set(id, v); return v; }
    const blob = await LU.idb.get('files', id);
    if (!blob) throw new Error('missing');
    const p = openFromData(new Uint8Array(await blob.arrayBuffer()));
    open.set(id, p);
    while (open.size > 2) { const [k, v] = open.entries().next().value; open.delete(k); v.then(destroy).catch(() => {}); }
    try { return await p; } catch (e) { open.delete(id); throw e; }
  };
  LU.closeDoc = (id) => { const v = open.get(id); if (v) { open.delete(id); v.then(destroy).catch(() => {}); } };

  /* ---------- doc metadata (lives in state, so it is part of backups) ---------- */
  LU.docs = () => (LU.state.docs = LU.state.docs || []);
  LU.doc = (id) => LU.docs().find((d) => d.id === id);
  LU.docsFor = (pred) => LU.docs().filter(pred);
  LU.QP = { id: 'qp', name: 'Question papers', color: '#F5C451' };
  LU.docLabel = (d) => {
    if (d.subj === 'qp') return LU.QP.name;
    const s = d.subj && LU.subject(d.subj), n = d.node && LU.node(d.node);
    return s ? s.name + (n ? ' › ' + n.t : '') : 'Unsorted';
  };

  /* ---------- ink (annotations) ---------- */
  const inkCache = {};
  LU.getInk = async (id) => {
    if (inkCache[id]) return inkCache[id];
    const v = (await LU.idb.get('ink', id)) || {};
    v.strokes = v.strokes || []; v.notes = v.notes || []; v.marks = v.marks || []; v.imgs = v.imgs || [];
    return (inkCache[id] = v);
  };
  const inkTimers = {};
  LU.saveInk = (id, now) => {
    clearTimeout(inkTimers[id]);
    const run = () => {
      const v = inkCache[id]; if (!v) return;
      LU.idb.put('ink', id, v).catch((e) => LU.toast('Could not save marks: ' + e.message));
      const d = LU.doc(id); if (d) { d.marks = v.strokes.length + v.notes.length; LU.save(); }
    };
    if (now) run(); else inkTimers[id] = setTimeout(run, 400);
  };

  /* ---------- import ---------- */
  const textOf = async (pdf, maxPages) => {
    let out = '';
    for (let i = 1; i <= Math.min(maxPages, pdf.numPages); i++) {
      try { const p = await pdf.getPage(i); const tc = await p.getTextContent(); out += ' ' + tc.items.map((x) => x.str).join(' '); } catch (e) {}
      if (out.length > 30000) break;
    }
    return out;
  };
  LU.makeThumb = async (pdf) => {
    const p = await pdf.getPage(1), v1 = p.getViewport({ scale: 1 });
    const vp = p.getViewport({ scale: 260 / v1.width });
    const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await p.render({ canvasContext: ctx, viewport: vp }).promise;
    return c.toDataURL('image/jpeg', 0.72);
  };
  const cleanName = (n) => n.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Untitled notes';

  /* Store a PDF file. Returns {doc, suggestions} */
  LU.importPdf = async (file, name) => {
    const id = 'd' + LU.uid();
    const blob = file instanceof Blob ? file : new Blob([file], { type: 'application/pdf' });
    const head = new Uint8Array(await blob.slice(0, 1024).arrayBuffer());
    const sig = String.fromCharCode.apply(null, Array.from(head)).indexOf('%PDF');
    if (sig < 0) throw new Error(`“${name}” is not a PDF file.`);
    await LU.idb.put('files', id, blob);
    let pdf;
    try { pdf = await openFromData(new Uint8Array(await blob.arrayBuffer())); }
    catch (e) { await LU.idb.del("files", id); throw new Error(`“${name}” could not be opened${/password/i.test(e.message) ? ': it is password protected' : ''}.`); }
    const text = await textOf(pdf, 4);
    let ratio = 1.414; try { const v1 = (await pdf.getPage(1)).getViewport({ scale: 1 }); ratio = v1.height / v1.width; } catch (e) {}
    let thumb = null; try { thumb = await LU.makeThumb(pdf); } catch (e) {}
    if (thumb) await LU.idb.put('thumbs', id, thumb);
    const doc = { id, name: cleanName(name || file.name || 'Notes'), size: blob.size, pages: pdf.numPages, added: Date.now(), opened: 0, page: 1, mins: 0, marks: 0, ratio, hasText: text.replace(/\s/g, '').length > 80, subj: null, node: null };
    await destroy(pdf);
    LU.docs().unshift(doc); LU.save(true);
    return { doc, suggestions: LU.suggestTopics(doc.name + ' ' + doc.name + ' ' + doc.name + ' ' + text) };
  };
  LU.deleteDoc = async (id) => {
    LU.closeDoc(id);
    const gone = LU.doc(id); if (gone && gone.recs && window.Android && Android.recDelete) gone.recs.forEach((r) => { try { Android.recDelete(r.file); } catch (e) {} });
    const s = LU.state; s.docs = LU.docs().filter((d) => d.id !== id);
    LU.save(true);
    delete inkCache[id];
    await Promise.all([LU.idb.del('files', id), LU.idb.del('thumbs', id), LU.idb.del('ink', id), LU.idb.del('files', 'bak:' + id), LU.idb.clearPrefix('snaps', id + '|')]);
  };
  LU.relinkDoc = async (id, file) => {
    await LU.idb.put('files', id, file);
    const pdf = await openFromData(new Uint8Array(await file.arrayBuffer()));
    const d = LU.doc(id); d.pages = pdf.numPages; d.size = file.size;
    try { await LU.idb.put('thumbs', id, await LU.makeThumb(pdf)); } catch (e) {}
    await destroy(pdf); LU.save();
  };
  LU.hasFile = async (id) => !!(await LU.idb.get('files', id));

  /* ---------- topic suggestions from text ---------- */
  const STOP = new Set('the and for with from that this these those into their there which what when where while about above after again against among because before being below between both cannot could does doing down during each further have having here how more most other over same should some such than then them they through under until very were will would your also only upto india indian notes note class lecture chapter part unit page pages important topic topics introduction concept concepts types type features feature role issues issue related various based study general detailed summary overview upsc prelims mains academy unacademy handout pdf'.split(' '));
  const toks = (s) => (s.toLowerCase().match(/[a-z][a-z-]{3,}/g) || []).filter((w) => !STOP.has(w));
  let IDX = null;
  const buildIdx = () => {
    const nodes = [], df = {};
    LU.syllabus.forEach((s) => {
      const walk = (n, depth, path) => {
        const t = Array.from(new Set(toks(n.t)));
        if (t.length) { nodes.push({ id: n.i, sid: s.id, t, depth, path }); t.forEach((w) => (df[w] = (df[w] || 0) + 1)); }
        (n.c || []).forEach((c) => walk(c, depth + 1, path.concat(n.t)));
      };
      (s.c || []).forEach((sec) => (sec.c || []).forEach((c) => walk(c, 1, [])));
    });
    IDX = { nodes, df, N: nodes.length };
  };
  LU.suggestTopics = (text) => {
    if (!IDX) buildIdx();
    const tf = {}; toks(text).forEach((w) => (tf[w] = (tf[w] || 0) + 1));
    const scored = [];
    for (const n of IDX.nodes) {
      let sc = 0, hit = 0;
      for (const w of n.t) { if (tf[w]) { hit++; sc += Math.log(1 + tf[w]) * Math.log(IDX.N / (1 + IDX.df[w])); } }
      if (!hit) continue;
      sc = (sc * (hit / n.t.length)) / Math.sqrt(n.t.length);
      if (n.depth <= 2) sc *= 1.25; // prefer broader topics
      scored.push({ id: n.id, sid: n.sid, score: sc });
    }
    scored.sort((a, b) => b.score - a.score);
    const subj = {};
    scored.slice(0, 40).forEach((x) => (subj[x.sid] = (subj[x.sid] || 0) + x.score));
    const subjects = Object.keys(subj).sort((a, b) => subj[b] - subj[a]);
    const seen = new Set(), topics = [];
    for (const x of scored) { if (topics.length >= 4) break; if (seen.has(x.id)) continue; seen.add(x.id); if (subjects[0] && x.score < scored[0].score * 0.35) break; topics.push(x); }
    return { subjects: subjects.slice(0, 3), topics };
  };
})();
