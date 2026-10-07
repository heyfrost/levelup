/* Part 17a: full backup file (with PDFs), change tracking, and the merge engine used by sync */
(function () {
  const LU = window.LU, esc = LU.esc, I = LU.icon;
  const enc = new TextEncoder(), dec = new TextDecoder();
  const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x) && !(x instanceof Blob);
  const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
  const fnv = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
  const b2d = (b) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
  const d2b = async (u) => (await fetch(u)).blob();
  LU.fnv = fnv;

  /* ---------- keep track of what changed and when (needed to merge two devices) ---------- */
  const sigs = {};
  const LOCAL_KEYS = ['processed', 'timer', 'lastBackup', 'autoBackupOn', 'autoBackupAt', 'autoBackupWeek', 'syncBase', '_mt'];
  const LOCAL_SETTINGS = ['rotate', 'haptics', 'sound', 'soundPack', 'askedNotif'];
  const touch = () => {
    const s = LU.state; if (!s) return;
    s._mt = s._mt || {};
    Object.keys(s).forEach((k) => {
      if (k === '_mt') return;
      let g; try { g = fnv(JSON.stringify(s[k]) || ''); } catch (e) { return; }
      if (sigs[k] === undefined) { sigs[k] = g; return; }
      if (sigs[k] !== g) { sigs[k] = g; s._mt[k] = Date.now(); }
    });
  };
  const origSave = LU.save; let st;
  LU.save = (now) => {
    if (LU.frozen) return;                      /* a restore or sync is replacing the data: never write the old copy back */
    if (now) { clearTimeout(st); touch(); origSave(true); return; }
    clearTimeout(st); st = setTimeout(() => { touch(); origSave(true); }, 120);
  };
  setTimeout(touch, 300);
  /* remember deleted PDFs and when marks last changed */
  const origDel = LU.deleteDoc;
  LU.deleteDoc = async (id) => { const s = LU.state; s.tomb = s.tomb || {}; s.tomb[id] = Date.now(); return origDel(id); };
  const origInk = LU.saveInk;
  LU.saveInk = (id, now) => { const d = LU.doc(id); if (d) d.inkAt = Date.now(); return origInk(id, now); };

  /* =====================================================
     Backup file with everything: .levelup
     [LVLP3\n] then repeated: 4 bytes header length, header JSON, body bytes
     ===================================================== */
  const MAGIC = 'LVLP3\n';
  const inkOut = async (ink) => { const o = Object.assign({}, ink); o.imgs = []; for (const im of (ink.imgs || [])) { const c = Object.assign({}, im); if (im.blob instanceof Blob) { c.blobData = await b2d(im.blob); } delete c.blob; o.imgs.push(c); } return o; };
  const inkIn = async (o) => { const ink = Object.assign({}, o); ink.imgs = []; for (const im of (o.imgs || [])) { const c = Object.assign({}, im); if (c.blobData) { c.blob = await d2b(c.blobData); } delete c.blobData; ink.imgs.push(c); } return ink; };
  LU.inkOut = inkOut; LU.inkIn = inkIn;
  const part = (meta, body) => {
    const b = body instanceof Blob ? body : new Blob([typeof body === 'string' ? enc.encode(body) : body]);
    meta.size = b.size;
    const h = enc.encode(JSON.stringify(meta)), l = new Uint8Array(4); new DataView(l.buffer).setUint32(0, h.length);
    return [l, h, b];
  };
  LU.packBackup = async (opts) => {
    opts = Object.assign({ files: true }, opts || {});
    const parts = [MAGIC]; const add = (m, b) => part(m, b).forEach((x) => parts.push(x));
    add({ k: 'meta' }, JSON.stringify({ app: 'LevelUp', v: 3, at: Date.now(), files: !!opts.files }));
    add({ k: 'state' }, JSON.stringify(LU.state));
    if (LU.syllabus !== window.SYLLABUS) add({ k: 'syl' }, JSON.stringify(LU.syllabus));
    for (const d of (LU.state.docs || [])) {
      try { const ink = await LU.idb.get('ink', d.id); if (ink) add({ k: 'ink', id: d.id }, JSON.stringify(await inkOut(ink))); } catch (e) {}
      try { const t = await LU.idb.get('thumbs', d.id); if (t) add({ k: 'thumb', id: d.id }, t); } catch (e) {}
      if (opts.files) { try { const f = await LU.idb.get('files', d.id); if (f) add({ k: 'file', id: d.id }, f); } catch (e) {} }
    }
    for (const b of (LU.state.refs || [])) {
      try { const t = await LU.idb.get('snaps', 'reftxt:' + b.id); if (t) add({ k: 'snap', id: 'reftxt:' + b.id }, typeof t === 'string' ? t : JSON.stringify(t)); } catch (e) {}
      if (opts.files) { try { const f = await LU.idb.get('files', 'ref:' + b.id); if (f) add({ k: 'file', id: 'ref:' + b.id }, f); } catch (e) {} }
    }
    try { for (const k of (await LU.idb.keys('snaps'))) { if (String(k).startsWith('card:')) { const v = await LU.idb.get('snaps', k); if (typeof v === 'string') add({ k: 'snap', id: k }, v); } } } catch (e) {}
    return new Blob(parts, { type: 'application/octet-stream' });
  };
  /* read a pack: calls fn(meta, blob) for each record */
  LU.readPack = async (file, fn) => {
    const head = new TextDecoder().decode(await file.slice(0, MAGIC.length).arrayBuffer());
    if (head !== MAGIC) throw new Error('This is not a LevelUp full backup file.');
    let pos = MAGIC.length;
    while (pos < file.size) {
      const hl = new DataView(await file.slice(pos, pos + 4).arrayBuffer()).getUint32(0); pos += 4;
      const meta = JSON.parse(dec.decode(await file.slice(pos, pos + hl).arrayBuffer())); pos += hl;
      const body = file.slice(pos, pos + meta.size); pos += meta.size;
      await fn(meta, body);
    }
  };
  LU.isPack = async (file) => { try { return new TextDecoder().decode(await file.slice(0, MAGIC.length).arrayBuffer()) === MAGIC; } catch (e) { return false; } };

  /* save a big file: Android bridge in pieces, iPad share sheet or download */
  LU.saveBlob = async (name, blob) => {
    const A = window.Android;
    if (A && A.binBegin) {
      const h = A.binBegin(name, 'application/octet-stream'); if (String(h).startsWith('Error')) return h;
      const CH = 393216;
      for (let i = 0; i < blob.size; i += CH) {
        const sub = new Uint8Array(await blob.slice(i, i + CH).arrayBuffer()); let s = '';
        for (let j = 0; j < sub.length; j += 8192) s += String.fromCharCode.apply(null, sub.subarray(j, j + 8192));
        const r = A.binChunk(h, btoa(s)); if (String(r).startsWith('Error')) return r;
        if (i % (CH * 8) === 0) await new Promise((res) => setTimeout(res, 0));
      }
      return A.binEnd(h);
    }
    const file = new File([blob], name, { type: 'application/octet-stream' });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return 'the place you chose'; } } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    return 'Downloads/' + name;
  };

  LU.actions.backupFull = async () => {
    LU.toast('Making the backup…', { sys: false, ms: 1500 });
    try {
      const blob = await LU.packBackup({ files: true });
      const name = `LevelUp-full-${LU.todayKey()}.levelup`;
      const where = await LU.saveBlob(name, blob);
      if (where === 'cancelled') return;
      LU.state.lastBackup = Date.now(); LU.save();
      LU.toast(where && !String(where).startsWith('Error') ? `Saved to ${where} (${(blob.size / 1048576).toFixed(1)} MB)` : 'Could not save: ' + where, { ms: 5000 });
      LU.render(true);
    } catch (e) { LU.toast('Backup failed: ' + (e.message || e), { ms: 5000 }); }
  };

  /* replace everything on this device with a pack */
  LU.restorePack = async (file) => {
    let state = null, syl = null;
    await LU.readPack(file, async (m, body) => {
      if (m.k === 'state') state = JSON.parse(dec.decode(await body.arrayBuffer()));
      else if (m.k === 'syl') syl = JSON.parse(dec.decode(await body.arrayBuffer()));
      else if (m.k === 'ink') await LU.idb.put('ink', m.id, await inkIn(JSON.parse(dec.decode(await body.arrayBuffer()))));
      else if (m.k === 'thumb') await LU.idb.put('thumbs', m.id, dec.decode(await body.arrayBuffer()));
      else if (m.k === 'file') await LU.idb.put('files', m.id, new Blob([body], { type: 'application/pdf' }));
      else if (m.k === 'snap') await LU.idb.put('snaps', m.id, dec.decode(await body.arrayBuffer()));
    });
    if (!state) throw new Error('The backup has no progress data.');
    LU.frozen = true;
    localStorage.setItem('levelup.state.v1', JSON.stringify(state));
    if (syl) localStorage.setItem('levelup.syllabus.v1', JSON.stringify(syl)); else localStorage.removeItem('levelup.syllabus.v1');
  };
  /* used by the Restore button: accepts the old .json backup and the new full backup */
  LU.restoreAny = async (file) => {
    try {
      if (await LU.isPack(file)) {
        LU.toast('Restoring…', { sys: false, ms: 2000 });
        await LU.restorePack(file);
      } else { const t = await file.text(); LU.frozen = true; try { await LU.importAll(t); } catch (e) { LU.frozen = false; throw e; } }
      LU.toast('Backup restored. Reloading…'); setTimeout(() => location.reload(), 900);
    } catch (e) { LU.toast(e.message || 'That file could not be read.', { ms: 4500 }); }
  };

  /* =====================================================
     Merge engine
     ===================================================== */
  const NEWER_KEYS = ['schedule', 'checklist', 'workout', 'quotes'];
  const MAXPATH = /^(days|docs)\b/;
  function mergeArr(a, b, rn, path) {
    const prim = (x) => x === null || typeof x !== 'object';
    if (a.every(prim) && b.every(prim)) { const out = a.slice(); b.forEach((x) => { if (!out.includes(x)) out.push(x); }); return out; }
    const hasId = (x) => isObj(x) && x.id !== undefined && x.id !== null;
    if (a.every(hasId) && b.every(hasId)) {
      const map = new Map(); a.forEach((x) => map.set(x.id, x));
      const out = a.map((x) => x);
      b.forEach((y) => { if (map.has(y.id)) { const i = out.findIndex((z) => z.id === y.id); out[i] = mv(out[i], y, rn, path); } else out.push(y); });
      return out;
    }
    if (a.every(isObj) && b.every(isObj)) {                       /* log-like entries without ids */
      const seen = new Set(), out = [];
      a.concat(b).forEach((x) => { const k = JSON.stringify(x); if (!seen.has(k)) { seen.add(k); out.push(x); } });
      if (out.every((x) => typeof x.t === 'number')) out.sort((x, y) => y.t - x.t);
      return out.length > 400 && path === 'log' ? out.slice(0, 400) : out;
    }
    return rn ? b : a;
  }
  function mv(a, b, rn, path) {
    if (a === undefined) return b; if (b === undefined) return a;
    if (isObj(a) && isObj(b)) {
      const out = {};
      new Set(Object.keys(a).concat(Object.keys(b))).forEach((k) => { out[k] = mv(a[k], b[k], rn, path ? path + '.' + k : k); });
      return out;
    }
    if (Array.isArray(a) && Array.isArray(b)) return mergeArr(a, b, rn, path);
    if (a === b) return a;
    if (typeof a === 'boolean' && typeof b === 'boolean') return a || b;
    if (typeof a === 'number' && typeof b === 'number') return MAXPATH.test(path) ? Math.max(a, b) : (rn ? b : a);
    return rn ? b : a;
  }
  /* local = this device's state, remote = the other device's. Returns the merged state. */
  LU.mergeStates = (local, remote, info) => {
    info = info || {};
    const lm = local._mt || {}, rm = remote._mt || {}, out = {};
    const keys = new Set(Object.keys(local).concat(Object.keys(remote)));
    keys.forEach((k) => {
      if (LOCAL_KEYS.includes(k) || k === 'tomb') return;
      const a = local[k], b = remote[k];
      if (a === undefined) { out[k] = clone(b); return; }
      if (b === undefined) { out[k] = clone(a); return; }
      if (JSON.stringify(a) === JSON.stringify(b)) { out[k] = clone(a); return; }
      const rn = (rm[k] || 0) > (lm[k] || 0);
      if (NEWER_KEYS.includes(k)) { out[k] = clone(rn ? b : a); return; }
      if (k === 'settings') {
        const o = clone(mv(a, b, rn, 'settings'));
        LOCAL_SETTINGS.forEach((x) => { if (a[x] !== undefined) o[x] = a[x]; });
        out[k] = o; return;
      }
      out[k] = clone(mv(a, b, rn, k));
    });
    /* XP and stats are running totals: add what each device earned since they last synced */
    const lb = local.syncBase, rb = remote.syncBase;
    const add = (L, R, lbv, rbv) => (lb && rb && lbv !== undefined && rbv !== undefined ? L + (R - rbv) : Math.max(L || 0, R || 0));
    if (typeof local.xp === 'number' || typeof remote.xp === 'number') out.xp = add(local.xp || 0, remote.xp || 0, lb && lb.xp, rb && rb.xp);
    if (local.stats && remote.stats) { out.stats = {}; Object.keys(Object.assign({}, local.stats, remote.stats)).forEach((x) => { out.stats[x] = add(local.stats[x] || 0, remote.stats[x] || 0, lb && lb.stats && lb.stats[x], rb && rb.stats && rb.stats[x]); }); }
    /* deleted PDFs stay deleted */
    const tomb = Object.assign({}, remote.tomb || {}, local.tomb || {});
    if (Object.keys(tomb).length) { out.tomb = tomb; if (out.docs) out.docs = out.docs.filter((d) => !tomb[d.id]); if (out.refs) out.refs = out.refs.filter((b) => !tomb[b.id]); }
    /* a PDF whose pages were changed on one device: the newer file wins, and its page count and page-based details come with it */
    (out.docs || []).forEach((d) => {
      const a = (local.docs || []).find((x) => x.id === d.id), b = (remote.docs || []).find((x) => x.id === d.id); if (!a || !b) return;
      const fa = a.fileAt || 0, fb = b.fileAt || 0; if (fa === fb) return;
      const w = fa > fb ? a : b;
      ['pages', 'size', 'ratio', 'hasText', 'fileAt', 'page', 'recs', 'pgUndo'].forEach((k) => { if (w[k] !== undefined) d[k] = clone(w[k]); else delete d[k]; });
    });
    if (out.mapPins) { const win = (id) => { const a = (local.docs || []).find((x) => x.id === id), b = (remote.docs || []).find((x) => x.id === id); return a && b && (a.fileAt || 0) !== (b.fileAt || 0) ? ((a.fileAt || 0) > (b.fileAt || 0) ? local : remote) : null; }; out.mapPins = out.mapPins.filter((p, i, arr) => { const w = win(p.doc); if (!w) return true; return (w.mapPins || []).some((x) => x.id === p.id); }); }
    /* this device keeps its own device settings */
    LOCAL_KEYS.forEach((k) => { if (local[k] !== undefined) out[k] = clone(local[k]); });
    out._mt = {}; Object.keys(out).forEach((k) => { out._mt[k] = Math.max(lm[k] || 0, rm[k] || 0); });
    info.merged = true;
    return out;
  };
  /* marks on one PDF. baseAt = time of the last sync, lAt/rAt = when each side last changed its marks */
  LU.mergeInk = (a, b, lAt, rAt, baseAt) => {
    a = a || {}; b = b || {};
    if (baseAt) {
      if ((rAt || 0) <= baseAt && (lAt || 0) > baseAt) return a;      /* only this side changed: keep it (also keeps erasures) */
      if ((lAt || 0) <= baseAt && (rAt || 0) > baseAt) return b;
    }
    const out = {};
    new Set(Object.keys(a).concat(Object.keys(b))).forEach((k) => {
      const x = a[k], y = b[k];
      if (Array.isArray(x) && Array.isArray(y)) {
        const key = (v) => (v && v.id !== undefined ? 'id:' + v.id : JSON.stringify(v, (kk, vv) => (vv instanceof Blob ? 'blob' : vv)));
        const seen = new Set(), res = [];
        x.concat(y).forEach((v) => { const kk = key(v); if (!seen.has(kk)) { seen.add(kk); res.push(v); } });
        out[k] = res;
      } else out[k] = x !== undefined ? x : y;
    });
    return out;
  };
  LU.inkSig = (ink) => fnv(JSON.stringify(ink || {}, (k, v) => (v instanceof Blob ? 'b' + v.size : v)));
  LU.keepOwn = (merged, own) => { LOCAL_KEYS.forEach((k) => { if (own[k] !== undefined) merged[k] = own[k]; }); LOCAL_SETTINGS.forEach((x) => { if (own.settings && own.settings[x] !== undefined && merged.settings) merged.settings[x] = own.settings[x]; }); return merged; };

  /* ---------- merge a backup file into this device (no internet or Wi-Fi needed) ---------- */
  LU.mergePack = async (file) => {
    let remote = null; const inks = {}, thumbs = {}, files = {}, snaps = {};
    await LU.readPack(file, async (m, body) => {
      if (m.k === 'state') remote = JSON.parse(dec.decode(await body.arrayBuffer()));
      else if (m.k === 'ink') inks[m.id] = await inkIn(JSON.parse(dec.decode(await body.arrayBuffer())));
      else if (m.k === 'thumb') thumbs[m.id] = dec.decode(await body.arrayBuffer());
      else if (m.k === 'file') files[m.id] = body;
      else if (m.k === 'snap') snaps[m.id] = dec.decode(await body.arrayBuffer());
    });
    if (!remote) throw new Error('The backup has no progress data.');
    const local = LU.state, before = JSON.stringify(local);
    try { await LU.idb.put('snaps', 'presync:state', before); } catch (e) {}
    const merged = LU.mergeStates(local, remote);
    const baseAt = local.syncBase && local.syncBase.at, rBase = remote.syncBase && remote.syncBase.at;
    const cmp = (id) => { const a = (local.docs || []).find((d) => d.id === id), b = (remote.docs || []).find((d) => d.id === id); return a && b ? Math.sign((b.fileAt || 0) - (a.fileAt || 0)) : 0; };
    let n = 0;
    for (const id of Object.keys(inks)) {
      const mine = await LU.idb.get('ink', id).catch(() => null);
      if (mine) { try { await LU.idb.put('snaps', 'presync:ink:' + id, mine); } catch (e) {} }
      const ld = (local.docs || []).find((d) => d.id === id), rd = (remote.docs || []).find((d) => d.id === id);
      const c = cmp(id), m = c > 0 ? inks[id] : c < 0 && mine ? mine : mine ? LU.mergeInk(mine, inks[id], ld && ld.inkAt, rd && rd.inkAt, baseAt && rBase ? Math.min(baseAt, rBase) : 0) : inks[id];
      await LU.idb.put('ink', id, m); n++;
    }
    for (const id of Object.keys(thumbs)) { if (!(await LU.idb.get('thumbs', id).catch(() => null))) await LU.idb.put('thumbs', id, thumbs[id]); }
    for (const id of Object.keys(files)) { if (!merged.tomb || !merged.tomb[id.replace(/^ref:/, '')]) { if (cmp(id) > 0 || !(await LU.idb.get('files', id).catch(() => null))) { LU._noStamp = true; await LU.idb.put('files', id, new Blob([files[id]], { type: 'application/pdf' })); LU._noStamp = false; } } }
    for (const id of Object.keys(snaps)) { if (!(await LU.idb.get('snaps', id).catch(() => null))) await LU.idb.put('snaps', id, snaps[id]); }
    for (const id of Object.keys(merged.tomb || {})) { for (const [st, k] of [['files', id], ['thumbs', id], ['ink', id], ['files', 'ref:' + id], ['snaps', 'reftxt:' + id]]) await LU.idb.del(st, k).catch(() => {}); }
    merged.syncBase = { xp: merged.xp, stats: clone(merged.stats), at: Date.now() };
    LU.frozen = true;
    localStorage.setItem('levelup.state.v1', JSON.stringify(merged));
    return { docs: (merged.docs || []).length, files: Object.keys(files).length, ink: n };
  };
  LU.undoSync = async () => {
    const t = await LU.idb.get('snaps', 'presync:state').catch(() => null);
    if (!t) throw new Error('There is nothing to undo.');
    LU.frozen = true;
    for (const k of (await LU.idb.keys('snaps'))) { if (String(k).startsWith('presync:ink:')) { const v = await LU.idb.get('snaps', k); await LU.idb.put('ink', String(k).slice(12), v); } }
    localStorage.setItem('levelup.state.v1', t);
  };
})();
